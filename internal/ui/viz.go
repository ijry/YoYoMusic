// Package ui builds the native (GPU-drawn) interface for YoYoMusic with the
// mygo ui package. viz.go holds the six real-time audio visualisers, each
// drawing from an audio.SignalFrame onto a mygo Painter.
//
// The renderers mirror the original YoYoMusic canvas modes: the same palette
// use, the same peak-hold, waterfall history, particle field and aurora
// layering, so the two versions look alike.
package ui

import (
	"math"
	"math/rand"
	"time"

	"yoyomusic/internal/app"
	"yoyomusic/internal/app/audio"

	myui "github.com/egoist/mygo/ui"
)

// waterfallRows is the depth of the waterfall history ring buffer.
const waterfallRows = 72

// maxParticles caps the particle field so a long loud passage cannot grow it
// without bound.
const maxParticles = 420

// vizState holds the per-frame stateful effects. One instance per app, shared
// by every draw call, since there is only one visualiser canvas.
type vizState struct {
	peaks    [audio.BandCount]float32 // spectrum peak-hold caps
	falling  [audio.BandCount]bool    // whether each cap is falling
	water    [waterfallRows][audio.BandCount]float32
	waterH   int // ring buffer head
	waterN   int // rows filled so far
	waterClk float64
	rotation float64
	parts    []vizParticle
	partClk  float64
}

var viz = &vizState{}

// vizParticle is one point in the particle field.
type vizParticle struct {
	x, y, vx, vy  float32
	life, maxLife float32
	size, tone    float32
}

// drawSpectrum renders 56 vertical bars rising from a baseline, with a
// two-segment gradient, a reflection under the floor, and peak-hold caps that
// fall back down — the detail that makes a spectrum read as an instrument.
func drawSpectrum(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, dt float32) {
	n := audio.BandCount
	gap := float32(math.Max(1, float64(r.W/float32(n))*0.24))
	barW := float32(math.Max(1, float64(r.W-gap*float32(n-1))/float64(n)))
	floor := r.Y + r.H*0.86
	reach := floor - r.Y - 6
	radius := float32(math.Min(float64(barW)/2, 4))

	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	for i := 0; i < n; i++ {
		v := f.Bands[i]
		h := float32(math.Max(2, float64(v)*float64(reach)))
		x := r.X + float32(i)*(barW+gap)
		y := floor - h

		// The bar: accent at the bottom, primary through the middle, bright
		// ink at the top, so tall bars read brighter than short ones. mygo
		// gradients are two-stop, so the bar is drawn as two stacked
		// segments meeting at 55% of its height.
		mid := y + h*0.45
		if h > 4 {
			p.FillGradient(myui.Rect{X: x, Y: mid, W: barW, H: floor - mid},
				myui.LinearGradient{From: colB, To: colA, Angle: 180}, radius)
		}
		topH := h * 0.55
		if topH < 2 {
			topH = 2
		}
		p.FillGradient(myui.Rect{X: x, Y: y, W: barW, H: topH},
			myui.LinearGradient{From: colA, To: ink, Angle: 180}, radius)

		// Reflection under the floor keeps the deck feeling like glass.
		if h > 2 {
			p.FillGradient(myui.Rect{X: x, Y: floor + 2, W: barW, H: h * 0.35},
				myui.LinearGradient{From: colA.Alpha(0.20), To: colA.Alpha(0), Angle: 180},
				float32(math.Min(float64(barW)/2, 3)))
		}

		// Peak-hold cap: rides the bar up instantly, falls slowly.
		peak := viz.peaks[i]
		if v >= peak {
			peak = v
			viz.falling[i] = false
		} else {
			if !viz.falling[i] {
				viz.falling[i] = true
			}
			peak -= dt * 0.55
			if peak < v {
				peak = v
			}
		}
		if peak < 0 {
			peak = 0
		}
		viz.peaks[i] = peak

		capH := float32(math.Max(float64(peak)*float64(reach), float64(h)))
		capY := floor - capH - 4
		if capY > r.Y {
			p.Fill(myui.Rect{X: x, Y: capY, W: barW, H: 3}, ink.Alpha(0.95), 1.5)
		}
	}
}

// drawWaveform draws the oscilloscope trace over a faint grid, with a wide
// glow pass and a crisp gradient core on top.
func drawWaveform(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin) {
	n := audio.WaveSamples
	mid := r.Y + r.H/2
	amp := r.H * 0.36
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)
	step := r.W / float32(n-1)

	// Faint grid so the trace reads as an instrument.
	for line := 1; line < 4; line++ {
		y := r.Y + r.H*float32(line)/4
		p.Line(r.X, y, r.X+r.W, y, 1, colB.Alpha(0.12))
	}
	p.Line(r.X, mid, r.X+r.W, mid, 1, colB.Alpha(0.28))

	line := &myui.Path{}
	for i := 0; i < n; i++ {
		x := r.X + float32(i)*step
		y := mid - f.Wave[i]*amp
		if i == 0 {
			line.MoveTo(x, y)
		} else {
			line.LineTo(x, y)
		}
	}
	// A wide translucent pass stands in for the canvas shadowBlur glow.
	p.StrokePathGradient(line, 7, myui.LinearGradient{
		From: colB.Alpha(0.16), To: ink.Alpha(0.16), Angle: 90,
	})
	// Crisp core, gradient across the width like the original.
	p.StrokePathGradient(line, 2.4, myui.LinearGradient{
		From: colB, To: ink, Angle: 90,
	})
}

