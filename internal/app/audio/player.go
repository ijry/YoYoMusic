package audio

import (
	"math"
	"sync"
	"time"
)

// audioOutput is the platform audio sink. The engine feeds it interleaved
// int16 PCM; on platforms without a backend it is a no-op so the
// visualiser still runs from the clock-driven position.
type audioOutput interface {
	open(sampleRate, channels int) error
	write(samples []int16) error
	pause()
	resume()
	reset()
	close()
}

// Player decodes a clip into memory, synthesises per-frame SignalFrames for
// the visualiser, applies a ten-band equaliser, and (where supported) plays
// the sound. Playback position is clock-driven so the analyser works even if
// the audio backend is unavailable.
type Player struct {
	mu           sync.Mutex
	dec          *Decoded
	mono         []float32
	sr           int
	ch           int
	total        int64 // samples per channel
	playing      bool
	playStart    time.Time
	pausedSample int64
	lastWritten  int64
	vol          float64
	muted        bool
	eq           *EQ
	out          audioOutput
	analyser     *Analyser
	lastFrame    SignalFrame
	smoothing    float64
	onEnd        func()
	closeCh      chan struct{}
	started      bool

	// win is the reusable window buffer analyseAt fills each tick.
	win []float32
	// fbuf/obuf are the reusable PCM conversion buffers feedTo fills each
	// tick; sized for the track's channel count on first use.
	fbuf []float32
	obuf []int16
	// lastAnalyse is when the previous analysis ran, giving the analyser a
	// real dt for its attack/release and peak decay.
	lastAnalyse time.Time

	// eqBands/eqEnabled are the user's live equaliser settings, kept here
	// so Load can re-apply them after rebuilding the filter chain for a
	// new sample rate.
	eqBands   [10]float64
	eqEnabled bool
}

// NewPlayer creates an idle player.
func NewPlayer() *Player {
	p := &Player{
		vol: 0.8,
		// 1024 samples at 44.1 kHz is a ~23 ms window: the same one the
		// original visualiser uses. Small enough that the bars respond
		// quickly, large enough that one bin spans ~43 Hz so the bass bands
		// have something to read.
		analyser:  NewAnalyser(1024),
		smoothing: 0.55,
		closeCh:   make(chan struct{}),
	}
	p.eq = NewEQ(44100)
	return p
}

// Load prepares a freshly decoded clip for playback and opens the audio
// backend. A backend that fails to open is treated as silent: the
// visualiser keeps working from the clock.
func (p *Player) Load(dec *Decoded) error {
	p.mu.Lock()
	if p.out != nil {
		p.out.close()
		p.out = nil
	}
	p.dec = dec
	p.sr = dec.SampleRate
	p.ch = dec.Channels
	if p.ch <= 0 {
		p.ch = 1
	}
	p.total = int64(len(dec.PCM)) / int64(p.ch)
	p.playing = false
	p.pausedSample = 0
	p.lastWritten = 0
	p.mono = p.buildMono(dec)
	p.win = make([]float32, p.analyser.size)
	// Rebuild the band edges for this track's sample rate so a pitch always
	// lands in the same band regardless of what the file was encoded at.
	p.analyser.Rebuild(p.sr)
	p.analyser.Reset()
	p.lastAnalyse = time.Time{}
	// Keep the live equaliser settings across a track change: rebuilding it
	// flat here would silently discard the user's bands whenever a new
	// track is loaded. NewEQ re-seeds flat coefficients for the new sample
	// rate, then the stored gains are re-applied.
	p.eq = NewEQ(p.sr)
	p.eq.Update(p.eqBands, p.eqEnabled, p.ch)
	p.mu.Unlock()

	out := newPlatformOutput()
	if err := out.open(p.sr, p.ch); err != nil {
		out = nil
	}
	p.mu.Lock()
	p.out = out
	p.mu.Unlock()
	return nil
}

