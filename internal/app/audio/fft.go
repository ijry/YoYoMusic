package audio

import "math"

// BandCount matches the original visualiser's spectral resolution.
const BandCount = 56

// WaveSamples is the oscilloscope resolution.
const WaveSamples = 256

// SignalFrame is the analysed audio snapshot fed to the visualiser, identical
// in shape to the original YoYoMusic frame so the draw code is portable.
type SignalFrame struct {
	Bands [BandCount]float32
	Wave  [WaveSamples]float32
	Level float32
	Beat  float32
}

// FFT is an iterative radix-2 transform over real input (imaginary zero).
func FFT(re, im []float64) {
	n := len(re)
	if n < 2 {
		return
	}
	// bit reversal
	j := 1
	for i := 0; i < n-1; i++ {
		if i < j {
			re[i], re[j] = re[j], re[i]
			im[i], im[j] = im[j], im[i]
		}
		m := n >> 1
		for j > m {
			j -= m
			m >>= 1
		}
		j += m
	}
	// butterflies
	for l := 2; l <= n; l <<= 1 {
		ang := -2 * math.Pi / float64(l)
		wpr := math.Cos(ang)
		wpi := math.Sin(ang)
		for i := 0; i < n; i += l {
			wr := 1.0
			wi := 0.0
			for k := 0; k < l/2; k++ {
				a := i + k
				b := i + k + l/2
				xr := re[b]*wr - im[b]*wi
				xi := re[b]*wi + im[b]*wr
				re[b] = re[a] - xr
				im[b] = im[a] - xi
				re[a] += xr
				im[a] += xi
				wk := wr
				wr = wr*wpr - wi*wpi
				wi = wk*wpi + wi*wpr
			}
		}
	}
}

// Analyser turns windows of mono samples into a SignalFrame.
//
// The band layout, normalisation and onset detection mirror the original
// YoYoMusic analyser so the two versions look the same. Three details matter
// most:
//
//   - Band edges are derived from frequency, not bin indices, so a change of
//     window size or sample rate cannot move a pitch to a different bar.
//   - Magnitudes are normalised against a slowly decaying running peak, then
//     log-compressed. A fixed divisor leaves the display pinned to the floor
//     on quiet material and pegged to the top on loud material.
//   - The beat is an onset: bass energy exceeding its own rolling average,
//     snapped up and then decayed, rather than the raw bass level.
type Analyser struct {
	size  int
	re    []float64
	im    []float64
	hann  []float64
	edges []int // BandCount+1 bin edges, in FFT bin indices

	// bandPeak decays slowly so the display does not pump on every transient.
	bandPeak float64
	// bassMean is the rolling bass energy the onset test compares against.
	bassMean float64

	// smooth carries attack/release so the bars move like the original:
	// fast on the way up, slow on the way down, which is what stops the
	// display strobing on every transient.
	smooth [BandCount]float32
	level  float32
	beat   float32
}

// NewAnalyser builds an analyser with a window of the given power-of-two size.
func NewAnalyser(windowSize int) *Analyser {
	a := &Analyser{
		size:  windowSize,
		re:    make([]float64, windowSize),
		im:    make([]float64, windowSize),
		hann:  make([]float64, windowSize),
		edges: make([]int, BandCount+1),
	}
	for i := 0; i < windowSize; i++ {
		a.hann[i] = 0.5 - 0.5*math.Cos(2*math.Pi*float64(i)/float64(windowSize))
	}
	a.rebuildEdges(44100)
	return a
}

// Rebuild recomputes the band edges for a sample rate and clears the
// smoothing state, for a track encoded at a different rate.
func (a *Analyser) Rebuild(sampleRate int) {
	if sampleRate > 0 {
		a.rebuildEdges(sampleRate)
	}
	a.Reset()
}

// rebuildEdges lays the log-spaced band edges out in bin indices for a sample
// rate. Edges are computed from frequency so the layout is stable across
// devices that hand back different window lengths.
func (a *Analyser) rebuildEdges(sampleRate int) {
	bins := a.size / 2
	if bins < 1 {
		return
	}
	binHz := float64(sampleRate) / float64(a.size)
	if binHz <= 0 {
		binHz = 1
	}
	nyquist := float64(bins) * binHz
	// Below the lowest bin there is nothing to read, so start at the first one.
	minHz := math.Max(40, binHz)
	maxHz := math.Max(minHz*2, math.Min(16000, nyquist))
	ratio := math.Log(maxHz / minHz)
	for i := 0; i <= BandCount; i++ {
		hz := minHz * math.Exp(ratio*float64(i)/float64(BandCount))
		idx := int(math.Round(hz / binHz))
		if idx > bins {
			idx = bins
		}
		if idx < 0 {
			idx = 0
		}
		a.edges[i] = idx
	}
	// Edges stay non-decreasing, never forced apart. A short window cannot
	// resolve the bottom of the range: at 44.1 kHz with 1024 samples one bin
	// spans 43 Hz, so the lowest bands all land on the same bin. Forcing them
	// apart steals bins from the top and compresses the display into its left
	// third; letting the low bands share a bin keeps the bass readable.
}

