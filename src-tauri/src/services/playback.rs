use std::{fs::File, path::Path, time::Duration};

use rodio::{Decoder, OutputStream, OutputStreamBuilder, Sink, Source};

use crate::{
    errors::AppError,
    models::{PlayMode, PlaybackState, Track},
};

pub struct PlaybackService {
    state: PlaybackState,
    audio: Option<AudioBackend>,
}

struct AudioBackend {
    stream: OutputStream,
    sink: Option<Sink>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum PlaybackTick {
    Idle(PlaybackState),
    PositionChanged(PlaybackState),
    Finished(PlaybackState),
}

impl Default for PlaybackService {
    fn default() -> Self {
        Self::new_best_effort()
    }
}

impl PlaybackService {
    pub fn new_null() -> Self {
        Self {
            state: PlaybackState {
                track_id: None,
                position_ms: 0,
                duration_ms: 0,
                volume: 0.8,
                is_playing: false,
                is_muted: false,
                play_mode: PlayMode::Sequence,
                eq_enabled: false,
            },
            audio: None,
        }
    }

    pub fn new_best_effort() -> Self {
        Self::new_with_default_output().unwrap_or_else(|_| Self::new_null())
    }

    pub fn new_with_default_output() -> Result<Self, AppError> {
        let mut stream = OutputStreamBuilder::open_default_stream()
            .map_err(|err| AppError::Unplayable(format!("audio output unavailable: {err}")))?;
        stream.log_on_drop(false);

        Ok(Self {
            audio: Some(AudioBackend { stream, sink: None }),
            ..Self::new_null()
        })
    }

    pub fn current_state(&self) -> PlaybackState {
        let mut state = self.state.clone();
        if let Some(sink) = self.audio.as_ref().and_then(|audio| audio.sink.as_ref()) {
            state.position_ms = duration_to_ms(sink.get_pos()).min(state.duration_ms);
            if sink.empty() && state.track_id.is_some() {
                state.is_playing = false;
            }
        }
        state
    }

    pub fn tick(&mut self) -> PlaybackTick {
        let previous_position = self.state.position_ms;

        if self.state.track_id.is_none() || !self.state.is_playing {
            return PlaybackTick::Idle(self.current_state());
        }

        self.sync_position_from_sink();

        if self.current_sink_finished() {
            let state = self.stop_after_finished();
            return PlaybackTick::Finished(state);
        }

        let state = self.current_state();
        if state.position_ms != previous_position {
            PlaybackTick::PositionChanged(state)
        } else {
            PlaybackTick::Idle(state)
        }
    }

    pub fn play(&mut self, track: Track) -> Result<PlaybackState, AppError> {
        if !Path::new(&track.file_path).is_file() {
            return Err(AppError::FileMissing(track.file_path));
        }

        let effective_volume = self.effective_volume();
        let decoded_duration = if let Some(audio) = self.audio.as_mut() {
            audio.play_file(&track.file_path, effective_volume)?
        } else {
            None
        };

        self.state.track_id = Some(track.id);
        self.state.duration_ms = decoded_duration.unwrap_or(track.duration_ms);
        self.state.position_ms = 0;
        self.state.is_playing = true;
        Ok(self.current_state())
    }

    pub fn pause(&mut self) -> PlaybackState {
        self.sync_position_from_sink();
        if let Some(sink) = self.audio.as_ref().and_then(|audio| audio.sink.as_ref()) {
            sink.pause();
        }
        self.state.is_playing = false;
        self.current_state()
    }

    pub fn stop_after_finished(&mut self) -> PlaybackState {
        self.sync_position_from_sink();
        self.state.position_ms = self.state.duration_ms;
        self.state.is_playing = false;
        self.current_state()
    }

    pub fn toggle(&mut self) -> PlaybackState {
        self.sync_position_from_sink();
        if self.state.track_id.is_none() {
            return self.current_state();
        }

        self.state.is_playing = !self.state.is_playing;
        if let Some(sink) = self.audio.as_ref().and_then(|audio| audio.sink.as_ref()) {
            if self.state.is_playing {
                sink.play();
            } else {
                sink.pause();
            }
        }

        self.current_state()
    }

    pub fn seek(&mut self, position_ms: u64) -> Result<PlaybackState, AppError> {
        self.state.position_ms = position_ms.min(self.state.duration_ms);
        if let Some(sink) = self.audio.as_ref().and_then(|audio| audio.sink.as_ref()) {
            sink.try_seek(Duration::from_millis(self.state.position_ms))
                .map_err(|err| AppError::Unplayable(format!("seek failed: {err}")))?;
        }
        Ok(self.current_state())
    }

