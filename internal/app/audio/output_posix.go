//go:build !windows

package audio

// noopOutput is the audio sink used where a native backend is unavailable
// (or not yet implemented). The visualiser still runs from the clock-driven
// position, just without sound.
type noopOutput struct{}

func newPlatformOutput() audioOutput { return &noopOutput{} }

func (o *noopOutput) open(sampleRate, channels int) error { return nil }
func (o *noopOutput) write(samples []int16) error         { return nil }
func (o *noopOutput) pause()                              {}
func (o *noopOutput) resume()                             {}
func (o *noopOutput) reset()                              {}
func (o *noopOutput) close()                              {}
