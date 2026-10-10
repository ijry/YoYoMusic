//go:build darwin

package audio

import (
	"encoding/binary"
	"io"
	"sync"

	"github.com/ebitengine/oto/v3"
)

// The oto process-wide context has a single fixed sample rate and channel
// count, so every track is normalised to these in Load (normalizeDecoded).
// The analyser, visualiser and audio device then all run at one rate
// regardless of each file's native rate.
const (
	otoSampleRate = 48000
	otoChannels   = 2
)

var (
	otoCtxOnce sync.Once
	otoCtx     *oto.Context
	otoCtxErr  error
)

// sharedOtoContext lazily creates the single oto.Context this process may
// have. oto drives CoreAudio through purego (AudioToolbox via dlopen), so no
// cgo is involved.
func sharedOtoContext() (*oto.Context, error) {
	otoCtxOnce.Do(func() {
		c, ready, err := oto.NewContext(&oto.NewContextOptions{
			SampleRate:   otoSampleRate,
			ChannelCount: otoChannels,
			Format:       oto.FormatSignedInt16LE,
		})
		if err != nil {
			otoCtxErr = err
			return
		}
		<-ready // closed once the output device is initialised
		otoCtx = c
	})
	return otoCtx, otoCtxErr
}

// pcmReader is the io.Reader oto pulls finished PCM from. The engine's write
// (via audioOutput.write) appends bytes; Read hands them over and blocks
// while empty so the player is never starved mid-track.
//
// EOF is only signalled by finish (track end / stop / close): oto treats
// io.EOF as end-of-stream and stops reading forever, so returning it while
// the track is still feeding would silence playback.
type pcmReader struct {
	mu   sync.Mutex
	cond *sync.Cond
	buf  []byte
	eof  bool
}

func newPCMReader() *pcmReader {
	r := &pcmReader{}
	r.cond = sync.NewCond(&r.mu)
	return r
}

func (r *pcmReader) Write(p []byte) (int, error) {
	r.mu.Lock()
	r.buf = append(r.buf, p...)
	r.mu.Unlock()
	r.cond.Broadcast()
	return len(p), nil
}

func (r *pcmReader) Read(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for len(r.buf) == 0 && !r.eof {
		r.cond.Wait()
	}
	if len(r.buf) == 0 {
		return 0, io.EOF
	}
	n := copy(p, r.buf)
	r.buf = r.buf[n:]
	return n, nil
}

// finish marks the true end of the stream so a blocked Read returns io.EOF.
func (r *pcmReader) finish() {
	r.mu.Lock()
	r.eof = true
	r.mu.Unlock()
	r.cond.Broadcast()
}

// otoOutput is the macOS audio sink: PCM written by the engine is handed to
// an oto.Player (CoreAudio AudioQueue via purego) through a pcmReader.
// Volume, mute and EQ are already baked into the stream by feedTo, so this
// backend does not also call oto's SetVolume (that would apply gain twice).
type otoOutput struct {
	mu     sync.Mutex
	player *oto.Player
	r      *pcmReader
	closed bool
}

func newPlatformOutput() audioOutput { return &otoOutput{} }

func (o *otoOutput) open(sampleRate, channels int) error {
	if _, err := sharedOtoContext(); err != nil {
		return err
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	o.r = newPCMReader()
	return nil
}

func (o *otoOutput) write(samples []int16) error {
	o.mu.Lock()
	r := o.r
	o.mu.Unlock()
	if r == nil {
		return nil
	}
	b := make([]byte, len(samples)*2)
	for i, s := range samples {
		binary.LittleEndian.PutUint16(b[i*2:], uint16(s))
	}
	_, err := r.Write(b)
	return err
}

func (o *otoOutput) resume() {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.closed || o.r == nil {
		return
	}
	if o.player == nil {
		ctx, err := sharedOtoContext()
		if err != nil {
			return
		}
		o.player = ctx.NewPlayer(o.r)
	}
	o.player.Play()
}

func (o *otoOutput) pause() {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.player != nil {
		o.player.Pause()
	}
}

func (o *otoOutput) reset() {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.player != nil {
		o.player.Close()
		o.player = nil
	}
	if o.r != nil {
		o.r.finish()
		o.r = newPCMReader()
	}
}

func (o *otoOutput) close() {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.closed = true
	if o.player != nil {
		o.player.Close()
		o.player = nil
	}
	if o.r != nil {
		o.r.finish()
		o.r = nil
	}
}

// normalizeDecoded resamples a freshly decoded track to the fixed oto output
// rate and stereo so the single process-wide oto.Context can play it. Most
// music is 44.1 or 48 kHz; upsampling to 48 kHz with linear interpolation is
// alias-free (downsampling high-rate files would be, hence 48 kHz as the
// canonical rate).
func normalizeDecoded(d *Decoded) {
	if d == nil || (d.SampleRate == otoSampleRate && d.Channels == otoChannels) {
		return
	}
	d.PCM = resamplePCM(d.PCM, d.SampleRate, d.Channels, otoSampleRate, otoChannels)
	d.SampleRate = otoSampleRate
	d.Channels = otoChannels
}

func resamplePCM(pcm []int16, srcRate, srcCh, dstRate, dstCh int) []int16 {
	if srcRate <= 0 || srcCh <= 0 || dstRate <= 0 || dstCh <= 0 || len(pcm) == 0 {
		return pcm
	}
	srcFrames := len(pcm) / srcCh
	if srcFrames == 0 {
		return pcm
	}
	dstFrames := srcFrames * dstRate / srcRate
	if dstFrames <= 0 {
		return pcm
	}
	out := make([]int16, dstFrames*dstCh)
	ratio := float64(srcRate) / float64(dstRate)
	for i := 0; i < dstFrames; i++ {
		sp := float64(i) * ratio
		i0 := int(sp)
		if i0 >= srcFrames {
			i0 = srcFrames - 1
		}
		i1 := i0 + 1
		if i1 >= srcFrames {
			i1 = srcFrames - 1
		}
		frac := float32(sp - float64(i0))
		for c := 0; c < dstCh; c++ {
			sc := c
			if sc >= srcCh {
				sc = srcCh - 1 // mono→stereo duplicates the channel
			}
			s0 := float32(pcm[i0*srcCh+sc])
			s1 := float32(pcm[i1*srcCh+sc])
			out[i*dstCh+c] = int16(s0 + (s1-s0)*frac)
		}
	}
	return out
}
