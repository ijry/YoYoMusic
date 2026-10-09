// Package ui builds the native (GPU-drawn) interface for YoYoMusic with the
// mygo ui package. viz.go holds the eight real-time audio visualisers, each
// drawing from an audio.SignalFrame onto a mygo Painter.
//
// The renderers mirror the original YoYoMusic canvas modes — the same palette
// use, the same peak-hold, waterfall history, particle field, aurora layering,
// kaleidoscope mirroring and generative scene rotation — so the two versions
// look alike.
//
// mygo's Painter has no transform stack (no rotate/translate/scale), so every
// rotation and mirror is computed here and baked into the coordinates handed to
// the painter. That is the one place this file differs mechanically from the
// canvas version it follows.
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

// Generative scene timing, matching the original: a scene lasts 16-27 seconds
// and the next cross-fades in over 1.4s.
const (
	sceneMinSeconds = 16.0
	sceneMaxSeconds = 27.0
	transitionSecs  = 1.4
	constellationN  = 22
	flowParticles   = 1000
	kaleidoSectors  = 10
)

// vizState holds the per-frame stateful effects. One instance per app, shared
// by every draw call, since there is only one visualiser canvas.
type vizState struct {
	peaks   [audio.BandCount]float32 // spectrum peak-hold caps
	falling [audio.BandCount]bool    // whether each cap is falling

	water    [waterfallRows][audio.BandCount]float32
	waterH   int // ring buffer head
	waterN   int // rows filled so far
	waterClk float64

	rotation   float64 // radial ring rotation
	kaleidoRot float64 // kaleidoscope rotation
	parts      []vizParticle
	partClk    float64

	// Generative scene rotation.
	genScene    string // scene on screen
	genIncoming string // scene fading in, "" when none
	genTrans    float64
	genAge      float64
	genDuration float64
	genClock    float64
	genFlash    float64
	genLastSeed float64
	genNodes    []genNode
	genFlow     [][2]float32
}

var viz = &vizState{}

// vizParticle is one point in the particle field.
type vizParticle struct {
	x, y, vx, vy  float32
	life, maxLife float32
	size, tone    float32
}

// genNode is one node of the generative constellation scene.
type genNode struct {
	orbitA, orbitB float64
	speed          float64
	phase          float64
	band           int
	size           float64
	tone           float64
}

// bandAt reads the spectrum at a normalised position 0..1.
func bandAt(f audio.SignalFrame, t float64) float32 {
	i := int(t * float64(audio.BandCount-1))
	if i < 0 {
		i = 0
	}
	if i >= audio.BandCount {
		i = audio.BandCount - 1
	}
	return f.Bands[i]
}

// --- spectrum ---------------------------------------------------------------

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
		// gradients are two-stop, so the bar is two stacked segments.
		if h > 4 {
			mid := y + h*0.45
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
			viz.falling[i] = true
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

// --- waveform ---------------------------------------------------------------

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

// --- radial -----------------------------------------------------------------

// drawRadial paints the spectrum as bars radiating from a glowing core that
// pulses with the beat. The whole ring rotates, faster when the music is loud.
//
// The original rotated the canvas per bar; here the rotation is applied to each
// bar's endpoints directly, which is the same geometry without a transform
// stack. Bars are drawn as capsules (a stroked thick line) so the rounded ends
// survive the rotation.
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
	// The bar's colour depends on how far out it reaches, which is what the
	// original's vertical gradient achieved. Mixing per bar reproduces it.
	for i := 0; i < n; i++ {
		ang := float64(i)/float64(n)*2*math.Pi + viz.rotation - math.Pi/2
		v := f.Bands[i]
		length := innerR*0.25 + v*(maxR-innerR)
		thickness := float32(math.Max(1.5, float64(2*math.Pi*innerR)/float64(n)*0.55))

		ca := float32(math.Cos(ang))
		sa := float32(math.Sin(ang))
		// A small gap between the ring and the bar, as in the original.
		x0 := cx + ca*(innerR+2)
		y0 := cy + sa*(innerR+2)
		x1 := cx + ca*(innerR+2+length)
		y1 := cy + sa*(innerR+2+length)

		// Distance outward sets the colour: ink at the tip, primary in the
		// middle, accent at the root.
		var c myui.Color
		switch {
		case length > (maxR-innerR)*0.66:
			c = ink
		case length > (maxR-innerR)*0.33:
			c = colA
		default:
			c = colB
		}
		// Loud bars get a glow pass under them.
		if v > 0.6 {
			p.Line(x0, y0, x1, y1, thickness+4, colA.Alpha(0.18))
		}
		p.Line(x0, y0, x1, y1, thickness, c.Alpha(0.55+v*0.45))
	}
}

