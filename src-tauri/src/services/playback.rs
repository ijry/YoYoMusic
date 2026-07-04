use crate::models::{PlayMode, PlaybackState, Track};

#[derive(Debug)]
pub struct PlaybackService {
    state: PlaybackState,
}

impl Default for PlaybackService {
    fn default() -> Self {
        Self::new_null()
    }
}

impl PlaybackService {
    pub fn new_null() -> Self {
        Self {
            state: PlaybackState {
                track_id: None,
                position_ms: 0,
                duration_ms: 0,
                volume: 0.8,
                is_playing: false,
                is_muted: false,
                play_mode: PlayMode::Sequence,
                eq_enabled: false,
            },
        }
    }

    pub fn current_state(&self) -> PlaybackState {
        self.state.clone()
    }

    pub fn play(&mut self, track: Track) -> PlaybackState {
        self.state.track_id = Some(track.id);
        self.state.duration_ms = track.duration_ms;
        self.state.position_ms = 0;
        self.state.is_playing = true;
        self.current_state()
    }

    pub fn pause(&mut self) -> PlaybackState {
        self.state.is_playing = false;
        self.current_state()
    }

    pub fn toggle(&mut self) -> PlaybackState {
        self.state.is_playing = !self.state.is_playing;
        self.current_state()
    }

    pub fn seek(&mut self, position_ms: u64) -> PlaybackState {
        self.state.position_ms = position_ms.min(self.state.duration_ms);
        self.current_state()
    }

    pub fn set_volume(&mut self, volume: f32) -> PlaybackState {
        self.state.volume = volume.clamp(0.0, 1.0);
        self.current_state()
    }

    pub fn set_muted(&mut self, is_muted: bool) -> PlaybackState {
        self.state.is_muted = is_muted;
        self.current_state()
    }

    pub fn set_play_mode(&mut self, play_mode: PlayMode) -> PlaybackState {
        self.state.play_mode = play_mode;
        self.current_state()
    }
}

#[cfg(test)]
mod tests {
    use super::PlaybackService;

    #[test]
    fn clamps_volume_between_zero_and_one() {
        let mut service = PlaybackService::new_null();
        assert_eq!(service.set_volume(1.2).volume, 1.0);
        assert_eq!(service.set_volume(-0.5).volume, 0.0);
    }

    #[test]
    fn toggle_flips_playing_state() {
        let mut service = PlaybackService::new_null();
        assert!(!service.current_state().is_playing);
        assert!(service.toggle().is_playing);
        assert!(!service.toggle().is_playing);
    }
}
