package ui

import (
	"image"
	"testing"

	"yoyomusic/internal/app"
	"yoyomusic/internal/app/audio"

	myui "github.com/egoist/mygo/ui"
)

var pianoTestSkin = app.Skin{ID: "aurora", BG: "#0e0b1a", VizA: "#8b5cf6", VizB: "#22d3ee", VizInk: "#ffffff"}

const (
	pianoTestW = 560
	pianoTestH = 420
)

// keyX is the canvas x at the middle of white key i in a pianoTestW wide
// canvas.
func keyX(i int) int { return int((float64(i) + 0.5) * pianoTestW / float64(whiteKeys)) }

// pianoFrame renders one frame of the keyboard with the given white keys held
// down, every other key silent, and returns the image.
func pianoFrame(t *testing.T, press [whiteKeys]float32) *image.RGBA {
	t.Helper()
	blackAfter := [blackKeys]int{0, 1, 3, 4, 5, 7, 8, 10, 11, 12}
	band := func(t01 float32) int {
		i := int(float64(t01) * float64(audio.BandCount-1))
		return max(0, min(i, audio.BandCount-1))
	}

	var f audio.SignalFrame
	// Loud enough that the visualiser adds none of its idle shimmer, so each
	// key's press is exactly what press says.
	f.Level = 0.6
	for i := range viz.pianoW {
		viz.pianoW[i] = press[i]
		f.Bands[band(float32(i)/float32(whiteKeys))] = press[i]
	}
	for j := range viz.pianoB {
		viz.pianoB[j] = 0
		f.Bands[band(float32(blackAfter[j]+1)/float32(whiteKeys))] = 0
	}

	view := func(c *myui.Context) {
		myui.Box(c).Fill().Draw(func(p *myui.Painter, r myui.Rect) {
			p.Fill(r, colOf(pianoTestSkin.BG), 0)
			drawPiano(p, r, f, pianoTestSkin, 1.0/60)
		})
	}
	img := myui.Render(view, pianoTestW, pianoTestH, 1)
	if img == nil {
		t.Fatal("the view drew no image")
	}
	return img
}

// TestPianoPressSinksTheKey is the point of the whole projection. Three things
// have to follow from a key being played: its nose has to go down, towards the
// key slip; the top surface has to tilt out of the light along its whole
// length; and it has to leave the dark slot it sank into where the slip's rail
// used to be. Without them the piano is back to being a flat strip of
// rectangles and the moment the music lands on a key is lost.
func TestPianoPressSinksTheKey(t *testing.T) {
	var none [whiteKeys]float32
	released := pianoFrame(t, none)

	var held [whiteKeys]float32
	const key = 5
	held[key] = 1
	pressed := pianoFrame(t, held)

	// Where the layout lands, which is where each part of the behaviour has to
	// show: a white key's top surface runs from the fallboard line down to its
	// nose, its front face from the nose down to the key slip's rail, and the
	// slip itself below that.
	lay := pianoLayout(myui.Rect{X: 0, Y: 0, W: pianoTestW, H: pianoTestH})
	yFall := lay.y(kbBackV, 0, 0)
	yNose := lay.y(1, 0, 0)
	yRail := yNose + lay.lipH

	x, other := keyX(key), keyX(key+2)
	b := pressed.Bounds()

	// 1. The nose went down, which is the motion itself: the row at which the
	// lit top surface gives way to the front face below it shifts towards the
	// rail by the drop the layout gives a key.
	if move := noseRow(pressed, x, int(yFall)) - noseRow(released, x, int(yFall)); move < int(lay.whiteDrop*0.6) {
		t.Errorf("key %d's nose went down %d rows, want at least the %g it has to sink", key, move, lay.whiteDrop)
	}

	// 2. The surface tilted out of the light as it went, all the way along,
	// not just at the nose.
	rows, dimmed, shade := 0, 0, 0
	for y := int(yFall) + 2; y < int(yNose); y++ {
		d := int(released.RGBAAt(x, y).R) - int(pressed.RGBAAt(x, y).R)
		shade += d
		rows++
		if d > 8 {
			dimmed++
		}
	}
	if dimmed < rows*9/10 {
		t.Errorf("key %d dimmed on only %d of its %d rows of top surface, want the whole surface to leave the light", key, dimmed, rows)
	}
	if shade < rows*20 {
		t.Errorf("key %d lost only %d over its %d rows of top surface, want %d or more", key, shade, rows, rows*20)
	}

	// 3. The slot it left in the key slip, between where its nose pulled away
	// from the rail and the slip below.
	slot := 0
	for y := int(yRail); y < b.Max.Y; y++ {
		if d := int(released.RGBAAt(x, y).R) - int(pressed.RGBAAt(x, y).R); d > 0 {
			slot += d
		}
	}
	if slot < 60 {
		t.Errorf("key %d left a slot worth only %d under the rail, want it to sink out of sight", key, slot)
	}

	// A key two along must not have moved with it.
	for y := b.Min.Y; y < b.Max.Y; y++ {
		if a, c := released.RGBAAt(other, y), pressed.RGBAAt(other, y); a != c {
			t.Fatalf("key %d moved with key %d pressed, at y=%d", key+2, key, y)
		}
	}
}

