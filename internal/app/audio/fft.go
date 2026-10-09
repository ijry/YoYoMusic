package audio

import (
	"math"
)

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
type Analyser struct {
	size int
	re   []float64
	im   []float64
	hann []float64
}

// NewAnalyser builds an analyser with a window of the given power-of-two size.
func NewAnalyser(windowSize int) *Analyser {
	a := &Analyser{
		size: windowSize,
		re:   make([]float64, windowSize),
		im:   make([]float64, windowSize),
		hann: make([]float64, windowSize),
	}
	for i := 0; i < windowSize; i++ {
		a.hann[i] = 0.5 - 0.5*math.Cos(2*math.Pi*float64(i)/float64(windowSize))
	}
	return a
}

// Analyse converts a window of mono samples centred at the played position
// into a frame of bands + waveform. sampleRate is used to space the bands
// logarithmically. It returns the frame but does not smooth across calls; the
// engine keeps temporal smoothing.
func (a *Analyser) Analyse(mono []float32, sampleRate int) SignalFrame {
	var f SignalFrame
	n := a.size
	if len(mono) < n {
		return f
	}
	for i := 0; i < n; i++ {
		a.re[i] = float64(mono[i]) * a.hann[i]
		a.im[i] = 0
	}
	FFT(a.re, a.im)

	half := n / 2
	// log-spaced band edges from ~30 Hz to ~16 kHz.
	minF := 30.0
	maxF := 16000.0
	if sampleRate > 0 {
		if ny := float64(sampleRate) / 2; maxF > ny {
			maxF = ny * 0.95
		}
	}
	logMin := math.Log(minF)
	logMax := math.Log(maxF)
	for b := 0; b < BandCount; b++ {
		f0 := math.Exp(logMin + (logMax-logMin)*float64(b)/float64(BandCount))
		f1 := math.Exp(logMin + (logMax-logMin)*float64(b+1)/float64(BandCount))
		i0 := int(f0 / float64(sampleRate) * float64(n))
		i1 := int(f1 / float64(sampleRate) * float64(n))
		if i0 < 1 {
			i0 = 1
		}
		if i1 <= i0 {
			i1 = i0 + 1
		}
		if i1 > half {
			i1 = half
		}
		var sum, peak float64
		for k := i0; k < i1; k++ {
			v := math.Hypot(a.re[k], a.im[k])
			sum += v
			if v > peak {
				peak = v
			}
		}
		count := float64(i1 - i0)
		avg := sum / count
		// normalise: scale so a loud tone approaches 1.0
		norm := avg / (1.4 * math.Sqrt(count))
		if norm > 1 {
			norm = 1
		}
		// emphasise transients
		f.Bands[b] = float32(math.Pow(norm, 0.7))
	}

	// waveform: peak-pick the first n samples down to WaveSamples.
	stride := float64(n) / float64(WaveSamples)
	var wsum float64
	for i := 0; i < WaveSamples; i++ {
		start := int(float64(i) * stride)
		end := int(float64(i+1) * stride)
		if end <= start {
			end = start + 1
		}
		var pk float32
		for k := start; k < end && k < n; k++ {
			if mono[k] > pk {
				pk = mono[k]
			} else if -mono[k] > pk {
				pk = -mono[k]
			}
		}
		f.Wave[i] = pk
		wsum += float64(pk)
	}

	var lsum float64
	for b := 0; b < BandCount; b++ {
		lsum += float64(f.Bands[b])
	}
	f.Level = float32(lsum / float64(BandCount))
	low := (f.Bands[0] + f.Bands[1] + f.Bands[2]) / 3
	f.Beat = low
	return f
}
