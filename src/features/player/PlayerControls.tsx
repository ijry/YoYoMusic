import { useEffect, useState } from "react";
import type { CommandName, CommandPayload } from "../../shared/tauri";
import type { PlaybackState } from "../../shared/types";

interface PlayerControlsProps {
  state: PlaybackState;
  onCommand: (command: CommandName, payload: CommandPayload) => void;
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PlayerControls({ state, onCommand }: PlayerControlsProps) {
  const volumePercent = Math.round(state.volume * 100);
  const [volumeInput, setVolumeInput] = useState(String(volumePercent));

  useEffect(() => {
    setVolumeInput(String(volumePercent));
  }, [volumePercent]);

  return (
    <section className="player-controls" aria-label="播放控制">
      <div className="transport-row">
        <button type="button" onClick={() => onCommand("previous_track", {})}>
          上一首
        </button>
        <button type="button" onClick={() => onCommand("toggle_playback", {})}>
          {state.isPlaying ? "暂停" : "播放"}
        </button>
        <button type="button" onClick={() => onCommand("next_track", {})}>
          下一首
        </button>
        <button type="button" onClick={() => onCommand("set_muted", { value: !state.isMuted })}>
          {state.isMuted ? "取消静音" : "静音"}
        </button>
      </div>

      <label className="control-field">
        <span>播放进度</span>
        <input
          aria-label="播放进度"
          type="range"
          min="0"
          max={Math.max(state.durationMs, 1)}
          value={state.positionMs}
          onChange={(event) => onCommand("seek", { positionMs: Number(event.currentTarget.value) })}
        />
        <span>
          {formatTime(state.positionMs)} / {formatTime(state.durationMs)}
        </span>
      </label>

      <label className="control-field control-field--compact">
        <span>音量</span>
        <input
          aria-label="音量"
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
        className="play-mode-button"
        onClick={() => onCommand("set_play_mode", { playMode: nextPlayMode(state.playMode) })}
      >
        播放模式：{playModeLabel(state.playMode)}
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
