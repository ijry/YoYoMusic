package audio

import (
	"runtime"
	"testing"
	"time"
)

// TestFeedAllocationRate guards the playback path against per-tick garbage.
//
// feedTo runs 60 times a second. Allocating its scratch buffers per call
// measured 6 MB/s (21 GB an hour), and the reaper and transport loops used
// time.After in a select, which allocates a Timer plus a channel per
// iteration that cannot be reclaimed until it fires — that alone was 92% of
// all allocations in the process. Both are now reused; this test fails if a
// future change reintroduces the churn.
func TestFeedAllocationRate(t *testing.T) {
	const (
		sr, ch = 44100, 2
		n      = sr * ch // one second of stereo
	)
	pcm := make([]int16, n)
	for i := 0; i < sr; i++ {
		v := int16(8000)
		pcm[i*2], pcm[i*2+1] = v, v
	}
	p := NewPlayer()
	p.Start()
	defer p.Close()
	if err := p.Load(&Decoded{PCM: pcm, SampleRate: sr, Channels: ch, DurationMs: 1000}); err != nil {
		t.Fatal(err)
	}
	p.Play()

	// Let the pipeline reach steady state first.
	time.Sleep(300 * time.Millisecond)

	var m0, m1 runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&m0)

	const window = 2 * time.Second
	time.Sleep(window)
	runtime.ReadMemStats(&m1)

	perSec := float64(m1.TotalAlloc-m0.TotalAlloc) / window.Seconds()
	t.Logf("alloc = %.1f KB/s (%.0f mallocs/s)", perSec/1024,
		float64(m1.Mallocs-m0.Mallocs)/window.Seconds())

	// A healthy steady state is a few KB/s. Anything above 256 KB/s means
	// something per-frame is allocating again.
	if perSec > 256*1024 {
		t.Errorf("allocation rate too high: %.1f KB/s", perSec/1024)
	}
}
