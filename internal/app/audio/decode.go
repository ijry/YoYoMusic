package audio

import (
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gopxl/beep"
	"github.com/gopxl/beep/flac"
	"github.com/gopxl/beep/mp3"
	"github.com/gopxl/beep/vorbis"
	"github.com/gopxl/beep/wav"
)

// Decoded is a fully decoded clip held in memory as interleaved int16 PCM.
type Decoded struct {
	PCM        []int16
	SampleRate int
	Channels   int
	DurationMs int64
}

func ext(p string) string {
	i := strings.LastIndexByte(p, '.')
	if i < 0 {
		return ""
	}
	return strings.ToLower(p[i:])
}

// Decodable reports whether this build can decode the file at path. The
// library uses it to flag unplayable tracks up front instead of failing
// when the user tries to play them.
//
// Every decoder here is pure Go (matching mygo's no-cgo promise): beep
// wraps pure-Go MP3, FLAC and Ogg/Vorbis implementations. AAC and M4A are
// absent because no pure-Go AAC decoder exists - the common ones all bind
// the fdk-aac C library through cgo.
func Decodable(path string) bool {
	switch ext(path) {
	case ".wav", ".mp3", ".flac", ".ogg":
		return true
	default:
		return false
	}
}

// SupportedExtensions lists what Decode can handle, for the file dialog.
func SupportedExtensions() []string {
	return []string{"wav", "mp3", "flac", "ogg"}
}

// Decode reads an audio file into memory. WAV, MP3, FLAC and Ogg/Vorbis are
// supported; everything else returns an error so the caller can mark the
// track unplayable.
func Decode(path string) (*Decoded, error) {
	switch ext(path) {
	case ".wav", ".mp3", ".flac", ".ogg":
		return decodeWithBeep(path)
	default:
		return nil, fmt.Errorf("unsupported audio format: %s", ext(path))
	}
}

// decodeWithBeep routes the file to the matching beep decoder and drains the
// resulting stream into interleaved int16 PCM. beep always hands out
// [][2]float64 samples normalised to [-1, 1], so a mono source is expanded to
// two channels here.
func decodeWithBeep(path string) (*Decoded, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var (
		streamer beep.StreamSeekCloser
		format   beep.Format
	)
	switch ext(path) {
	case ".mp3":
		streamer, format, err = mp3.Decode(readSeekCloser{f})
	case ".flac":
		streamer, format, err = flac.Decode(f)
	case ".ogg":
		streamer, format, err = vorbis.Decode(readSeekCloser{f})
	default: // .wav
		streamer, format, err = wav.Decode(f)
	}
	if err != nil {
		return nil, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	defer streamer.Close()

	sr := int(format.SampleRate)
	ch := format.NumChannels
	if sr <= 0 || ch <= 0 {
		return nil, fmt.Errorf("bad audio format: sr=%d ch=%d", sr, ch)
	}

	// Preallocate when the stream knows its length; grow otherwise.
	var pcm []int16
	if l := streamer.Len(); l > 0 {
		pcm = make([]int16, 0, l*ch)
	}
	// beep yields at most its own buffer size per call; keep it small so a
	// long track does not allocate one huge slice.
	const chunk = 4096
	buf := make([][2]float64, chunk)
	for {
		n, ok := streamer.Stream(buf)
		for i := 0; i < n; i++ {
			l := clampToInt16(buf[i][0] * 32767)
			rt := clampToInt16(buf[i][1] * 32767)
			if ch == 1 {
				// Mono: duplicate the left channel so the mixer stays simple.
				pcm = append(pcm, l, l)
			} else {
				pcm = append(pcm, l, rt)
			}
		}
		if !ok {
			break
		}
	}
	// The streamer reports channels as beep's own count, but the data is
	// always written as stereo pairs above, so report what we stored.
	storedCh := 2
	if len(pcm) == 0 {
		return nil, fmt.Errorf("%s: decoded to no audio", filepath.Base(path))
	}
	dur := int64(len(pcm)/storedCh) * 1000 / int64(sr)
	return &Decoded{PCM: pcm, SampleRate: sr, Channels: storedCh, DurationMs: dur}, nil
}

func clampToInt16(v float64) int16 {
	if v > 32767 {
		return 32767
	}
	if v < -32768 {
		return -32768
	}
	return int16(v)
}

// readSeekCloser adapts an *os.File to the io.ReadSeekCloser the mp3 and
// vorbis decoders require.
type readSeekCloser struct{ f *os.File }

func (r readSeekCloser) Read(p []byte) (int, error) { return r.f.Read(p) }
func (r readSeekCloser) Seek(off int64, whence int) (int64, error) {
	return r.f.Seek(off, whence)
}
func (r readSeekCloser) Close() error { return nil }

// decodeWAV keeps a dependency-free WAV reader for callers that already hold
// the bytes; the streaming path in decodeWithBeep is used for playback.
func decodeWAVBytes(data []byte) (*Decoded, error) {
	if len(data) < 44 || string(data[0:4]) != "RIFF" || string(data[8:12]) != "WAVE" {
		return nil, fmt.Errorf("not a WAV file")
	}
	var sampleRate, channels, bits int
	var pcm []int16
	for i := 12; i+8 <= len(data); {
		chunkID := string(data[i : i+4])
		size := int(binary.LittleEndian.Uint32(data[i+4 : i+8]))
		body := data[i+8:]
		if i+8+size > len(data) {
			size = len(data) - (i + 8)
		}
		switch chunkID {
		case "fmt ":
			if size >= 16 {
				channels = int(binary.LittleEndian.Uint16(body[2:4]))
				sampleRate = int(binary.LittleEndian.Uint32(body[4:8]))
				bits = int(binary.LittleEndian.Uint16(body[14:16]))
			}
		case "data":
			if bits == 16 {
				n := size / 2
				pcm = make([]int16, n)
				for j := 0; j < n; j++ {
					pcm[j] = int16(binary.LittleEndian.Uint16(body[j*2:]))
				}
			} else if bits == 8 {
				n := size
				pcm = make([]int16, n)
				for j := 0; j < n; j++ {
					pcm[j] = int16(int(body[j])<<8 - 32768)
				}
			}
		}
		i += 8 + size
		if chunkID == "data" {
			break
		}
	}
	if sampleRate == 0 || channels == 0 {
		return nil, fmt.Errorf("malformed WAV header")
	}
	if len(pcm) == 0 {
		return nil, fmt.Errorf("no PCM data")
	}
	dur := int64(len(pcm)/channels) * 1000 / int64(sampleRate)
	return &Decoded{PCM: pcm, SampleRate: sampleRate, Channels: channels, DurationMs: dur}, nil
}
