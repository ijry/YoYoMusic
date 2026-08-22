import { useEffect, useState } from "react";
import { Icon } from "../../shared/icons";
import type { CommandName, CommandPayload } from "../../shared/tauri";
import type { PlaybackState } from "../../shared/types";

interface PlayerControlsProps {
  state: PlaybackState;
  hasPlayableTrack?: boolean;
  onCommand: (command: CommandName, payload: CommandPayload) => void;
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PlayerControls({ state, hasPlayableTrack = Boolean(state.trackId), onCommand }: PlayerControlsProps) {
  const volumePercent = Math.round(state.volume * 100);
  const [volumeInput, setVolumeInput] = useState(String(volumePercent));
  const currentPlayModeLabel = playModeLabel(state.playMode);
  const canUseTransport = Boolean(state.trackId) || hasPlayableTrack;
  const canSeek = Boolean(state.trackId) && state.durationMs > 0;
  const PlayModeIcon = playModeIcon(state.playMode);

  useEffect(() => {
    setVolumeInput(String(volumePercent));
  }, [volumePercent]);

  /*
   * Icon-only transport. Labels live on `aria-label` rather than in the button
   * body, so the control deck stays compact while screen readers (and the
   * role+name queries in the tests) still see "播放" / "下一首" / etc.
   */
  return (
    <section className="player-controls player-controls--deck" aria-label="播放控制">
      <div className="transport-row transport-row--deck">
        <button
          type="button"
          className="transport-button transport-button--prev"
          aria-label="上一首"
          title="上一首"
          disabled={!canUseTransport}
          onClick={() => onCommand("previous_track", {})}
        >
          <Icon.prev />
        </button>
        <button
          type="button"
          className="transport-button transport-button--play"
          aria-label={state.isPlaying ? "暂停" : "播放"}
          title={state.isPlaying ? "暂停" : "播放"}
          disabled={!canUseTransport}
          onClick={() => onCommand("toggle_playback", {})}
        >
          {state.isPlaying ? <Icon.pause /> : <Icon.play />}
        </button>
        <button
          type="button"
          className="transport-button transport-button--next"
          aria-label="下一首"
          title="下一首"
          disabled={!canUseTransport}
          onClick={() => onCommand("next_track", {})}
        >
          <Icon.next />
        </button>
      </div>

      <label className="control-field control-field--progress control-monitor">
        <span className="control-label">播放进度</span>
        <input
          aria-label="播放进度"
          className="progress-rail"
          type="range"
          min="0"
          max={Math.max(state.durationMs, 1)}
          value={state.positionMs}
          disabled={!canSeek}
          onChange={(event) => onCommand("seek", { positionMs: Number(event.currentTarget.value) })}
        />
        <span className="control-readout">
          {formatTime(state.positionMs)} / {formatTime(state.durationMs)}
        </span>
      </label>

      <div className="transport-row transport-row--utility">
        <button
          type="button"
          className="transport-button transport-button--mute"
          aria-label={state.isMuted ? "取消静音" : "静音"}
          title={state.isMuted ? "取消静音" : "静音"}
          onClick={() => onCommand("set_muted", { value: !state.isMuted })}
        >
          {state.isMuted ? <Icon.muted /> : <Icon.volume />}
        </button>

        <label className="control-field control-field--compact control-field--volume control-monitor">
          <span className="control-label">音量</span>
          <input
            aria-label="音量"
            className="volume-input"
            type="number"
            min="0"
            max="100"
            value={volumeInput}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setVolumeInput(nextValue);
              onCommand("set_volume", { value: Number(nextValue || 0) / 100 });
            }}
          />
        </label>

        <button
          type="button"
          className="play-mode-button play-mode-button--deck"
          aria-label={`播放模式：${currentPlayModeLabel}`}
          title={`播放模式：${currentPlayModeLabel}`}
          onClick={() => onCommand("set_play_mode", { playMode: nextPlayMode(state.playMode) })}
        >
          <PlayModeIcon />
        </button>
      </div>
    </section>
  );
}

function nextPlayMode(mode: PlaybackState["playMode"]): PlaybackState["playMode"] {
  if (mode === "sequence") return "repeat_all";
  if (mode === "repeat_all") return "repeat_one";
  if (mode === "repeat_one") return "shuffle";
  return "sequence";
}

function playModeIcon(mode: PlaybackState["playMode"]) {
  if (mode === "repeat_all") return Icon.repeatAll;
  if (mode === "repeat_one") return Icon.repeatOne;
  if (mode === "shuffle") return Icon.shuffle;
  return Icon.sequence;
}

function playModeLabel(mode: PlaybackState["playMode"]) {
  if (mode === "repeat_all") return "列表循环";
  if (mode === "repeat_one") return "单曲循环";
  if (mode === "shuffle") return "随机播放";
  return "顺序播放";
}