    pub fn set_volume(&mut self, volume: f32) -> PlaybackState {
        self.state.volume = volume.clamp(0.0, 1.0);
        self.apply_volume_to_sink();
        self.current_state()
    }

    pub fn set_muted(&mut self, is_muted: bool) -> PlaybackState {
        self.state.is_muted = is_muted;
        self.apply_volume_to_sink();
        self.current_state()
    }

    pub fn set_play_mode(&mut self, play_mode: PlayMode) -> PlaybackState {
        self.state.play_mode = play_mode;
        self.current_state()
    }

    fn sync_position_from_sink(&mut self) {
        if let Some(sink) = self.audio.as_ref().and_then(|audio| audio.sink.as_ref()) {
            self.state.position_ms = duration_to_ms(sink.get_pos()).min(self.state.duration_ms);
        }
    }

    fn apply_volume_to_sink(&self) {
        if let Some(sink) = self.audio.as_ref().and_then(|audio| audio.sink.as_ref()) {
            sink.set_volume(self.effective_volume());
        }
    }

    fn effective_volume(&self) -> f32 {
        if self.state.is_muted {
            0.0
        } else {
            self.state.volume
        }
    }

    fn current_sink_finished(&self) -> bool {
        self.audio
            .as_ref()
            .and_then(|audio| audio.sink.as_ref())
            .map(|sink| sink.empty())
            .unwrap_or(false)
    }
}

impl AudioBackend {
    fn play_file(&mut self, file_path: &str, volume: f32) -> Result<Option<u64>, AppError> {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }

        let file = File::open(file_path)
            .map_err(|err| AppError::FileMissing(format!("{file_path}: {err}")))?;
        let source = Decoder::try_from(file)
            .map_err(|err| AppError::Unplayable(format!("{file_path}: {err}")))?;
        let duration_ms = source.total_duration().map(duration_to_ms);

        let sink = Sink::connect_new(self.stream.mixer());
        sink.set_volume(volume);
        sink.append(source);
        self.sink = Some(sink);

        Ok(duration_ms)
    }
}

fn duration_to_ms(duration: Duration) -> u64 {
    duration.as_millis().min(u128::from(u64::MAX)) as u64
}

#[cfg(test)]
mod tests {
    use crate::{
        models::{TagStatus, Track, TrackStatus},
        services::playback::{PlaybackService, PlaybackTick},
    };

    #[cfg(test)]
    impl PlaybackService {
        fn set_state_for_test(
            &mut self,
            track_id: Option<String>,
            duration_ms: u64,
            position_ms: u64,
            is_playing: bool,
        ) {
            self.state.track_id = track_id;
            self.state.duration_ms = duration_ms;
            self.state.position_ms = position_ms;
            self.state.is_playing = is_playing;
        }
    }

    #[test]
    fn clamps_volume_between_zero_and_one() {
        let mut service = PlaybackService::new_null();
        assert_eq!(service.set_volume(1.2).volume, 1.0);
        assert_eq!(service.set_volume(-0.5).volume, 0.0);
    }

    #[test]
    fn toggle_flips_playing_state() {
        let mut service = PlaybackService::new_null();
        assert!(!service.current_state().is_playing);
        assert!(!service.toggle().is_playing);

        service.state.track_id = Some("track-1".into());
        assert!(service.toggle().is_playing);
        assert!(!service.toggle().is_playing);
    }

    #[test]
    fn play_rejects_missing_files() {
        let mut service = PlaybackService::new_null();
        let err = service.play(track("missing.mp3")).unwrap_err();
        assert!(err.to_string().contains("missing.mp3"));
    }

    #[test]
    fn stop_after_finished_marks_state_stopped_at_duration() {
        let mut service = PlaybackService::new_null();
        service.set_state_for_test(Some("track-1".into()), 2500, 1000, true);

        let state = service.stop_after_finished();

        assert_eq!(state.track_id.as_deref(), Some("track-1"));
        assert_eq!(state.position_ms, 2500);
        assert!(!state.is_playing);
    }

    #[test]
    fn tick_is_idle_when_not_playing() {
        let mut service = PlaybackService::new_null();
        service.set_state_for_test(Some("track-1".into()), 2500, 1000, false);

        let tick = service.tick();

        assert!(matches!(tick, PlaybackTick::Idle(state) if !state.is_playing));
    }

    fn track(file_path: &str) -> Track {
        Track {
            id: "track-1".into(),
            file_path: file_path.into(),
            title: "Track".into(),
            artist: String::new(),
            album: String::new(),
            duration_ms: 0,
            cover_art_ref: None,
            lyrics_ref: None,
            tag_status: TagStatus::Clean,
            status: TrackStatus::Ready,
        }
    }
}