// drawRadial paints the spectrum as bars radiating from a glowing core that
// pulses with the beat. The whole ring rotates, faster when the music is loud.
func drawRadial(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, dt float32) {
	cx := r.X + r.W/2
	cy := r.Y + r.H/2
	minSide := float32(math.Min(float64(r.W), float64(r.H)))
	innerR := minSide * 0.16
	maxR := minSide * 0.44
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	viz.rotation += float64(dt) * (0.25 + float64(f.Level)*1.4)

	// Glowing core: brightens on the beat.
	coreR := innerR * (1.25 + f.Beat*0.4)
	core := myui.Rect{X: cx - coreR*1.5, Y: cy - coreR*1.5, W: coreR * 3, H: coreR * 3}
	p.FillGradient(core, myui.LinearGradient{From: ink.Alpha(0.35 + f.Beat*0.4), To: ink.Alpha(0), Angle: 0}, coreR*1.5)
	p.Fill(myui.Rect{X: cx - innerR*0.5, Y: cy - innerR*0.5, W: innerR, H: innerR}, colA.Alpha(0.35+f.Beat*0.4), innerR*0.5)

	// Ring outline.
	p.Stroke(myui.Rect{X: cx - innerR, Y: cy - innerR, W: innerR * 2, H: innerR * 2}, colB.Alpha(0.7), innerR, 1)

	n := audio.BandCount
	thickness := float32(math.Max(1.5, float64(2*math.Pi*innerR)/float64(n)*0.55))
	for i := 0; i < n; i++ {
		ang := float64(i)/float64(n)*2*math.Pi + viz.rotation - math.Pi/2
		v := f.Bands[i]
		length := innerR*0.25 + v*(maxR-innerR)
		ca := float32(math.Cos(ang))
		sa := float32(math.Sin(ang))
		x0 := cx + ca*innerR
		y0 := cy + sa*innerR
		x1 := cx + ca*(innerR+length)
		y1 := cy + sa*(innerR+length)
		c := colA.Mix(colB, float32(i)/float32(n))
		p.Line(x0, y0, x1, y1, thickness, c.Alpha(0.55+v*0.45))
	}
}

// drawParticles emits a burst from the centre and advances the field, with a
// halo behind and a pulsing core ring the burst reads against.
func drawParticles(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, dt float32) {
	cx := r.X + r.W/2
	cy := r.Y + r.H/2
	span := float32(math.Min(float64(r.W), float64(r.H)))
	emitR := span * 0.08
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	// Emission on a fixed cadence so the rate does not depend on frame rate.
	viz.partClk += float64(dt)
	const interval = 0.012
	for viz.partClk >= interval {
		viz.partClk -= interval
		spawn := 1
		if f.Beat > 0.4 {
			spawn = 5
		} else if f.Beat > 0.15 {
			spawn = 2
		}
		for s := 0; s < spawn; s++ {
			if len(viz.parts) >= maxParticles {
				break
			}
			ang := rand.Float64() * 2 * math.Pi
			speed := float32(55 + rand.Float64()*210*(0.4+float64(f.Level)))
			viz.parts = append(viz.parts, vizParticle{
				x:       cx + float32(math.Cos(ang))*emitR,
				y:       cy + float32(math.Sin(ang))*emitR,
				vx:      float32(math.Cos(ang)) * speed,
				vy:      float32(math.Sin(ang)) * speed,
				life:    0,
				maxLife: 1.1 + rand.Float32()*1.4,
				size:    1.4 + rand.Float32()*3.2,
				tone:    rand.Float32(),
			})
		}
	}

	// Halo behind everything.
	halo := myui.Rect{X: cx - span*0.34, Y: cy - span*0.34, W: span * 0.68, H: span * 0.68}
	p.FillGradient(halo, myui.LinearGradient{From: colA.Alpha(0.3 + f.Beat*0.4), To: colA.Alpha(0), Angle: 0}, span*0.34)

	// Pulsing core ring.
	ringR := emitR * (1.1 + f.Beat*0.5)
	p.Stroke(myui.Rect{X: cx - ringR, Y: cy - ringR, W: ringR * 2, H: ringR * 2}, ink.Alpha(0.75), ringR, 1.6)

	alive := viz.parts[:0]
	for i := range viz.parts {
		pt := &viz.parts[i]
		pt.life += dt
		if pt.life >= pt.maxLife {
			continue
		}
		pt.x += pt.vx * dt
		pt.y += pt.vy * dt
		pt.vx *= 1 - dt*1.1
		pt.vy *= 1 - dt*1.1
		prog := pt.life / pt.maxLife
		alpha := (1 - prog) * 0.95
		var c myui.Color
		switch {
		case pt.tone > 0.55:
			c = colA
		case pt.tone > 0.2:
			c = colB
		default:
			c = ink
		}
		rad := pt.size * (1 - prog*0.35)
		p.Fill(myui.Rect{X: pt.x - rad, Y: pt.y - rad, W: rad * 2, H: rad * 2}, c.Alpha(alpha), rad)
		alive = append(alive, *pt)
	}
	viz.parts = alive
}