func (p *Player) buildMono(dec *Decoded) []float32 {
	mono := make([]float32, p.total)
	for i := int64(0); i < p.total; i++ {
		var s int32
		for c := 0; c < p.ch; c++ {
			s += int32(dec.PCM[i*int64(p.ch)+int64(c)])
		}
		mono[i] = float32(s) / float32(p.ch) / 32768
	}
	return mono
}

// Start launches the playback/analysis goroutine exactly once.
func (p *Player) Start() {
	p.mu.Lock()
	if p.started {
		p.mu.Unlock()
		return
	}
	p.started = true
	p.mu.Unlock()
	go p.loop()
}

// Play begins (or resumes) playback.
func (p *Player) Play() {
	p.mu.Lock()
	if p.dec == nil {
		p.mu.Unlock()
		return
	}
	if !p.playing {
		if p.pausedSample >= p.total {
			p.pausedSample = 0
			p.lastWritten = 0
		}
		// Prebuffer before the clock starts so the device has audio ready
		// when playStart begins: otherwise the first tens of milliseconds
		// are silent and the start feels unresponsive.
		out := p.out
		if out != nil && p.lastWritten < p.pausedSample+int64(p.sr)/10 {
			dec, eq, vol, muted, ch := p.dec, p.eq, p.vol, p.muted, p.ch
			lead := int64(p.sr) / 10
			feedTo := p.pausedSample + lead
			if feedTo > p.total {
				feedTo = p.total
			}
			p.mu.Unlock()
			p.feedTo(out, dec, eq, vol, muted, ch, feedTo)
			p.mu.Lock()
		}
		p.playing = true
		p.playStart = time.Now()
		if p.out != nil {
			p.out.resume()
		}
	}
	p.mu.Unlock()
}

// Pause halts playback, freezing the position.
func (p *Player) Pause() {
	p.mu.Lock()
	if p.playing {
		p.pausedSample = p.positionSamplesLocked()
		p.playing = false
		if p.out != nil {
			p.out.pause()
		}
	}
	p.mu.Unlock()
}

// TogglePlay flips between playing and paused.
func (p *Player) TogglePlay() {
	p.mu.Lock()
	playing := p.playing
	p.mu.Unlock()
	if playing {
		p.Pause()
	} else {
		p.Play()
	}
}

// Stop ends playback and rewinds to the start.
func (p *Player) Stop() {
	p.mu.Lock()
	p.playing = false
	p.pausedSample = 0
	p.lastWritten = 0
	if p.out != nil {
		p.out.reset()
	}
	p.mu.Unlock()
}

// SeekMs moves the playhead to the given millisecond offset.
func (p *Player) SeekMs(ms int64) {
	p.mu.Lock()
	if p.total == 0 || p.sr <= 0 {
		p.mu.Unlock()
		return
	}
	sample := ms * int64(p.sr) / 1000
	if sample < 0 {
		sample = 0
	}
	if sample > p.total {
		sample = p.total
	}
	p.pausedSample = sample
	p.lastWritten = sample
	if p.out != nil {
		p.out.reset()
	}
	if p.playing {
		p.playStart = time.Now()
		if p.out != nil {
			p.out.resume()
		}
	}
	p.mu.Unlock()
}

// positionSamplesLocked returns the clock-driven playhead in samples. Caller
// holds the lock (or it is safe without, since it reads playing/pausedSample
// which are only mutated under the lock).
func (p *Player) positionSamplesLocked() int64 {
	if !p.playing {
		return p.pausedSample
	}
	elapsed := time.Since(p.playStart).Seconds()
	pos := p.pausedSample + int64(elapsed*float64(p.sr))
	if pos > p.total {
		pos = p.total
	}
	return pos
}

// PositionMs returns the current playhead in milliseconds.
func (p *Player) PositionMs() int64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.sr <= 0 {
		return 0
	}
	return p.positionSamplesLocked() * 1000 / int64(p.sr)
}

// DurationMs returns the clip length in milliseconds.
func (p *Player) DurationMs() int64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.sr <= 0 {
		return 0
	}
	return p.total * 1000 / int64(p.sr)
}

// IsPlaying reports transport state.
func (p *Player) IsPlaying() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.playing
}

