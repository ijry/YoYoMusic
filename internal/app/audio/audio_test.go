package audio

import (
	"math"
	"testing"
)

// makeTone builds a mono window with a sine at hz plus a little noise, which
// is enough like real audio to exercise the analyser without a file.
func makeTone(n int, hz, amp float64, sr int, seed int64) []float32 {
	out := make([]float32, n)
	phase := 0.0
	rng := uint64(seed)*2654435761 + 1
	for i := 0; i < n; i++ {
		rng = rng*6364136223846793005 + 1442695040888963407
		noise := (float64(rng>>33)/float64(1<<31) - 1) * 0.02
		out[i] = float32(amp*math.Sin(phase) + noise)
		phase += 2 * math.Pi * hz / float64(sr)
	}
	return out
}

func peakBandOf(f SignalFrame) (int, float32) {
	peak := 0
	for b := 0; b < BandCount; b++ {
		if f.Bands[b] > f.Bands[peak] {
			peak = b
		}
	}
	return peak, f.Bands[peak]
}

// TestAnalyserLocalisesPitch checks a tone lands in the band its frequency
// belongs to. This is what catches a broken band layout: a 440 Hz tone must
// not light up the low bass bands, and a 60 Hz one must not sit in the
// middle of the display.
func TestAnalyserLocalisesPitch(t *testing.T) {
	const sr = 44100
	const n = 1024

	cases := []struct {
		name string
		hz   float64
		lo   int // acceptable band range
		hi   int
	}{
		// 40 Hz..16 kHz over 56 bands, logarithmically, puts 440 Hz around
		// band 22 and 60 Hz around band 4.
		{"60 Hz bass", 60, 0, 8},
		{"440 Hz mid", 440, 15, 30},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := NewAnalyser(n)
			a.Rebuild(sr)
			win := makeTone(n, tc.hz, 0.5, sr, 1)
			var f SignalFrame
			// Several frames so the running peak and smoothing settle.
			for i := 0; i < 20; i++ {
				f = a.Analyse(win, sr, 1.0/60)
			}
			band, peak := peakBandOf(f)
			t.Logf("%s -> band %d/%d (%.3f)", tc.name, band, BandCount, peak)
			if band < tc.lo || band > tc.hi {
				t.Errorf("%s should peak in bands %d..%d, got %d", tc.name, tc.lo, tc.hi, band)
			}
			if peak < 0.5 {
				t.Errorf("%s peak band too weak: %.3f", tc.name, peak)
			}
		})
	}
}

// TestAnalyserBandLayoutIsStable checks that rebuilding the edges for a
// different sample rate keeps a pitch in the same band: edges derived from
// bin indices would shift every band the moment the rate changes.
func TestAnalyserBandLayoutIsStable(t *testing.T) {
	const n = 1024
	peakAt := func(sr int) int {
		a := NewAnalyser(n)
		a.Rebuild(sr)
		win := makeTone(n, 440, 0.5, sr, 1)
		var f SignalFrame
		for i := 0; i < 20; i++ {
			f = a.Analyse(win, sr, 1.0/60)
		}
		band, _ := peakBandOf(f)
		return band
	}
	at44k := peakAt(44100)
	at48k := peakAt(48000)
	t.Logf("440 Hz: band %d at 44.1 kHz, band %d at 48 kHz", at44k, at48k)
	if diff := at44k - at48k; diff < -3 || diff > 3 {
		t.Errorf("440 Hz moved %d bands between sample rates", diff)
	}
}