// auroraLayer returns the y of a single aurora layer's centre line at x,
// which is a stack of sines displaced by the spectrum energy at that x.
func auroraY(x float32, r myui.Rect, f audio.SignalFrame, layer int, phase, amp float64) float32 {
	prog := float64(x-r.X) / float64(r.W)
	bandIdx := int(math.Round(prog * float64(audio.BandCount-1)))
	if bandIdx >= audio.BandCount {
		bandIdx = audio.BandCount - 1
	}
	if bandIdx < 0 {
		bandIdx = 0
	}
	energy := float64(f.Bands[bandIdx])
	centerY := r.Y + r.H*float32(layer)*0.14 + r.H*0.32
	return float32(float64(centerY) +
		math.Sin(prog*math.Pi*2*1.6+phase+float64(f.Beat)*2)*amp +
		math.Sin(prog*math.Pi*2*3.1-phase*0.6)*amp*0.45 +
		(energy-0.35)*float64(r.H)*0.22)
}

// drawAurora flows several wide soft bands across the canvas, each a sine
// stack displaced by the spectrum at that x, with a bright core line on top.
func drawAurora(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, now time.Time) {
	const layers = 4
	const segments = 96
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)
	colors := []myui.Color{colB, colA, ink, colA}
	t := float64(now.UnixNano()) / 1e9

	for layer := 0; layer < layers; layer++ {
		phase := float64(layer)*1.7 + t*0.25
		amp := float64(r.H) * (0.09 + float64(layer)*0.045) * (0.55 + float64(f.Level))

		// Fill: the band's outline closed down to the bottom edge, so it
		// reads as a curtain of light rather than a bare stroke.
		fill := &myui.Path{}
		for step := 0; step <= segments; step++ {
			x := r.X + r.W*float32(step)/float32(segments)
			y := auroraY(x, r, f, layer, phase, amp)
			if step == 0 {
				fill.MoveTo(x, y)
			} else {
				fill.LineTo(x, y)
			}
		}
		fill.LineTo(r.X+r.W, r.Y+r.H)
		fill.LineTo(r.X, r.Y+r.H)
		fill.Close()

		c := colors[layer%len(colors)]
		alpha := 0.16 + float32(layer)*0.07
		p.FillPathGradient(fill, myui.LinearGradient{
			From: colB.Alpha(alpha), To: c.Alpha(alpha), Angle: 90,
		})

		// Bright core line along the same outline.
		core := &myui.Path{}
		for step := 0; step <= segments; step++ {
			x := r.X + r.W*float32(step)/float32(segments)
			y := auroraY(x, r, f, layer, phase, amp)
			if step == 0 {
				core.MoveTo(x, y)
			} else {
				core.LineTo(x, y)
			}
		}
		p.StrokePathGradient(core, 2, myui.LinearGradient{
			From: ink.Alpha(0.5 - float32(layer)*0.08), To: ink.Alpha(0.2), Angle: 90,
		})
	}
}

// drawWaterfall renders the ring-buffered spectrum history as a heatmap that
// scrolls upward: a new row every ~22ms, newest at the bottom, mirrored about
// the centre so the curtain reads as one symmetric shape.
func drawWaterfall(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, dt float32) {
	n := audio.BandCount
	half := (n + 1) / 2

	viz.waterClk += float64(dt)
	if viz.waterClk >= 1.0/45.0 {
		viz.waterClk = 0
		viz.waterH = (viz.waterH + 1) % waterfallRows
		viz.water[viz.waterH] = f.Bands
		if viz.waterN < waterfallRows {
			viz.waterN++
		}
	}

	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)
	rowH := r.H / float32(waterfallRows)
	cellW := r.W / 2 / float32(half)

	for row := 0; row < viz.waterN; row++ {
		// Newest row at the bottom, oldest scrolls off the top.
		dataRow := (viz.waterH - row + waterfallRows*2) % waterfallRows
		y := r.Y + r.H - float32(row+1)*rowH
		for col := 0; col < half; col++ {
			v := viz.water[dataRow][col]
			if v < 0.02 {
				continue
			}
			alpha := float32(math.Min(0.95, float64(v)*1.35))
			var c myui.Color
			switch {
			case v > 0.82:
				c = ink
			case v > 0.52:
				c = colA
			default:
				c = colB
			}
			x := r.X + float32(col)*cellW
			p.Fill(myui.Rect{X: x, Y: y, W: cellW + 0.5, H: rowH + 0.5}, c.Alpha(alpha), 0)
			// Mirror onto the right half.
			mx := r.X + r.W - x - cellW
			p.Fill(myui.Rect{X: mx, Y: y, W: cellW + 0.5, H: rowH + 0.5}, c.Alpha(alpha), 0)
		}
	}
}