// SetVolume sets the linear volume (0..1).
func (p *Player) SetVolume(v float64) {
	p.mu.Lock()
	if v < 0 {
		v = 0
	}
	if v > 1 {
		v = 1
	}
	p.vol = v
	p.mu.Unlock()
}

// SetMuted toggles muting.
func (p *Player) SetMuted(m bool) {
	p.mu.Lock()
	p.muted = m
	p.mu.Unlock()
}

// SetEQ updates the ten band gains (dB) and enabled flag.
func (p *Player) SetEQ(bands [10]float64, enabled bool) {
	p.mu.Lock()
	p.eqBands, p.eqEnabled = bands, enabled
	if p.eq != nil {
		p.eq.Update(bands, enabled, p.ch)
	}
	p.mu.Unlock()
}

// SetOnEnd registers a callback invoked (on a goroutine) when a track ends.
func (p *Player) SetOnEnd(fn func()) {
	p.mu.Lock()
	p.onEnd = fn
	p.mu.Unlock()
}

// Close stops playback and releases the audio backend.
func (p *Player) Close() {
	p.mu.Lock()
	if p.out != nil {
		p.out.close()
		p.out = nil
	}
	p.playing = false
	p.mu.Unlock()
	select {
	case <-p.closeCh:
	default:
		close(p.closeCh)
	}
}

// Frame returns the current visualiser frame, idle-synthesised when nothing
// is playing.
func (p *Player) Frame() SignalFrame {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.dec == nil || !p.playing {
		return p.idleFrame()
	}
	return p.lastFrame
}

// loop drives playback. It uses one reusable ticker per cadence rather than
// time.After in the select: time.After allocates a Timer and a channel every
// iteration and they cannot be reclaimed until they fire, which measured as
// the single largest allocation source in the whole app (92% of allocs).
func (p *Player) loop() {
	const (
		idleTick = 30 * time.Millisecond
		playTick = 16 * time.Millisecond
	)
	idle := time.NewTicker(idleTick)
	play := time.NewTicker(playTick)
	defer idle.Stop()
	defer play.Stop()

	for {
		p.mu.Lock()
		playing := p.playing
		p.mu.Unlock()
		if !playing {
			select {
			case <-p.closeCh:
				return
			case <-idle.C:
				continue
			}
		}
		p.tick()
		select {
		case <-p.closeCh:
			return
		case <-play.C:
		}
	}
}

// tick advances playback one step: feeds the backend ahead of the clock
// position and refreshes the analysed frame.
func (p *Player) tick() {
	p.mu.Lock()
	pos := p.positionSamplesLocked()
	total := p.total
	dec := p.dec
	vol := p.vol
	muted := p.muted
	out := p.out
	eq := p.eq
	sr := p.sr
	ch := p.ch
	p.mu.Unlock()

	if dec == nil {
		return
	}
	if pos >= total {
		p.mu.Lock()
		p.playing = false
		p.pausedSample = total
		if p.out != nil {
			p.out.reset()
		}
		onEnd := p.onEnd
		p.mu.Unlock()
		if onEnd != nil {
			go onEnd()
		}
		return
	}

	if out != nil {
		// Feed the device ahead of the clock. Writing only up to the current
		// playhead leaves the device ~33ms of audio, so any scheduling
		// hiccup starves it and the sound stutters or drops out. Keeping a
		// lead buffer makes playback smooth.
		lead := int64(p.sr) / 20 // 50ms of samples
		feedTo := pos + lead
		if feedTo > total {
			feedTo = total
		}
		p.feedTo(out, dec, eq, vol, muted, ch, feedTo)
	}
	p.analyseAt(pos, sr)
}

