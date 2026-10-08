use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
    time::Duration,
};

use rodio::{source::SeekError, ChannelCount, SampleRate, Source};
use serde::Serialize;
use tauri::{Emitter, Manager};

use crate::{errors::AppError, state::AppState};

/*
 * Real audio analysis, first half.
 *
 * Playback happens in the Rust core, so the webview never sees the decoded
 * samples and there is no `AnalyserNode` to read from. This module taps the
 * decoded stream and ships a short window of mono samples to the UI, which does
 * the FFT.
 *
 * The split is deliberate: the transform, the band mapping and the smoothing all
 * live in `src/features/visualization/spectrum.ts` where they are covered by
 * tests. A hand-written FFT in here would be unreachable from the test suite on
 * a machine that cannot build the Rust crate at all.
 */

/// Mono samples shipped per frame. 1024 at 44.1 kHz is a ~23 ms window, which
/// is short enough for the bars to track a beat and long enough to resolve the
/// bass end.
pub const WINDOW_SAMPLES: usize = 1024;

/// ~30 fps. Fast enough to look continuous, slow enough that the IPC cost stays
/// near 30 KB/s.
const FRAME_INTERVAL: Duration = Duration::from_millis(33);

pub const SPECTRUM_FRAME: &str = "spectrum_frame";

#[derive(Clone, Serialize)]
pub struct SpectrumFrame {
    /// Mono samples, oldest first.
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

#[derive(Default)]
struct TapState {
    window: VecDeque<f32>,
    sample_rate: u32,
    /// Counts mono samples written. The emitter compares it between frames so a
    /// paused player stops sending events instead of repeating stale audio.
    written: u64,
}

/// Ring of the most recent mono samples, shared by the audio thread and the
/// emitter thread.
#[derive(Default)]
pub struct SampleTap {
    state: Mutex<TapState>,
}

impl SampleTap {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(TapState {
                window: VecDeque::with_capacity(WINDOW_SAMPLES),
                ..TapState::default()
            }),
        })
    }

    pub fn set_sample_rate(&self, sample_rate: u32) {
        if let Ok(mut state) = self.state.lock() {
            state.sample_rate = sample_rate;
        }
    }

    fn push(&self, mono: f32) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        if state.window.len() == WINDOW_SAMPLES {
            state.window.pop_front();
        }
        // A poisoned sample would poison the whole frame; clamp instead.
        state.window.push_back(if mono.is_finite() { mono } else { 0.0 });
        state.written += 1;
    }

    /// The current window, or `None` until it has filled once.
    fn snapshot(&self) -> Option<(Vec<f32>, u32, u64)> {
        let state = self.state.lock().ok()?;
        if state.window.len() < WINDOW_SAMPLES {
            return None;
        }
        Some((
            state.window.iter().copied().collect(),
            state.sample_rate,
            state.written,
        ))
    }
}

/*
 * A `Source` decorator: it forwards every sample untouched and copies a mono
 * downmix into the tap on the way past.
 *
 * Downmixing needs whole frames, so the accumulator resets once `channels`
 * samples have been seen. Averaging (rather than taking the first channel) keeps
 * a hard-panned mix from reading as silence.
 */
pub struct TappedSource<S> {
    inner: S,
    tap: Arc<SampleTap>,
    channels: u16,
    position_in_frame: u16,
    frame_sum: f32,
}

impl<S: Source> TappedSource<S> {
    pub fn new(inner: S, tap: Arc<SampleTap>) -> Self {
        let channels = inner.channels().max(1);
        tap.set_sample_rate(inner.sample_rate());
        Self {
            inner,
            tap,
            channels,
            position_in_frame: 0,
            frame_sum: 0.0,
        }
    }
}

impl<S: Source> Iterator for TappedSource<S> {
    type Item = rodio::Sample;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.inner.next()?;
        self.frame_sum += sample;
        self.position_in_frame += 1;

        if self.position_in_frame >= self.channels {
            self.tap.push(self.frame_sum / f32::from(self.channels));
            self.position_in_frame = 0;
            self.frame_sum = 0.0;
        }

        Some(sample)
    }
}

impl<S: Source> Source for TappedSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.inner.current_span_len()
    }

    fn channels(&self) -> ChannelCount {
        self.inner.channels()
    }

    fn sample_rate(&self) -> SampleRate {
        self.inner.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }

    /*
     * Forwarded, and not optional.
     *
     * `Source::try_seek` has a default that reports "not supported", and leaving
     * the decorator on that default made every file unseekable: dragging the
     * progress bar failed with
     *
     *     Seeking is not supported by source: ...TappedSource<Decoder<...>>
     *
     * and the UI, reading `AppError::Unplayable`, told people their file could
     * not be played. Nothing is wrong with the file — the decorator simply
     * swallowed the ability of the decoder underneath it.
     */
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.inner.try_seek(pos)?;

        // A seek lands on a frame boundary, so drop whatever partial frame was
        // in flight rather than averaging samples from either side of the jump.
        self.position_in_frame = 0;
        self.frame_sum = 0.0;

        Ok(())
    }
}

