package ui

import (
	"image"
	"image/color"
	"os"
	"testing"

	"yoyomusic/internal/app"

	myui "github.com/egoist/mygo/ui"
)

// badgeTestSkin is any skin: the badge takes only Primary and Accent from it,
// and only when the real icon cannot be found.
var badgeTestSkin = app.Skin{ID: "aurora", Primary: "#8b5cf6", Accent: "#22d3ee", Ink: "#ffffff"}

// moduleRoot runs fn from the module root, where the packaged assets are, and
// puts the working directory back afterwards. Tests run with the package
// directory as their working directory, which is the one case where the app
// has no assets beside it.
func moduleRoot(t *testing.T, fn func()) {
	t.Helper()
	if err := os.Chdir("../.."); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := os.Chdir("internal/ui"); err != nil {
			t.Fatal(err)
		}
	}()
	fn()
}

// TestAppIconLoadsBesideTheApp: the interface's mark is the app's own icon, and
// it has to be found and decoded, at a size large enough to be drawn small
// without blur. A nil here is what would leave the interface showing some
// stand-in instead.
func TestAppIconLoadsBesideTheApp(t *testing.T) {
	moduleRoot(t, func() {
		bmp := loadAppLogo(app.ResourceDirs())
		if bmp == nil {
			t.Fatal("the packaged icon was not found beside the working directory")
		}
		w, h := bmp.Size()
		if w < 64 || h < 64 {
			t.Errorf("the mark is drawn from a %dx%d icon, which is too small to stay crisp", w, h)
		}
		if w != h {
			t.Errorf("the mark's icon is %dx%d, but a square mark draws it square", w, h)
		}
	})
	// With no directories to look in there is nothing to argue about.
	if bmp := loadAppLogo(nil); bmp != nil {
		t.Error("a bitmap came back with nowhere to look for one")
	}
}

// TestBrandMarkShowsTheIcon guards the fix for the report that the logo was
// wrong: the badge used to be a plain gradient blob drawn where the app's own
// mark belongs. Whatever happens, something has to fill the mark's box — the
// icon where it can be found, a drawn mark where it cannot — rather than leave
// it empty.
func TestBrandMarkShowsTheIcon(t *testing.T) {
	const size, scale = 22, 2
	var img *image.RGBA
	moduleRoot(t, func() {
		img = myui.Render(func(c *myui.Context) {
			brandMark(c, badgeTestSkin)
		}, size, size, scale)
	})
	if img == nil {
		t.Fatal("the mark drew no image")
	}

	// Every pixel of the mark's box against the corner, which is clear of it:
	// a rounded square leaves its corners untouched, but nothing else may.
	b := img.Bounds()
	bg := img.RGBAAt(b.Min.X, b.Min.Y)
	same := 0
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			if dist(img.RGBAAt(x, y), bg) < 12 {
				same++
			}
		}
	}
	px := b.Dx() * b.Dy()
	if covered := px - same; covered < px*3/5 {
		t.Errorf("the mark covers %d of its %d pixels, which reads as an empty box", covered, px)
	}
}

// TestBrandMarkSizeOfTheBox also catches the Image being left unsized, which
// lays it out at the bitmap's own size and pushes the rest of the bar off the
// window.
func TestBrandMarkSizeOfTheBox(t *testing.T) {
	const size, scale = 200, 1
	var img *image.RGBA
	moduleRoot(t, func() {
		img = myui.Render(func(c *myui.Context) {
			brandMark(c, badgeTestSkin)
		}, size, size, scale)
	})
	if img == nil {
		t.Fatal("the mark drew no image")
	}
	b := img.Bounds()
	bg := commonest(img)
	minX, maxX, minY, maxY := b.Max.X, b.Min.X, b.Max.Y, b.Min.Y
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			if dist(img.RGBAAt(x, y), bg) < 12 {
				continue
			}
			minX, maxX = min(minX, x), max(maxX, x)
			minY, maxY = min(minY, y), max(maxY, y)
		}
	}
	// 22 DIP plus the rounding mygo does to whole pixels.
	if w, h := maxX-minX+1, maxY-minY+1; w > 24 || h > 24 {
		t.Errorf("the mark draws %dx%d DIP in a %d DIP canvas, so the icon is being shown at its own size", w, h, size)
	}
}

// commonest is the colour the image is mostly made of, which is whatever lies
// behind the mark.
func commonest(img *image.RGBA) color.RGBA {
	counts := map[color.RGBA]int{}
	b := img.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			counts[img.RGBAAt(x, y)]++
		}
	}
	bg, n := color.RGBA{}, -1
	for c, k := range counts {
		if k > n {
			bg, n = c, k
		}
	}
	return bg
}

// dist is how far apart two pixels are: whichever of their channels differs
// most.
func dist(a, b color.RGBA) int {
	d := func(x, y uint8) int {
		if x > y {
			return int(x - y)
		}
		return int(y - x)
	}
	return max(d(a.R, b.R), d(a.G, b.G), d(a.B, b.B))
}
