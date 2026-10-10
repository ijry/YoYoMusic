//go:build windows

package audio

import (
	"fmt"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

var (
	modWinmm             = syscall.NewLazyDLL("winmm.dll")
	procWaveOutOpen      = modWinmm.NewProc("waveOutOpen")
	procWaveOutClose     = modWinmm.NewProc("waveOutClose")
	procWaveOutPrepare   = modWinmm.NewProc("waveOutPrepareHeader")
	procWaveOutUnprepare = modWinmm.NewProc("waveOutUnprepareHeader")
	procWaveOutWrite     = modWinmm.NewProc("waveOutWrite")
	procWaveOutPause     = modWinmm.NewProc("waveOutPause")
	procWaveOutRestart   = modWinmm.NewProc("waveOutRestart")
	procWaveOutReset     = modWinmm.NewProc("waveOutReset")
	procWaveOutPosition  = modWinmm.NewProc("waveOutGetPosition")
)

const (
	waveMapper     = 0xFFFFFFFF
	waveFormatPCM  = 1
	callbackNull   = 0
	whdrDone       = 1
	whdrPrepared   = 2
	timeSamples    = 2
	mmSysErrNoErr  = 0
	maxChunkSample = 8192
)

// waveFormatEx is the WAVEFORMATEX PCM descriptor (18 bytes on amd64).
type waveFormatEx struct {
	wFormatTag      uint16
	nChannels       uint16
	nSamplesPerSec  uint32
	nAvgBytesPerSec uint32
	nBlockAlign     uint16
	wBitsPerSample  uint16
	cbSize          uint16
}

// waveHdr is the WAVEHDR structure (48 bytes on amd64).
type waveHdr struct {
	lpData          uintptr
	dwBufferLength  uint32
	dwBytesRecorded uint32
	dwUser          uintptr
	dwFlags         uint32
	dwLoops         uint32
	lpNext          uintptr
	reserved        uintptr
}

// mmTime is the MMTIME union queried in TIME_SAMPLES mode.
type mmTime struct {
	wType uint32
	// union: ms / sample / cb / ticks / smpte / midi — only the first
	// 4 bytes (sample) are read after setting wType to timeSamples.
	sample uint32
	_      [8]byte
}

type winBuf struct {
	hdr  waveHdr
	data []byte
}

// winOutput plays PCM through the Windows multimedia waveform API.
type winOutput struct {
	mu         sync.Mutex
	h          syscall.Handle
	sr, ch     int
	pool       []*winBuf
	inflight   []*winBuf
	cond       *sync.Cond
	closed     bool
	reaperDone chan struct{}
}

func newPlatformOutput() audioOutput { return &winOutput{} }

func (o *winOutput) open(sampleRate, channels int) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.cond == nil {
		o.cond = sync.NewCond(&o.mu)
	}
	o.sr, o.ch = sampleRate, channels
	if o.sr == 0 {
		return fmt.Errorf("invalid sample rate")
	}
	if o.ch == 0 {
		o.ch = 1
	}
	wfx := waveFormatEx{
		wFormatTag:     waveFormatPCM,
		nChannels:      uint16(o.ch),
		nSamplesPerSec: uint32(o.sr),
		wBitsPerSample: 16,
	}
	wfx.nBlockAlign = uint16(o.ch * 2)
	wfx.nAvgBytesPerSec = uint32(o.sr) * uint32(wfx.nBlockAlign)

	var h syscall.Handle
	r, _, _ := procWaveOutOpen.Call(
		uintptr(unsafe.Pointer(&h)),
		uintptr(waveMapper),
		uintptr(unsafe.Pointer(&wfx)),
		0, 0, callbackNull,
	)
	if r != mmSysErrNoErr {
		return fmt.Errorf("waveOutOpen failed: %d", r)
	}
	o.h = h

	bytesPerChunk := int(maxChunkSample) * o.ch * 2
	const nBufs = 8
	o.pool = o.pool[:0]
	for i := 0; i < nBufs; i++ {
		o.pool = append(o.pool, &winBuf{data: make([]byte, bytesPerChunk)})
	}
	o.inflight = o.inflight[:0]
	o.closed = false
	o.reaperDone = make(chan struct{})
	go o.reaper()
	return nil
}