const (
	bassHz     = 150.0 // below this counts as "the bass", which drives the beat
	beatRatio  = 1.35  // how far above its own average bass must spike
	peakDecay  = 0.94  // running-peak decay per frame
	attackRate = 26.0  // bar rise speed (1/s)
	releaseRat = 7.0   // bar fall speed (1/s)
	levelGain  = 3.2   // RMS lift: music sits well below full scale
)

// Analyse converts a window of mono samples into a frame of bands, waveform,
// level and beat. dt is the seconds since the previous call and drives the
// attack/release smoothing and the peak decay.
func (a *Analyser) Analyse(mono []float32, sampleRate int, dt float32) SignalFrame {
	var f SignalFrame
	n := a.size
	if len(mono) < n || n < 2 {
		return f
	}
	if dt <= 0 || dt > 0.25 {
		dt = 1.0 / 30
	}

	// Windowed FFT.
	for i := 0; i < n; i++ {
		a.re[i] = float64(mono[i]) * a.hann[i]
		a.im[i] = 0
	}
	FFT(a.re, a.im)

	bins := n / 2
	binHz := float64(sampleRate) / float64(n)
	if binHz <= 0 {
		binHz = 1
	}

	// Fold the bins into log bands.
	var raw [BandCount]float64
	for b := 0; b < BandCount; b++ {
		from := a.edges[b]
		if from > bins-1 {
			from = bins - 1
		}
		to := a.edges[b+1]
		if to < from+1 {
			to = from + 1
		}
		if to > bins {
			to = bins
		}
		var sum float64
		for k := from; k < to; k++ {
			sum += math.Hypot(a.re[k], a.im[k])
		}
		raw[b] = sum / float64(to-from)
	}

	// Normalise against the running peak, then log-compress so quiet detail
	// stays visible instead of being squashed into the first couple of bars.
	var framePeak float64
	for b := 0; b < BandCount; b++ {
		if raw[b] > framePeak {
			framePeak = raw[b]
		}
	}
	a.bandPeak = math.Max(framePeak, a.bandPeak*peakDecay)
	if a.bandPeak < 1e-4 {
		a.bandPeak = 1e-4
	}
	attack := 1 - math.Exp(-float64(dt)*attackRate)
	release := 1 - math.Exp(-float64(dt)*releaseRat)
	var sum float32
	for b := 0; b < BandCount; b++ {
		ratio := raw[b] / a.bandPeak
		norm := math.Log1p(ratio*9) / math.Log(10)
		if norm > 1 {
			norm = 1
		}
		target := float32(norm)
		if target > a.smooth[b] {
			a.smooth[b] += float32(attack) * (target - a.smooth[b])
		} else {
			a.smooth[b] += float32(release) * (target - a.smooth[b])
		}
		f.Bands[b] = a.smooth[b]
		sum += a.smooth[b]
	}

	// Oscilloscope: average the window down to WaveSamples, which is what a
	// scope shows, rather than peak-picking (which inflates every spike).
	stride := float64(n) / float64(WaveSamples)
	var sumSquares float64
	for i := 0; i < WaveSamples; i++ {
		start := int(float64(i) * stride)
		end := int(float64(i+1) * stride)
		if end <= start {
			end = start + 1
		}
		if end > n {
			end = n
		}
		var s float64
		for k := start; k < end; k++ {
			s += float64(mono[k])
		}
		v := s / float64(end-start)
		if v > 1 {
			v = 1
		} else if v < -1 {
			v = -1
		}
		f.Wave[i] = float32(v)
		sumSquares += v * v
	}

	// Level from RMS, lifted because speech and music sit well below 1.0.
	rms := math.Sqrt(sumSquares / WaveSamples)
	a.level += (float32(math.Min(1, rms*levelGain)) - a.level) * float32(1-math.Exp(-float64(dt)*9))
	f.Level = a.level

	// Beat: bass energy above its own rolling average is an onset. Snapping
	// up on the onset and decaying afterwards gives the kick its shape.
	bassBins := int(math.Round(bassHz / binHz))
	if bassBins < 1 {
		bassBins = 1
	}
	if bassBins > bins-1 {
		bassBins = bins - 1
	}
	var bass float64
	for i := 1; i <= bassBins; i++ {
		bass += math.Hypot(a.re[i], a.im[i])
	}
	bass /= float64(bassBins)
	if a.bassMean == 0 {
		a.bassMean = bass
	} else {
		a.bassMean = a.bassMean*0.92 + bass*0.08
	}
	threshold := a.bassMean * beatRatio
	var onset float64
	if a.bassMean > 1e-5 && bass > threshold {
		onset = (bass - threshold) / threshold
	}
	if onset > 0 {
		if onset > 1 {
			onset = 1
		}
		a.beat = float32(onset)
	} else {
		a.beat *= float32(math.Exp(-float64(dt) * 7))
	}
	f.Beat = a.beat

	return f
}

// Reset clears the smoothing state so a new track does not start with the
// previous one's peaks still falling.
func (a *Analyser) Reset() {
	a.bandPeak = 0
	a.bassMean = 0
	a.level = 0
	a.beat = 0
	for i := range a.smooth {
		a.smooth[i] = 0
	}
}