// feedTo writes interleaved PCM from lastWritten up to `upTo`, applying
// volume, muting and the equaliser.
//
// The scratch buffers live on the Player, not here: feedTo runs 60 times a
// second, and allocating them per call measured at 6 MB/s — 21 GB an hour of
// garbage, which is what kept RSS in the hundreds of MB.
func (p *Player) feedTo(out audioOutput, dec *Decoded, eq *EQ, vol float64, muted bool, ch int, upTo int64) {
	p.mu.Lock()
	start := p.lastWritten
	p.mu.Unlock()
	if start >= upTo {
		return
	}
	if muted {
		vol = 0
	}
	const maxChunk = 8192 // samples per channel per iteration
	// Grown to fit this track's channel count, then reused for every chunk.
	if cap(p.fbuf) < maxChunk*ch {
		p.fbuf = make([]float32, maxChunk*ch)
		p.obuf = make([]int16, maxChunk*ch)
	}
	fbuf, buf := p.fbuf[:maxChunk*ch], p.obuf[:maxChunk*ch]
	for start < upTo {
		end := upTo
		if end-start > maxChunk {
			end = start + maxChunk
		}
		n := int(end-start) * ch
		idx0 := int(start) * ch
		if n > len(fbuf) {
			n = len(fbuf)
			end = start + int64(n/ch)
		}
		fb := fbuf[:n]
		for i := 0; i < n; i++ {
			fb[i] = float32(dec.PCM[idx0+i]) / 32768
		}
		if vol != 1 {
			for i := 0; i < n; i++ {
				fb[i] *= float32(vol)
			}
		}
		if eq != nil {
			eq.Process(fb, ch)
		}
		ob := buf[:n]
		for i := 0; i < n; i++ {
			v := fb[i] * 32768
			if v > 32767 {
				v = 32767
			} else if v < -32768 {
				v = -32768
			}
			ob[i] = int16(int(v))
		}
		_ = out.write(ob)
		start = end
	}
	p.mu.Lock()
	p.lastWritten = upTo
	p.mu.Unlock()
}

// analyseAt refreshes the smoothed frame from a window of mono samples
// around the playhead.
func (p *Player) analyseAt(pos int64, sr int) {
	w := p.analyser.size
	start := pos - int64(w)/2
	if start < 0 {
		start = 0
	}
	win := p.win[:w]
	for i := 0; i < w; i++ {
		idx := start + int64(i)
		if idx >= p.total {
			idx = p.total - 1
		}
		if idx < 0 {
			idx = 0
		}
		win[i] = p.mono[idx]
	}
	// The analyser owns attack/release smoothing, peak decay and the beat
	// envelope; smoothing again here would double-lag every transition and
	// make the display feel sluggish.
	now := time.Now()
	dt := float32(now.Sub(p.lastAnalyse).Seconds())
	if p.lastAnalyse.IsZero() {
		dt = 1.0 / 60
	}
	p.lastAnalyse = now
	f := p.analyser.Analyse(win, sr, dt)

	p.mu.Lock()
	p.lastFrame = f
	p.mu.Unlock()
}

// idleFrame synthesises a calm, time-varying frame so the visualiser is
// never dead while paused or before a track loads.
// idleFrame synthesises a calm, time-varying frame so the visualiser is never
// dead while paused or before a track loads. The bands keep a pink-ish tilt
// and a per-band wander, so an idle player shows a shaped resting spectrum
// rather than a flat strip or a frozen frame.
func (p *Player) idleFrame() SignalFrame {
	t := float64(time.Now().UnixNano()) / 1e9
	var f SignalFrame
	breath := 1 + math.Sin(t*0.9)*0.35
	for i := 0; i < BandCount; i++ {
		ratio := float64(i) / float64(BandCount-1)
		// Tilt: more energy in the low end, like real music.
		tilt := math.Pow(1-ratio, 1.35)*0.88 + 0.12
		wander := 0.5 + 0.5*math.Sin(t*1.3+float64(i)*0.7)
		v := 0.045 * breath * tilt * (0.7 + ratio*0.6) * (0.55 + wander*0.8)
		if v < 0 {
			v = 0
		}
		f.Bands[i] = float32(v)
	}
	for i := 0; i < WaveSamples; i++ {
		v := 0.10 * math.Sin(t*2.2+float64(i)*0.08) *
			math.Sin(t*0.7+float64(i)*0.013)
		f.Wave[i] = float32(v)
	}
	f.Level = 0.06
	f.Beat = 0
	return f
}
