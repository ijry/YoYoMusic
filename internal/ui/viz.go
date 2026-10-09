// Package ui builds the native (GPU-drawn) interface for YoYoMusic with the
// mygo ui package. viz.go holds the six real-time audio visualisers, each
// drawing from an audio.SignalFrame onto a mygo Painter.
package ui

import (
	"math"
	"math/rand"
	"time"

	"yoyomusic/internal/app"
	"yoyomusic/internal/app/audio"

	myui "github.com/egoist/mygo/ui"
)

// vizParticle is one point in the particle visualiser.
type vizParticle struct {
	x, y, vx, vy, life, max float32
}

var (
	particles    []vizParticle
	lastParticle time.Time
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// drawSpectrum renders 56 vertical bars rising from the baseline, coloured
// along the skin's primary→accent gradient and topped with rounded caps.
func drawSpectrum(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin) {
	n := audio.BandCount
	pad := float32(2)
	bw := r.W / float32(n)
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	baseY := r.Y + r.H
	maxH := r.H * 0.92
	for i := 0; i < n; i++ {
		v := f.Bands[i]
		h := v * maxH
		if h < 2 {
			h = 2
		}
		x := r.X + float32(i)*bw + pad/2
		w := bw - pad
		c := colA.Mix(colB, float32(i)/float32(n))
		p.Fill(myui.Rect{X: x, Y: baseY - h, W: w, H: h}, c.Alpha(0.95), w/2)
	}
}

// drawWaveform draws the oscilloscope trace with a soft gradient fill under
// the curve.
func drawWaveform(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin) {
	n := audio.WaveSamples
	mid := r.Y + r.H/2
	amp := r.H * 0.42
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	step := r.W / float32(n-1)

	// Soft gradient fill bounded by the trace and the midline.
	fill := &myui.Path{}
	fill.MoveTo(r.X, mid)
	for i := 0; i < n; i++ {
		x := r.X + float32(i)*step
		y := mid - f.Wave[i]*amp
		fill.LineTo(x, y)
	}
	fill.LineTo(r.X+r.W, mid)
	fill.Close()
	g := myui.LinearGradient{From: colA.Alpha(0.30), To: colB.Alpha(0.04), Angle: 180}
	p.FillPathGradient(fill, g)

	// Crisp trace on top.
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
	p.StrokePath(line, 2, colB.Alpha(0.95))
}

// drawRadial paints the spectrum as bars radiating from a glowing core.
func drawRadial(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin) {
	cx := r.X + r.W/2
	cy := r.Y + r.H/2
	minSide := float32(math.Min(float64(r.W), float64(r.H)))
	baseR := minSide * 0.18
	maxR := minSide * 0.46
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	n := audio.BandCount
	for i := 0; i < n; i++ {
		v := f.Bands[i]
		ang := float64(i)/float64(n)*2*math.Pi - math.Pi/2
		outer := baseR + (maxR-baseR)*v
		x0 := cx + float32(math.Cos(ang))*baseR
		y0 := cy + float32(math.Sin(ang))*baseR
		x1 := cx + float32(math.Cos(ang))*outer
		y1 := cy + float32(math.Sin(ang))*outer
		c := colA.Mix(colB, float32(i)/float32(n))
		p.Line(x0, y0, x1, y1, 3, c.Alpha(0.9))
	}
	p.Fill(myui.Rect{X: cx - baseR*0.5, Y: cy - baseR*0.5, W: baseR, H: baseR}, colB.Alpha(0.5), baseR*0.5)
}

// drawParticles spawns and advances a particle field driven by the audio
// level and beat; particle state persists across frames in this package.
func drawParticles(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, now time.Time) {
	dt := float32(now.Sub(lastParticle).Seconds())
	if dt <= 0 || dt > 0.1 {
		dt = 0.016
	}
	lastParticle = now

	cx := r.X + r.W/2
	cy := r.Y + r.H/2
	colB := colOf(skin.VizB)

	// Spawn proportional to energy; a strong beat adds a burst.
	n := int(f.Level * 6)
	if f.Beat > 0.5 {
		n += 4
	}
	for i := 0; i < n; i++ {
		ang := rand.Float64() * 2 * math.Pi
		sp := 40 + f.Level*240 + rand.Float32()*40
		particles = append(particles, vizParticle{
			x:    cx,
			y:    cy,
			vx:   float32(math.Cos(ang)) * sp,
			vy:   float32(math.Sin(ang)) * sp,
			life: 1,
			max:  1.4 + rand.Float32()*0.6,
		})
	}

	alive := particles[:0]
	for i := range particles {
		pt := &particles[i]
		pt.life -= dt
		if pt.life <= 0 {
			continue
		}
		pt.x += pt.vx * dt
		pt.y += pt.vy * dt
		pt.vx *= 0.98
		pt.vy *= 0.98
		t := pt.life / pt.max
		rad := 2 + t*6
		p.Fill(myui.Rect{X: pt.x - rad, Y: pt.y - rad, W: rad * 2, H: rad * 2}, colB.Alpha(t*0.8), rad)
		alive = append(alive, *pt)
	}
	particles = alive
}

// drawAurora flows several soft bands of light across the canvas, their
// amplitude tracking the low-mid spectrum.
func drawAurora(p *myui.Painter, r myui.Rect, f audio.SignalFrame, skin app.Skin, now time.Time) {
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	ts := now.Sub(time.Unix(0, 0)).Seconds()
	bands := 4
	for b := 0; b < bands; b++ {
		amp := (r.H * 0.12) * (0.6 + f.Bands[(b*8)%audio.BandCount])
		yBase := r.Y + r.H*float32(b+1)/float32(bands+1)
		path := &myui.Path{}
		steps := 24
		path.MoveTo(r.X, yBase)
		for i := 0; i <= steps; i++ {
			x := r.X + r.W*float32(i)/float32(steps)
			y := yBase + float32(math.Sin(ts*0.8+float64(i)*0.5+float64(b)))*amp
			path.LineTo(x, y)
		}
		path.LineTo(r.X+r.W, r.Y+r.H)
		path.LineTo(r.X, r.Y+r.H)
		path.Close()
		g := myui.LinearGradient{
			From:  colA.Alpha(0.06 + 0.12*float32(b)/float32(bands)),
			To:    colB.Alpha(0.02),
			Angle: 90,
		}
		p.FillPathGradient(path, g)
	}
}

// drawWaterfall renders the ring-buffered spectrum history as a heatmap:
// time scrolls left→right, frequency bottom→top, intensity sets colour and
// opacity.
func drawWaterfall(p *myui.Painter, r myui.Rect, a *app.App, skin app.Skin) {
	wf := a.Waterfall()
	pos := a.WaterfallPos()
	nB := audio.BandCount
	nT := len(wf)
	colA := colOf(skin.VizA)
	colB := colOf(skin.VizB)
	cellW := r.W / float32(nT)
	cellH := r.H / float32(nB)
	for i := 0; i < nT; i++ {
		idx := (pos + i) % nT // oldest → newest
		x := r.X + float32(i)*cellW
		for b := 0; b < nB; b++ {
			v := wf[idx][b]
			if v <= 0.02 {
				continue
			}
			y := r.Y + r.H - float32(b+1)*cellH
			c := colA.Mix(colB, v)
			p.Fill(myui.Rect{X: x, Y: y, W: cellW + 0.5, H: cellH + 0.5}, c.Alpha(0.2+0.8*v), 0)
		}
	}
}