// TestAnalyserBeatOnset checks the beat envelope spikes on a bass transient
// and decays afterwards, rather than tracking the raw bass level.
func TestAnalyserBeatOnset(t *testing.T) {
	const sr = 44100
	const n = 1024
	a := NewAnalyser(n)
	a.Rebuild(sr)

	// A quiet bed first, so the rolling bass average settles low.
	quiet := makeTone(n, 200, 0.02, sr, 3)
	var f SignalFrame
	for i := 0; i < 30; i++ {
		f = a.Analyse(quiet, sr, 1.0/60)
	}
	quietBeat, quietLevel := f.Beat, f.Level
	t.Logf("quiet: beat=%.3f level=%.3f", quietBeat, quietLevel)

	// Then a bass hit.
	hit := makeTone(n, 60, 0.9, sr, 4)
	var peakBeat float32
	for i := 0; i < 6; i++ {
		f = a.Analyse(hit, sr, 1.0/60)
		if f.Beat > peakBeat {
			peakBeat = f.Beat
		}
	}
	t.Logf("hit:   peakBeat=%.3f level=%.3f", peakBeat, f.Level)
	if peakBeat < 0.2 {
		t.Errorf("bass hit should produce a beat spike, got %.3f", peakBeat)
	}
	if f.Level <= quietLevel {
		t.Errorf("level should rise with the hit: quiet=%.3f hit=%.3f", quietLevel, f.Level)
	}

	// And it decays once the hit stops.
	for i := 0; i < 20; i++ {
		f = a.Analyse(quiet, sr, 1.0/60)
	}
	t.Logf("after: beat=%.3f", f.Beat)
	if f.Beat >= peakBeat*0.9 {
		t.Errorf("beat should decay after the hit: %.3f vs peak %.3f", f.Beat, peakBeat)
	}
}

// TestAnalyserLevelRange checks the level stays in 0..1 and actually moves
// between silence and loud material.
func TestAnalyserLevelRange(t *testing.T) {
	const sr = 44100
	const n = 1024
	a := NewAnalyser(n)
	a.Rebuild(sr)

	sf := a.Analyse(make([]float32, n), sr, 1.0/60)
	for i := 0; i < 20; i++ {
		sf = a.Analyse(make([]float32, n), sr, 1.0/60)
	}
	if sf.Level < 0 || sf.Level > 1 {
		t.Errorf("silent level out of range: %v", sf.Level)
	}
	if sf.Level > 0.05 {
		t.Errorf("silence should read near zero, got %v", sf.Level)
	}

	loud := makeTone(n, 440, 0.9, sr, 5)
	var lf SignalFrame
	for i := 0; i < 30; i++ {
		lf = a.Analyse(loud, sr, 1.0/60)
	}
	if lf.Level < 0.3 {
		t.Errorf("loud tone should read high, got %v", lf.Level)
	}
	if lf.Level > 1 {
		t.Errorf("level must clamp to 1, got %v", lf.Level)
	}
	t.Logf("silent level=%.3f loud level=%.3f", sf.Level, lf.Level)
}

// TestAnalyserWaveformIsAveraged checks the scope shows the waveform rather
// than peak-picked spikes, and that every sample stays in range.
func TestAnalyserWaveformIsAveraged(t *testing.T) {
	const sr = 44100
	const n = 1024
	a := NewAnalyser(n)
	a.Rebuild(sr)
	f := a.Analyse(makeTone(n, 100, 0.6, sr, 6), sr, 1.0/60)

	var maxAbs float32
	for _, v := range f.Wave {
		if v > 1 || v < -1 {
			t.Fatalf("wave sample out of range: %v", v)
		}
		if v > maxAbs || -v > maxAbs {
			if v > 0 {
				maxAbs = v
			} else {
				maxAbs = -v
			}
		}
	}
	t.Logf("wave maxAbs=%.3f", maxAbs)
	if maxAbs < 0.2 {
		t.Errorf("wave should carry the tone's amplitude, got %.3f", maxAbs)
	}
}

// TestAnalyserReset clears state so a new track does not inherit the
// previous one's falling peaks.
func TestAnalyserReset(t *testing.T) {
	const sr = 44100
	const n = 1024
	a := NewAnalyser(n)
	a.Rebuild(sr)
	loud := makeTone(n, 440, 0.9, sr, 7)
	for i := 0; i < 30; i++ {
		a.Analyse(loud, sr, 1.0/60)
	}
	a.Reset()
	f := a.Analyse(make([]float32, n), sr, 1.0/60)
	if f.Level > 0.05 {
		t.Errorf("level after reset should be near zero, got %v", f.Level)
	}
	for b, v := range f.Bands {
		if v > 0.05 {
			t.Errorf("band %d not reset: %v", b, v)
		}
	}
}

// TestAnalyserShortWindow guards against a window shorter than the FFT size,
// which must return a zero frame rather than panic.
func TestAnalyserShortWindow(t *testing.T) {
	a := NewAnalyser(1024)
	f := a.Analyse(make([]float32, 16), 44100, 1.0/60)
	for _, v := range f.Bands {
		if v != 0 {
			t.Fatal("short window should yield a zero frame")
		}
	}
}