// noseRow is the canvas row at which white key i's lit top surface gives way to
// the front face standing below its nose: down the middle of the key, the first
// row below the fallboard that loses more light between one row and the next
// than the surface does anywhere along itself. When the key goes down, so does
// this row, which is how far the nose has sunk.
func noseRow(img *image.RGBA, x, from int) int {
	const litEdge = 30
	b := img.Bounds()
	for y := max(from+2, b.Min.Y+1); y < b.Max.Y; y++ {
		if int(img.RGBAAt(x, y-1).R)-int(img.RGBAAt(x, y).R) > litEdge {
			return y
		}
	}
	return b.Max.Y
}

// TestPianoDrawsAtAnySize guards the geometry against windows and display
// scales that could produce degenerate keys: nothing here may panic, and every
// size must still paint a lit keyboard along the bottom.
func TestPianoDrawsAtAnySize(t *testing.T) {
	for _, tc := range []struct {
		w, h  int
		scale float32
	}{
		{320, 240, 1}, {560, 420, 1}, {900, 700, 1}, {1600, 1000, 2}, {1200, 900, 1.5},
	} {
		var f audio.SignalFrame
		f.Level = 0.6
		for i := range f.Bands {
			f.Bands[i] = float32(i%9) / 9
		}
		for i := range viz.pianoW {
			viz.pianoW[i] = 0.5
		}
		for j := range viz.pianoB {
			viz.pianoB[j] = 0.5
		}
		view := func(c *myui.Context) {
			myui.Box(c).Fill().Draw(func(p *myui.Painter, r myui.Rect) {
				p.Fill(r, colOf(pianoTestSkin.BG), 0)
				drawPiano(p, r, f, pianoTestSkin, 1.0/60)
			})
		}
		img := myui.Render(view, tc.w, tc.h, tc.scale)
		if img == nil {
			t.Fatalf("%dx%d@%g: the view drew no image", tc.w, tc.h, tc.scale)
		}
		// The keyboard fills the bottom of the canvas: the last third of it
		// holds keys bright enough to be white.
		b := img.Bounds()
		lit := false
		for y := b.Min.Y + b.Dy()*2/3; y < b.Max.Y && !lit; y++ {
			for x := b.Min.X; x < b.Max.X; x++ {
				if c := img.RGBAAt(x, y); c.R > 150 && c.G > 150 && c.B > 150 {
					lit = true
					break
				}
			}
		}
		if !lit {
			t.Errorf("%dx%d@%g: no lit keyboard along the bottom", tc.w, tc.h, tc.scale)
		}
	}
}
