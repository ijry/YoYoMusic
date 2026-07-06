import { useEffect, useState } from "react";
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
  const volumeNeedleRotation = `${Math.round(volumePercent * 2.4 - 120)}deg`;
  const currentPlayModeLabel = playModeLabel(state.playMode);
  const canUseTransport = Boolean(state.trackId) || hasPlayableTrack;
  const canSeek = Boolean(state.trackId) && state.durationMs > 0;

  useEffect(() => {
    setVolumeInput(String(volumePercent));
  }, [volumePercent]);

  return (
    <section className="player-controls player-controls--deck" aria-label="播放控制">
      <div className="transport-status-strip" aria-label="控制台状态">
        <span className="transport-status-light">{state.isPlaying ? "播放中" : "待机"}</span>
        <span className="transport-status-light">{state.isMuted ? "静音" : "输出正常"}</span>
        <span className="transport-status-light">模式 {currentPlayModeLabel}</span>
      </div>

      <div className="transport-row transport-row--deck">
        <button
          type="button"
          className="transport-button transport-button--prev"
          disabled={!canUseTransport}
          onClick={() => onCommand("previous_track", {})}
        >
          上一首
        </button>
        <button
          type="button"
          className="transport-button transport-button--play"
          disabled={!canUseTransport}
          onClick={() => onCommand("toggle_playback", {})}
        >
          {state.isPlaying ? "暂停" : "播放"}
        </button>
        <button
          type="button"
          className="transport-button transport-button--next"
          disabled={!canUseTransport}
          onClick={() => onCommand("next_track", {})}
        >
          下一首
        </button>
        <button
          type="button"
          className="transport-button transport-button--mute"
          onClick={() => onCommand("set_muted", { value: !state.isMuted })}
        >
          {state.isMuted ? "取消静音" : "静音"}
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

      <label className="control-field control-field--compact control-field--volume control-monitor">
        <span className="control-label">音量</span>
        <span className="volume-well" aria-hidden="true">
          <span className="volume-well__ring" />
          <span className="volume-well__tick" style={{ transform: `rotate(${volumeNeedleRotation})` }} />
        </span>
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
        onClick={() => onCommand("set_play_mode", { playMode: nextPlayMode(state.playMode) })}
      >
        播放模式：{currentPlayModeLabel}
      </button>
    </section>
  );
}

function nextPlayMode(mode: PlaybackState["playMode"]): PlaybackState["playMode"] {
  if (mode === "sequence") return "repeat_all";
  if (mode === "repeat_all") return "repeat_one";
  if (mode === "repeat_one") return "shuffle";
  return "sequence";
}

function playModeLabel(mode: PlaybackState["playMode"]) {
  if (mode === "repeat_all") return "列表循环";
  if (mode === "repeat_one") return "单曲循环";
  if (mode === "shuffle") return "随机播放";
  return "顺序播放";
}