// --- aurora -----------------------------------------------------------------

// auroraY returns one aurora layer's centre line at x: a stack of sines
// displaced by the spectrum energy at that x. Extracted so the fill and the
// core stroke share exactly the same curve.
func auroraY(x float32, r myui.Rect, f audio.SignalFrame, layer int, phase, amp float64) float32 {
	prog := float64(x-r.X) / float64(r.W)
	energy := float64(bandAt(f, prog))
	centerY := r.Y + r.H*float32(layer)*0.14 + r.H*0.32
	return float32(float64(centerY) +
		math.Sin(prog*math.Pi*2*1.6+phase+float64(f.Beat)*2)*amp +
		math.Sin(prog*math.Pi*2*3.1-phase*0.6)*amp*0.45 +
		(energy-0.35)*float64(r.H)*0.22)
}

// drawAurora flows several wide soft bands across the canvas, each a sine
// stack displaced by the spectrum at that x, with a bright core line on top.
//
// The original drew each layer twice: a 16px-wide blurred stroke for the body
// and a 2px bright stroke for the core. mygo has no blur, so the body is a
// translucent gradient fill closed down to the bottom edge plus a wide
// low-alpha stroke, which reads as the same soft curtain.
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

		// Soft body: the outline closed down to the bottom edge.
		fill := &myui.Path{}
		for s := 0; s <= segments; s++ {
			x := r.X + r.W*float32(s)/float32(segments)
			y := auroraY(x, r, f, layer, phase, amp)
			if s == 0 {
				fill.MoveTo(x, y)
			} else {
				fill.LineTo(x, y)
			}
		}
		fill.LineTo(r.X+r.W, r.Y+r.H)
		fill.LineTo(r.X, r.Y+r.H)
		fill.Close()

		c := colors[layer%len(colors)]
		bodyAlpha := 0.16 + float32(layer)*0.07
		p.FillPathGradient(fill, myui.LinearGradient{
			Angle: 90,
			From:  colB.Alpha(bodyAlpha),
			To:    c.Alpha(bodyAlpha),
		})
		// A wide, faint stroke widens the glow where the fill cannot reach.
		p.StrokePath(fill, 14-float32(layer)*2.5, c.Alpha(bodyAlpha*0.5))

		// Bright core line along the same outline.
		core := &myui.Path{}
		for s := 0; s <= segments; s++ {
			x := r.X + r.W*float32(s)/float32(segments)
			y := auroraY(x, r, f, layer, phase, amp)
			if s == 0 {
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

// --- particles --------------------------------------------------------------

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

// --- waterfall --------------------------------------------------------------

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

// --- kaleidoscope -----------------------------------------------------------

// drawKaleidoscope mirrors one spectrum-driven arm around the centre: ten
// sectors, every other one flipped, so the reflections meet at the sector
// boundaries and the pattern reads as a single flower. The arm fans out as it
// goes, which is what gives the petals their shape.
func drawKaleidoscope(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, dt float32) {
	cx := r.X + r.W/2
	cy := r.Y + r.H/2
	scale := float32(math.Min(float64(r.W), float64(r.H)))
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	viz.kaleidoRot += float64(dt) * (0.16 + float64(f.Level)*0.9)

	sectorAngle := 2 * math.Pi / kaleidoSectors
	innerR := scale * 0.1
	span := scale * 0.34

	for sector := 0; sector < kaleidoSectors; sector++ {
		// The sector's own rotation, plus the mirror for odd sectors.
		base := float64(sector)*sectorAngle + viz.kaleidoRot
		flip := sector%2 == 1

		for band := 0; band < audio.BandCount; band++ {
			v := f.Bands[band]
			if v <= 0.012 {
				continue
			}
			tt := float64(band) / float64(audio.BandCount)
			radius := float64(innerR) + tt*float64(span)
			// The arm fans out as it goes.
			angle := tt*sectorAngle*0.85 + base
			size := float32((1.2 + float64(v)*13) * (0.5 + tt*0.9))

			// Point in the sector's frame.
			px := math.Sin(angle-base) * radius
			py := -math.Cos(angle-base) * radius
			if flip {
				py = -py
			}
			x := cx + float32(math.Cos(base)*px-math.Sin(base)*py)
			y := cy + float32(math.Sin(base)*px+math.Cos(base)*py)

			// Colour follows the band's position along the arm.
			var c myui.Color
			switch {
			case tt > 0.72:
				c = ink
			case tt > 0.36:
				c = colB
			default:
				c = colA
			}
			p.Fill(myui.Rect{X: x - size, Y: y - size, W: size * 2, H: size * 2},
				c.Alpha(0.18+v*0.72), size)
		}
	}

	// Core, brightened on the beat.
	coreR := innerR * (1.15 + f.Beat*0.5)
	p.FillGradient(myui.Rect{X: cx - coreR*1.7, Y: cy - coreR*1.7, W: coreR * 3.4, H: coreR * 3.4},
		myui.LinearGradient{From: ink.Alpha(0.3 + f.Beat*0.5), To: ink.Alpha(0), Angle: 0}, coreR*1.7)
	p.Fill(myui.Rect{X: cx - coreR*0.5, Y: cy - coreR*0.5, W: coreR, H: coreR}, ink.Alpha(0.3+f.Beat*0.5), coreR*0.5)
}

// --- generative -------------------------------------------------------------

// generativeScenes are the five procedurally-generated scenes the generative
// mode rotates through, in the original's order.
var generativeScenes = []string{"constellation", "ribbons", "lattice", "orbits", "flowfield"}

func randomScene(exclude string) string {
	for {
		s := generativeScenes[rand.Intn(len(generativeScenes))]
		if s != exclude {
			return s
		}
	}
}

func randomDuration() float64 {
	return sceneMinSeconds + rand.Float64()*(sceneMaxSeconds-sceneMinSeconds)
}

func randomNode() genNode {
	return genNode{
		orbitA: 0.16 + rand.Float64()*0.34,
		orbitB: 0.16 + rand.Float64()*0.34,
		speed:  (rand.Float64() - 0.5) * 2 * (0.08 + rand.Float64()*0.42),
		phase:  rand.Float64() * 2 * math.Pi,
		band:   rand.Intn(audio.BandCount),
		size:   0.6 + rand.Float64()*1.8,
		tone:   rand.Float64(),
	}
}

// drawGenerative rotates five procedural scenes with a cross-fade between
// them, so the display keeps arriving somewhere new instead of looping. Each
// scene is driven by the analysed spectrum and randomised on entry.
func drawGenerative(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, dt float32) {
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	viz.genClock += float64(dt)
	viz.genFlash = math.Max(float64(f.Beat), viz.genFlash-float64(dt)*1.6)

	if viz.genScene == "" {
		viz.genScene = randomScene("")
		viz.genDuration = randomDuration()
	}

	// Scene scheduling: run for the drawn duration, then cross-fade.
	if viz.genIncoming == "" {
		viz.genAge += float64(dt)
		if viz.genAge >= viz.genDuration {
			viz.genIncoming = randomScene(viz.genScene)
			viz.genTrans = 0
		}
	} else {
		viz.genTrans += float64(dt) / transitionSecs
		if viz.genTrans >= 1 {
			viz.genScene = viz.genIncoming
			viz.genIncoming = ""
			viz.genTrans = 0
			viz.genAge = 0
			viz.genDuration = randomDuration()
		}
	}

	// Both scenes draw with their own alpha, which is a genuine cross-fade
	// because everything here is additive over the background.
	if viz.genIncoming == "" {
		drawGenScene(p, r, f, skin, viz.genScene, 1)
		return
	}
	progress := viz.genTrans * viz.genTrans * (3 - 2*viz.genTrans) // smoothstep
	drawGenScene(p, r, f, skin, viz.genScene, float32(1-progress))
	drawGenScene(p, r, f, skin, viz.genIncoming, float32(progress))
	_ = colA
	_ = colB
	_ = ink
}

// drawGenScene renders one generative scene at the given alpha.
func drawGenScene(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, scene string, alpha float32) {
	switch scene {
	case "constellation":
		drawConstellation(p, r, f, skin, alpha)
	case "ribbons":
		drawRibbons(p, r, f, skin, alpha)
	case "lattice":
		drawLattice(p, r, f, skin, alpha)
	case "orbits":
		drawOrbits(p, r, f, skin, alpha)
	case "flowfield":
		drawFlowfield(p, r, f, skin, alpha)
	}
}

// drawConstellation: nodes on independent ellipses, linked when close, so the
// mesh emerges rather than being drawn.
func drawConstellation(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, alpha float32) {
	cx := r.X + r.W/2
	cy := r.Y + r.H/2
	scale := float32(math.Min(float64(r.W), float64(r.H)))
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	if len(viz.genNodes) == 0 {
		for i := 0; i < constellationN; i++ {
			viz.genNodes = append(viz.genNodes, randomNode())
		}
	}
	// Re-orbit one node per beat, rate-limited so a fast track does not
	// scramble the field faster than the eye can follow.
	if f.Beat > 0.5 && viz.genClock-viz.genLastSeed > 0.22 {
		viz.genLastSeed = viz.genClock
		viz.genNodes[rand.Intn(len(viz.genNodes))] = randomNode()
	}

	type pt struct {
		x, y  float32
		level float32
		tone  float64
	}
	pts := make([]pt, len(viz.genNodes))
	for i, nd := range viz.genNodes {
		angle := viz.genClock*nd.speed + nd.phase
		level := f.Bands[nd.band]
		stretch := 0.55 + float64(level)*0.9
		pts[i] = pt{
			x:     cx + float32(math.Cos(angle)*nd.orbitA*float64(scale)*stretch),
			y:     cy + float32(math.Sin(angle*1.13)*nd.orbitB*float64(scale)*stretch),
			level: level,
			tone:  nd.tone,
		}
	}

	linkDist := float64(scale) * (0.2 + float64(f.Level)*0.12)
	for i := range pts {
		for j := i + 1; j < len(pts); j++ {
			dx := float64(pts[i].x - pts[j].x)
			dy := float64(pts[i].y - pts[j].y)
			d := math.Hypot(dx, dy)
			if d > linkDist {
				continue
			}
			near := 1 - d/linkDist
			p.Line(pts[i].x, pts[i].y, pts[j].x, pts[j].y, 1,
				colB.Alpha(float32(near*near*(0.3+float64(viz.genFlash)*0.5)*float64(alpha))))
		}
	}

	for _, q := range pts {
		radius := float32((2 + float64(q.level)*7) * (1 + viz.genFlash*0.5))
		glowR := radius * 3.4
		// The node's tone picks which accent its halo carries, so the field
		// is not one flat colour.
		halo := colA
		if q.tone > 0.5 {
			halo = colB
		}
		// Two nested gradients approximate the original's three-stop radial:
		// ink core, accent mid, transparent edge.
		p.FillGradient(myui.Rect{X: q.x - glowR, Y: q.y - glowR, W: glowR * 2, H: glowR * 2},
			myui.LinearGradient{From: halo.Alpha((0.55 + q.level*0.45) * alpha), To: halo.Alpha(0), Angle: 0}, glowR)
		coreR := glowR * 0.32
		p.FillGradient(myui.Rect{X: q.x - coreR, Y: q.y - coreR, W: coreR * 2, H: coreR * 2},
			myui.LinearGradient{From: ink.Alpha(0.9 * alpha), To: ink.Alpha(0), Angle: 0}, coreR)
	}

	// Bloom across the whole field.
	p.FillGradient(myui.Rect{X: cx - scale*0.42, Y: cy - scale*0.42, W: scale * 0.84, H: scale * 0.84},
		myui.LinearGradient{From: colA.Alpha((0.06 + f.Level*0.12 + float32(viz.genFlash)*0.08) * alpha), To: colA.Alpha(0), Angle: 0}, scale*0.42)
}

// drawRibbons: stacked sine stacks whose line width carries the energy, which
// reads as loudness without moving anything.
func drawRibbons(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, alpha float32) {
	const count = 6
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	for ribbon := 0; ribbon < count; ribbon++ {
		energy := bandAt(f, float64(ribbon)/float64(count))
		baseY := r.Y + r.H*(0.14+float32(ribbon)/float32(count-1)*0.72)
		swing := float64(r.H) * (0.045 + float64(energy)*0.13)
		speed := 0.5 + float64(ribbon)*0.17

		path := &myui.Path{}
		step := float32(math.Max(6, float64(r.W)/90))
		for x := r.X; x <= r.X+r.W+step; x += step {
			tt := float64(x-r.X) / float64(r.W)
			y := float64(baseY) +
				math.Sin(tt*math.Pi*3.1+viz.genClock*speed)*swing +
				math.Sin(tt*math.Pi*7.3-viz.genClock*speed*1.7)*swing*0.34 +
				math.Sin(tt*math.Pi*13.1+viz.genClock*speed*0.6)*swing*0.14
			if x == r.X {
				path.MoveTo(x, float32(y))
			} else {
				path.LineTo(x, float32(y))
			}
		}
		c := colA
		if ribbon%2 == 1 {
			c = colB
		}
		p.StrokePathGradient(path, float32(1.2+float64(energy)*5+float64(float32(viz.genFlash))*1.5),
			myui.LinearGradient{From: c.Alpha((0.22 + energy*0.5) * alpha), To: c.Alpha(0), Angle: 90})

		// A brighter head that rides the ribbon, so it has a direction.
		headT := (math.Sin(viz.genClock*speed*0.31+float64(ribbon)) + 1) / 2
		headX := r.X + float32(headT)*r.W
		headY := auroraY(headX, r, f, ribbon, viz.genClock*speed, swing)
		headR := float32(26 + float64(energy)*40)
		p.FillGradient(myui.Rect{X: headX - headR, Y: headY - headR, W: headR * 2, H: headR * 2},
			myui.LinearGradient{From: ink.Alpha((0.4 + energy*0.5) * alpha), To: ink.Alpha(0), Angle: 0}, headR)
	}
}

// drawLattice: a regular grid pushed around by a travelling wave. The grid is
// what makes the deformation legible — a scattered field would look like noise.
func drawLattice(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, alpha float32) {
	const cols = 21
	const rows = 13
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)
	stepX := r.W / float32(cols-1)
	stepY := r.H / float32(rows-1)

	type gp struct {
		x, y   float32
		energy float32
	}
	grid := make([]gp, cols*rows)
	for row := 0; row < rows; row++ {
		for col := 0; col < cols; col++ {
			energy := bandAt(f, float64(col)/float64(cols-1))
			push := float64(4 + energy*30)
			grid[row*cols+col] = gp{
				x:      r.X + float32(col)*stepX + float32(math.Sin(viz.genClock*0.7+float64(row)*0.5)*push),
				y:      r.Y + float32(row)*stepY + float32(math.Cos(viz.genClock*0.6+float64(col)*0.42)*push),
				energy: energy,
			}
		}
	}

	for row := 0; row < rows; row++ {
		for col := 0; col < cols; col++ {
			q := grid[row*cols+col]
			e := q.energy
			if col+1 < cols {
				nx := grid[row*cols+col+1]
				p.Line(q.x, q.y, nx.x, nx.y, 1, colB.Alpha((0.05+e*0.24)*alpha))
			}
			if row+1 < rows {
				bl := grid[(row+1)*cols+col]
				p.Line(q.x, q.y, bl.x, bl.y, 1, colB.Alpha((0.05+e*0.24)*alpha))
			}
			size := float32(0.7 + float64(e)*4.2 + viz.genFlash*1.4)
			c := colA
			if e > 0.55 {
				c = ink
			}
			p.Fill(myui.Rect{X: q.x - size, Y: q.y - size, W: size * 2, H: size * 2}, c.Alpha((0.25+e*0.7)*alpha), size)
		}
	}
}

// drawOrbits: concentric rings turning at their own rates and directions, with
// a rider on each. The bands set the ring radii, so the system breathes.
func drawOrbits(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, alpha float32) {
	const rings = 8
	cx := r.X + r.W/2
	cy := r.Y + r.H/2
	scale := float32(math.Min(float64(r.W), float64(r.H)))
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	for ring := 0; ring < rings; ring++ {
		tt := float64(ring) / float64(rings-1)
		energy := bandAt(f, tt)
		radius := float64(scale) * (0.07 + tt*0.4) * (1 + float64(energy)*0.12 + viz.genFlash*0.04)
		spin := viz.genClock * (0.22 + float64(ring)*0.055)
		if ring%2 == 1 {
			spin = -spin
		}

		c := colA
		if ring%2 == 1 {
			c = colB
		}
		// A circle is the only closed curve the Path API offers, and an
		// ellipse would need a rotation to squash; a plain ring at the
		// computed radius keeps the nested-orbit read without it.
		p.Stroke(myui.Rect{X: cx - float32(radius), Y: cy - float32(radius), W: float32(radius) * 2, H: float32(radius) * 2},
			c.Alpha(float32((0.14+float64(energy)*0.5)*float64(alpha))), float32(radius), float32(1+float64(energy)*2.6))

		// A rider on the ring.
		ra := spin
		rx := cx + float32(math.Cos(ra)*radius)
		ry := cy + float32(math.Sin(ra)*radius)
		riderR := float32(2.2 + float64(energy)*9 + viz.genFlash*2)
		p.FillGradient(myui.Rect{X: rx - riderR*3, Y: ry - riderR*3, W: riderR * 6, H: riderR * 6},
			myui.LinearGradient{From: ink.Alpha((0.45 + energy*0.5) * alpha), To: ink.Alpha(0), Angle: 0}, riderR*3)
	}

	coreR := float64(scale) * 0.1
	p.FillGradient(myui.Rect{X: cx - float32(coreR), Y: cy - float32(coreR), W: float32(coreR) * 2, H: float32(coreR) * 2},
		myui.LinearGradient{From: ink.Alpha(float32((0.3 + float64(f.Level)*0.3 + viz.genFlash*0.2) * float64(alpha))), To: ink.Alpha(0), Angle: 0}, float32(coreR))
}

// drawFlowfield: particles advected through a slowly rotating angle field,
// each drawing the segment it just travelled. The image is entirely the
// residue of motion, so it looks different every time it is entered.
func drawFlowfield(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, alpha float32) {
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ink := colOf(skin.VizInk)

	if len(viz.genFlow) != flowParticles {
		viz.genFlow = make([][2]float32, flowParticles)
		for i := range viz.genFlow {
			viz.genFlow[i] = [2]float32{r.X + rand.Float32()*r.W, r.Y + rand.Float32()*r.H}
		}
	}

	// A soft bed under the streaks; without it the scene reads as empty during
	// quiet passages, because there is nothing but hairlines to look at.
	p.FillGradient(r, myui.LinearGradient{
		From:  colA.Alpha((0.025 + f.Level*0.04 + float32(viz.genFlash)*0.03) * alpha),
		To:    colB.Alpha(0),
		Angle: 0,
	}, 0)

	energy := 0.35 + float64(f.Level)*1.5
	for i := range viz.genFlow {
		q := &viz.genFlow[i]
		nx := float64(q[0]-r.X) / float64(r.W)
		ny := float64(q[1]-r.Y) / float64(r.H)
		// A cheap pseudo-noise field: three offset sines are enough to make
		// the streamlines curve without a real noise function.
		angle := math.Sin(nx*6.2+viz.genClock*0.35)*1.7 +
			math.Cos(ny*5.4-viz.genClock*0.27)*1.7 +
			math.Sin((nx+ny)*3.1+viz.genClock*0.19)*1.2
		speed := (26 + energy*90) * (0.5 + float64(i%7)/7*0.9)
		px, py := q[0], q[1]
		q[0] += float32(math.Cos(angle) * speed * float64(1.0/60))
		q[1] += float32(math.Sin(angle) * speed * float64(1.0/60))

		// Wrap, so the field never empties out at the edges.
		if q[0] < r.X-4 {
			q[0] = r.X + r.W + 4
		}
		if q[0] > r.X+r.W+4 {
			q[0] = r.X - 4
		}
		if q[1] < r.Y-4 {
			q[1] = r.Y + r.H + 4
		}
		if q[1] > r.Y+r.H+4 {
			q[1] = r.Y - 4
		}
		// A teleport would draw a line across the whole canvas.
		if math.Abs(float64(q[0]-px)) > float64(r.W)/2 || math.Abs(float64(q[1]-py)) > float64(r.H)/2 {
			continue
		}

		var c myui.Color
		switch i % 3 {
		case 0:
			c = ink
		case 1:
			c = colA
		default:
			c = colB
		}
		p.Line(px, py, q[0], q[1], float32(1.1+float64(i%4)/4*1.6),
			c.Alpha(float32((0.16+float64(i%5)*0.05)*float64(alpha))))
	}
}
