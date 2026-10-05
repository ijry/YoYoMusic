import type { CSSProperties } from "react";
import { CoverArt } from "../../shared/coverArt";
import { Icon } from "../../shared/icons";
import type { CommandName, CommandPayload } from "../../shared/tauri";
import type { PlaybackState, Track } from "../../shared/types";
import { VolumeControl } from "./VolumeControl";

interface PlayerControlsProps {
  state: PlaybackState;
  hasPlayableTrack?: boolean;
  track?: Track | null;
  onCommand: (command: CommandName, payload: CommandPayload) => void;
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PlayerControls({
  state,
  hasPlayableTrack = Boolean(state.trackId),
  track = null,
  onCommand,
}: PlayerControlsProps) {
  const currentPlayModeLabel = playModeLabel(state.playMode);
  const canUseTransport = Boolean(state.trackId) || hasPlayableTrack;
  const canSeek = Boolean(state.trackId) && state.durationMs > 0;
  const PlayModeIcon = playModeIcon(state.playMode);
  const progressPercent = state.durationMs > 0 ? Math.min(100, (state.positionMs / state.durationMs) * 100) : 0;

  /*
   * Icon-only transport. Labels live on `aria-label` rather than in the button
   * body, so the deck stays compact while screen readers (and the role+name
   * queries in the tests) still see "播放" / "下一首" / etc.
   *
   * The now-playing display lives here rather than in its own panel above the
   * stage: the cover belongs next to the transport, and the stage is left
   * entirely to the visualiser.
   */
  return (
    <section className="player-controls" aria-label="播放控制">
      <section className="player-controls__now" aria-label="当前播放">
        <CoverArt
          seed={track?.id ?? ""}
          title={track?.title}
          isPlaying={state.isPlaying}
          className="cover-art--mini"
        />
        <span className="player-controls__copy">
          <strong title={track?.title}>{track?.title ?? "未装载曲目"}</strong>
          <span>{track?.artist || track?.album || "本地音乐库"}</span>
        </span>
      </section>

      <div className="player-controls__center">
        <div className="transport-row transport-row--deck">
          <button
            type="button"
            className="transport-button transport-button--prev"
            aria-label="上一首"
            title="上一首"
            disabled={!canUseTransport}
            onClick={() => onCommand("previous_track", {})}
          >
            <Icon.prev size={20} />
          </button>
          <button
            type="button"
            className="transport-button transport-button--play"
            aria-label={state.isPlaying ? "暂停" : "播放"}
            title={state.isPlaying ? "暂停" : "播放"}
            disabled={!canUseTransport}
            onClick={() => onCommand("toggle_playback", {})}
          >
            {state.isPlaying ? <Icon.pause size={22} /> : <Icon.play size={22} />}
          </button>
          <button
            type="button"
            className="transport-button transport-button--next"
            aria-label="下一首"
            title="下一首"
            disabled={!canUseTransport}
            onClick={() => onCommand("next_track", {})}
          >
            <Icon.next size={20} />
          </button>
        </div>

        <label className="control-field control-field--progress control-monitor">
          <span className="control-label">播放进度</span>
          <span className="control-readout">{formatTime(state.positionMs)}</span>
          <input
            aria-label="播放进度"
            className="progress-rail"
            type="range"
            min="0"
            max={Math.max(state.durationMs, 1)}
            value={state.positionMs}
            disabled={!canSeek}
            style={{ "--progress": `${progressPercent}%` } as CSSProperties}
            onChange={(event) => onCommand("seek", { positionMs: Number(event.currentTarget.value) })}
          />
          <span className="control-readout control-readout--muted">{formatTime(state.durationMs)}</span>
        </label>
      </div>

      <div className="transport-row transport-row--utility">
        {/*
         * Volume and mute share one control: the speaker opens a popover with
         * the slider and a mute toggle inside. Two separate affordances for one
         * setting was the redundancy.
         */}
        <VolumeControl
          volume={state.volume}
          isMuted={state.isMuted}
          onVolumeChange={(value) => onCommand("set_volume", { value })}
          onToggleMuted={() => onCommand("set_muted", { value: !state.isMuted })}
        />

        <button
          type="button"
          className="play-mode-button play-mode-button--deck"
          aria-label={`播放模式：${currentPlayModeLabel}`}
          title={`播放模式：${currentPlayModeLabel}`}
          onClick={() => onCommand("set_play_mode", { playMode: nextPlayMode(state.playMode) })}
        >
          <PlayModeIcon size={18} />
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