/// Ships a window of samples to the UI on a fixed cadence.
pub fn spawn_spectrum_emitter(app: tauri::AppHandle) -> Result<(), AppError> {
    std::thread::Builder::new()
        .name("yoyomusic-spectrum".into())
        .spawn(move || {
            let mut last_written = 0;
            loop {
                std::thread::sleep(FRAME_INTERVAL);

                let tap = app.state::<AppState>().spectrum.clone();
                let Some((samples, sample_rate, written)) = tap.snapshot() else {
                    continue;
                };

                // Nothing new since the last frame: the player is paused or
                // stopped, and repeating the same audio would just waste IPC.
                if written == last_written {
                    continue;
                }
                last_written = written;

                let _ = app.emit(
                    SPECTRUM_FRAME,
                    SpectrumFrame {
                        samples,
                        sample_rate,
                    },
                );
            }
        })
        .map(|_| ())
        .map_err(|err| AppError::StorageFailed(err.to_string()))
}

#[cfg(test)]
mod tests {
    use std::{
        sync::{Arc, Mutex},
        time::Duration,
    };

    use rodio::{
        buffer::SamplesBuffer,
        source::SeekError,
        ChannelCount, SampleRate, Source,
    };

    use super::{SampleTap, TappedSource, WINDOW_SAMPLES};

    fn tap_of<S: Source>(source: S) -> std::sync::Arc<SampleTap> {
        let tap = SampleTap::new();
        let tapped = TappedSource::new(source, tap.clone());
        // Drain it, as the mixer would.
        for _ in tapped {}
        tap
    }

    /// A mono buffer of exactly one window, with `head` written over the front.
    fn windowed_mono(head: &[f32]) -> Vec<f32> {
        let mut data = vec![0.0; WINDOW_SAMPLES];
        data[..head.len()].copy_from_slice(head);
        data
    }

    #[test]
    fn forwards_every_sample_untouched() {
        let source = SamplesBuffer::new(2, 44_100, vec![0.25, -0.25, 0.5, -0.5]);
        let tap = SampleTap::new();
        let forwarded: Vec<f32> = TappedSource::new(source, tap).collect();

        // The tap must not alter the audio the user hears.
        assert_eq!(forwarded, vec![0.25, -0.25, 0.5, -0.5]);
    }

