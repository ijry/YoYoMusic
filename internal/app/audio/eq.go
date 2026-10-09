package audio

import "math"

// eqCenters are the centre frequencies of the ten graphic-EQ bands (ISO
// octave spacing).
var eqCenters = [10]float64{31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000}

// eqQ is the quality factor of each peaking band. 1.414 gives a one-octave
// bandwidth so adjacent bands meet near -3 dB, the usual graphic-EQ shape.
const eqQ = 1.4142135623730951

// biquad is a single Direct Form I second-order section. z1/z2 are the
// delay-line state shared across calls.
type biquad struct {
	b0, b1, b2, a1, a2 float64
}

// EQ is a ten-band peaking graphic equaliser implemented as ten cascaded
// RBJ biquads, one filter chain per channel.
type EQ struct {
	sr      int
	enabled bool
	bands   [10]float64
	coeffs  [10]biquad
	// state holds the z1/z2 history per (band, channel); length channels*10*2.
	state []float64
}

// NewEQ builds an equaliser for the given sample rate. The bands start at
// 0 dB (flat) and disabled.
func NewEQ(sr int) *EQ {
	e := &EQ{sr: sr, bands: [10]float64{0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}
	e.rebuild()
	return e
}

// Update replaces the band gains (dB) and enabled flag, recomputing the
// filter coefficients. channels tells how many interleaved channels the
// processed buffers carry, so per-channel state can be (re)allocated.
func (e *EQ) Update(bands [10]float64, enabled bool, channels int) {
	e.bands = bands
	e.enabled = enabled
	e.rebuild()
	if channels > 0 {
		e.state = make([]float64, channels*10*2)
	}
}

func (e *EQ) rebuild() {
	for i, f := range eqCenters {
		e.coeffs[i] = designPeaking(f, float64(e.sr), e.bands[i], eqQ)
	}
}

// designPeaking returns RBJ peaking-filter coefficients normalised so a0=1.
func designPeaking(f0, sr, dbGain, q float64) biquad {
	if sr <= 0 {
		return biquad{}
	}
	a := math.Pow(10, dbGain/40)
	w0 := 2 * math.Pi * f0 / sr
	alpha := math.Sin(w0) / (2 * q)
	cw := math.Cos(w0)
	b0 := 1 + alpha*a
	b1 := -2 * cw
	b2 := 1 - alpha*a
	a0 := 1 + alpha/a
	a1 := -2 * cw
	a2 := 1 - alpha/a
	return biquad{
		b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
		a1: a1 / a0, a2: a2 / a0,
	}
}

// Process applies the equaliser in place to an interleaved float buffer
// (one float per sample, channels interleaved). When disabled, or before
// Update has allocated channel state, it does nothing. Samples are expected
// roughly in [-1, 1]; output is soft-clamped to [-4, 4].
//
// Each band is a Direct Form I biquad:
//
//	y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
func (e *EQ) Process(samples []float32, channels int) {
	if !e.enabled || channels <= 0 || e.sr <= 0 {
		return
	}
	if len(e.state) < channels*10*4 {
		e.state = make([]float64, channels*10*4)
	}
	for ch := 0; ch < channels; ch++ {
		for band := 0; band < 10; band++ {
			bq := &e.coeffs[band]
			base := (band*channels + ch) * 4
			x1 := e.state[base]
			x2 := e.state[base+1]
			y1 := e.state[base+2]
			y2 := e.state[base+3]
			for i := ch; i < len(samples); i += channels {
				x := float64(samples[i])
				y := bq.b0*x + bq.b1*x1 + bq.b2*x2 - bq.a1*y1 - bq.a2*y2
				x2 = x1
				x1 = x
				y2 = y1
				y1 = y
				if y > 4 {
					y = 4
				} else if y < -4 {
					y = -4
				}
				samples[i] = float32(y)
			}
			e.state[base] = x1
			e.state[base+1] = x2
			e.state[base+2] = y1
			e.state[base+3] = y2
		}
	}
}