// reaper recycles buffers whose playback has finished.
// reaper recycles buffers whose playback has finished. One reusable ticker
// drives the cadence: time.After here would allocate a Timer and a channel
// five times a second for the life of the process, which cannot be reclaimed
// until it fires.
func (o *winOutput) reaper() {
	tick := time.NewTicker(5 * time.Millisecond)
	defer tick.Stop()
	for {
		o.mu.Lock()
		if o.closed {
			o.mu.Unlock()
			return
		}
		kept := o.inflight[:0]
		for _, b := range o.inflight {
			if b.hdr.dwFlags&whdrDone != 0 {
				if b.hdr.dwFlags&whdrPrepared != 0 {
					procWaveOutUnprepare.Call(uintptr(o.h), uintptr(unsafe.Pointer(&b.hdr)), unsafe.Sizeof(b.hdr))
				}
				o.pool = append(o.pool, b)
			} else {
				kept = append(kept, b)
			}
		}
		o.inflight = kept
		if len(o.pool) > 0 {
			o.cond.Broadcast()
		}
		o.mu.Unlock()
		select {
		case <-o.reaperDone:
			return
		case <-tick.C:
		}
	}
}

// write enqueues a chunk of interleaved int16 PCM. It blocks (bounded) until
// a buffer is free, dropping the chunk if the device cannot keep up so the
// caller never deadlocks.
func (o *winOutput) write(samples []int16) error {
	o.mu.Lock()
	if o.closed || o.h == 0 {
		o.mu.Unlock()
		return nil
	}
	// wait for a free buffer (bounded), polling to respect the deadline.
	deadline := time.Now().Add(250 * time.Millisecond)
	for len(o.pool) == 0 {
		if time.Now().After(deadline) {
			o.mu.Unlock()
			return fmt.Errorf("audio buffer underrun")
		}
		o.mu.Unlock()
		time.Sleep(4 * time.Millisecond)
		o.mu.Lock()
		if o.closed || o.h == 0 {
			o.mu.Unlock()
			return nil
		}
	}
	b := o.pool[len(o.pool)-1]
	o.pool = o.pool[:len(o.pool)-1]
	o.mu.Unlock()

	n := len(samples)
	if n*2 > len(b.data) {
		n = len(b.data) / 2
	}
	for i := 0; i < n; i++ {
		v := samples[i]
		b.data[i*2] = byte(v)
		b.data[i*2+1] = byte(v >> 8)
	}
	b.hdr = waveHdr{lpData: uintptr(unsafe.Pointer(&b.data[0])), dwBufferLength: uint32(n * 2)}
	rp, _, _ := procWaveOutPrepare.Call(uintptr(o.h), uintptr(unsafe.Pointer(&b.hdr)), unsafe.Sizeof(b.hdr))
	if rp != mmSysErrNoErr {
		o.mu.Lock()
		o.pool = append(o.pool, b)
		o.mu.Unlock()
		return fmt.Errorf("waveOutPrepareHeader failed: %d", rp)
	}
	rw, _, _ := procWaveOutWrite.Call(uintptr(o.h), uintptr(unsafe.Pointer(&b.hdr)), unsafe.Sizeof(b.hdr))
	if rw != mmSysErrNoErr {
	} else {
	}

	o.mu.Lock()
	o.inflight = append(o.inflight, b)
	o.mu.Unlock()
	return nil
}

func (o *winOutput) pause() {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.h != 0 {
		procWaveOutPause.Call(uintptr(o.h))
	}
}

func (o *winOutput) resume() {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.h != 0 {
		procWaveOutRestart.Call(uintptr(o.h))
	}
}

func (o *winOutput) reset() {
	o.mu.Lock()
	if o.h != 0 {
		procWaveOutReset.Call(uintptr(o.h))
	}
	o.mu.Unlock()
}

func (o *winOutput) close() {
	o.mu.Lock()
	if o.closed || o.h == 0 {
		o.mu.Unlock()
		return
	}
	o.closed = true
	h := o.h
	o.h = 0
	if o.reaperDone != nil {
		close(o.reaperDone)
	}
	o.mu.Unlock()
	procWaveOutReset.Call(uintptr(h))
	for _, b := range o.inflight {
		if b.hdr.dwFlags&whdrPrepared != 0 {
			procWaveOutUnprepare.Call(uintptr(h), uintptr(unsafe.Pointer(&b.hdr)), unsafe.Sizeof(b.hdr))
		}
	}
	procWaveOutClose.Call(uintptr(h))
}

// played returns the number of samples the device has output so far. It is
// unused by the clock-driven transport but kept for diagnostics.
func (o *winOutput) played() int64 {
	o.mu.Lock()
	h := o.h
	o.mu.Unlock()
	if h == 0 {
		return 0
	}
	var mt mmTime
	mt.wType = timeSamples
	r, _, _ := procWaveOutPosition.Call(uintptr(h), uintptr(unsafe.Pointer(&mt)), unsafe.Sizeof(mt))
	if r != mmSysErrNoErr {
		return 0
	}
	return int64(mt.sample)
}

// normalizeDecoded is a no-op on Windows: the waveOut backend opens its
// device at the track's native rate, so there is no fixed-rate context to
// match and no resampling is needed.
func normalizeDecoded(*Decoded) {}