    #[test]
    fn downmixes_interleaved_channels_to_mono() {
        /*
         * Stereo pairs: (1.0, 0.0) and (0.0, 1.0) average to 0.5 each. Taking
         * only the first channel would read the second frame as silence.
         *
         * Padded to a full window because that is what `snapshot` reports — the
         * FFT needs a fixed-length window, so a partial one is not usable.
         */
        let mut data = vec![0.0; WINDOW_SAMPLES * 2];
        data[0] = 1.0;
        data[1] = 0.0;
        data[2] = 0.0;
        data[3] = 1.0;

        let source = SamplesBuffer::new(2, 44_100, data);
        let tap = tap_of(source);

        let (samples, _, _) = tap.snapshot().expect("a full window is available");
        assert_eq!(samples.len(), WINDOW_SAMPLES);
        assert!((samples[0] - 0.5).abs() < f32::EPSILON);
        assert!((samples[1] - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn reports_the_stream_sample_rate() {
        let source = SamplesBuffer::new(1, 48_000, windowed_mono(&[]));
        let tap = tap_of(source);

        let (_, sample_rate, _) = tap.snapshot().expect("a full window is available");
        assert_eq!(sample_rate, 48_000);
    }

    #[test]
    fn window_is_empty_until_it_has_filled_once() {
        let source = SamplesBuffer::new(1, 44_100, vec![0.5; WINDOW_SAMPLES - 1]);
        let tap = tap_of(source);

        assert!(tap.snapshot().is_none(), "a short window must not be reported");
    }

    #[test]
    fn keeps_only_the_most_recent_window() {
        let source = SamplesBuffer::new(1, 44_100, vec![0.5; WINDOW_SAMPLES + 100]);
        let tap = tap_of(source);

        let (samples, _, written) = tap.snapshot().unwrap();
        assert_eq!(samples.len(), WINDOW_SAMPLES);
        assert_eq!(written, (WINDOW_SAMPLES + 100) as u64);
    }

    #[test]
    fn clamps_non_finite_samples() {
        // A NaN reaching the FFT would turn every bin into NaN, blanking the
        // whole visualiser rather than one bar.
        let source = SamplesBuffer::new(1, 44_100, {
            let mut data = vec![0.5; WINDOW_SAMPLES];
            data[0] = f32::NAN;
            data[1] = f32::INFINITY;
            data
        });
        let tap = tap_of(source);

        let (samples, _, _) = tap.snapshot().unwrap();
        assert_eq!(samples[0], 0.0);
        assert_eq!(samples[1], 0.0);
        assert!(samples.iter().all(|sample| sample.is_finite()));
    }

    /// A source that records the seeks it was asked to perform.
    ///
    /// `SamplesBuffer` does support seeking, so it can prove the decorator does
    /// not *break* seeking — but not that the position arrives intact, nor that
    /// a refusal is passed back up rather than swallowed.
    struct SeekSpy {
        samples: std::vec::IntoIter<f32>,
        channels: u16,
        seeks: Arc<Mutex<Vec<Duration>>>,
        refuses: bool,
    }

    impl SeekSpy {
        fn new(samples: Vec<f32>, channels: u16) -> (Self, Arc<Mutex<Vec<Duration>>>) {
            let seeks = Arc::new(Mutex::new(Vec::new()));
            (
                Self {
                    samples: samples.into_iter(),
                    channels,
                    seeks: seeks.clone(),
                    refuses: false,
                },
                seeks,
            )
        }

        fn refusing(mut self) -> Self {
            self.refuses = true;
            self
        }
    }

    impl Iterator for SeekSpy {
        type Item = f32;

        fn next(&mut self) -> Option<f32> {
            self.samples.next()
        }
    }

    impl Source for SeekSpy {
        fn current_span_len(&self) -> Option<usize> {
            None
        }

        fn channels(&self) -> ChannelCount {
            self.channels
        }

        fn sample_rate(&self) -> SampleRate {
            44_100
        }

        fn total_duration(&self) -> Option<Duration> {
            None
        }

        fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
            if self.refuses {
                return Err(SeekError::NotSupported { underlying_source: "SeekSpy" });
            }
            self.seeks.lock().unwrap().push(pos);
            Ok(())
        }
    }

    #[test]
    fn forwards_seek_to_the_source_it_wraps() {
        /*
         * Regression: the decorator did not implement `try_seek` at all, so it
         * inherited the default that reports "not supported" and every file
         * became unseekable. Dragging the progress bar surfaced it as
         * "file is unplayable: seek failed: Seeking is not supported by source:
         * ...TappedSource<...>".
         */
        let (source, seeks) = SeekSpy::new(vec![0.0; WINDOW_SAMPLES], 1);
        let tap = SampleTap::new();
        let mut tapped = TappedSource::new(source, tap);

        tapped
            .try_seek(Duration::from_millis(4_200))
            .expect("the decorator must not refuse a seek its source supports");

        assert_eq!(*seeks.lock().unwrap(), vec![Duration::from_millis(4_200)]);
    }

    #[test]
    fn reports_a_refusal_from_the_source_instead_of_swallowing_it() {
        // The position must not silently disagree with where the audio actually
        // is, so a real refusal has to travel back up.
        let (source, _) = SeekSpy::new(vec![0.0; 8], 1);
        let mut tapped = TappedSource::new(source.refusing(), SampleTap::new());

        assert!(tapped.try_seek(Duration::from_secs(1)).is_err());
    }

    #[test]
    fn seeking_between_frames_does_not_average_across_the_jump() {
        /*
         * The tap downmixes one frame at a time, accumulating across `next`
         * calls. Seeking in the middle of a frame used to leave that partial
         * frame in place, so the first mono sample after the jump mixed audio
         * from both sides of it.
         *
         * Values are chosen so the two behaviours differ: the pre-seek sample is
         * 1.0 and every post-seek frame is (0.2, 0.6), which averages to 0.4. A
         * stale accumulator would instead push (1.0 + 0.2) / 2 = 0.6.
         */
        let mut data = vec![1.0];
        data.extend(std::iter::repeat([0.2, 0.6]).take(WINDOW_SAMPLES).flatten());

        let (source, _) = SeekSpy::new(data, 2);
        let tap = SampleTap::new();
        let mut tapped = TappedSource::new(source, tap.clone());

        // Leave a partial frame in flight, then jump.
        tapped.next().expect("the first sample");
        tapped.try_seek(Duration::from_secs(1)).expect("seek");

        for _ in tapped {}

        let (samples, _, _) = tap.snapshot().expect("a full window is available");
        assert!(
            (samples[0] - 0.4).abs() < 1e-6,
            "first mono sample after the seek was {} — the partial frame leaked across it",
            samples[0],
        );
    }

    #[test]
    fn seeking_keeps_seeking_beyond_the_end_working() {
        // `SamplesBuffer` clamps; the decorator must not turn that into an error
        // or change the position it forwards.
        let source = SamplesBuffer::new(1, 44_100, vec![0.5; WINDOW_SAMPLES * 2]);
        let mut tapped = TappedSource::new(source, SampleTap::new());

        assert!(tapped.try_seek(Duration::from_secs(30)).is_ok());
    }
}
