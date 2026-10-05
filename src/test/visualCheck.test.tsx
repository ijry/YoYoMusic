import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { it } from "vitest";
import { builtInLayoutSkins, builtInLayoutSkinSummaries } from "../features/skin/layoutRegistry";
import type { PlayerLayoutProps } from "../features/skin/layoutTypes";
import type { AppSettings, PlaybackState, PlaylistSnapshot, Track } from "../shared/types";

/*
 * Dev-only visual harness. Renders every built-in skin to a static HTML file
 * under .visual-check/ so the real CSS can be screenshotted in a browser.
 * Not an assertion — it exists to make the skins reviewable by eye.
 */

const tracks: Track[] = [
  { id: "t1", path: "C:/music/01.flac", title: "夜航西飞", artist: "陈鸿宇", album: "浓烟下的诗歌电台", durationMs: 254000, status: "ready", coverKey: null },
  { id: "t2", path: "C:/music/02.flac", title: "云烟成雨", artist: "房东的猫", album: "云烟成雨", durationMs: 231000, status: "ready", coverKey: null },
  { id: "t3", path: "C:/music/03.flac", title: "秋天的信", artist: "李志", album: "被禁忌的游戏", durationMs: 198000, status: "ready", coverKey: null },
  { id: "t4", path: "C:/music/04.mp3", title: "斑马，斑马", artist: "宋冬野", album: "安和桥北", durationMs: 275000, status: "ready", coverKey: null },
  { id: "t5", path: "C:/music/05.mp3", title: "无法长大", artist: "刺猬", album: "无法长大", durationMs: 212000, status: "failed", coverKey: null },
];

const playlist: PlaylistSnapshot = {
  playlist: { id: "default", name: "当前播放列表", trackIds: tracks.map((t) => t.id), currentIndex: 1, playMode: "sequence" },
  tracks,
};

const playback: PlaybackState = {
  trackId: "t2", positionMs: 78000, durationMs: 231000, volume: 0.72,
  isPlaying: true, isMuted: false, playMode: "sequence", eqEnabled: true,
};

const settings: AppSettings = {
  defaultSkin: "aurora-glass",
  shortcuts: { toggle_playback: "Ctrl+Alt+P", previous_track: "Ctrl+Alt+Left", next_track: "Ctrl+Alt+Right" },
  enrichmentEnabled: true, cacheRetentionDays: 30, recentPlaylists: [], restoreSession: true,
  visualizationMode: "spectrum",
  equalizer: { enabled: true, preset: "flat", bands: [3, 2, 0, -1, -2, 0, 1, 2, 3, 4] },
};

function propsFor(panel: PlayerLayoutProps["activePanel"]): PlayerLayoutProps {
  return {
    playlist, playback, currentTrack: tracks[1], lyricsDocument: null, settings,
    skins: builtInLayoutSkinSummaries, activePanel: panel, libraryOpen: true,
    error: null, skinError: null, settingsErrorCode: null,
    onActivePanelChange: () => {}, onToggleLibrary: () => {}, onPlayerCommand: () => {}, onAddFiles: () => {},
    onAddFolder: () => {}, onClearPlaylist: () => {}, onSaveTags: () => {},
    onApplySkin: () => {}, onImportSkin: () => {}, onShortcutChange: () => {},
    onVisualizationModeChange: () => {}, onSettingsChange: () => {},
  };
}

it.runIf(process.env.VC === "1")("renders every skin to .visual-check/", () => {
  const root = process.cwd();
  const outDir = join(root, ".visual-check");
  mkdirSync(outDir, { recursive: true });

  const css = ["theme.css", "app.css", "skin-layouts.css"]
    .map((f) => readFileSync(join(root, "src/styles", f), "utf8"))
    .join("\n");

  const panel = (process.env.VC_PANEL as PlayerLayoutProps["activePanel"]) ?? "lyrics";

  for (const skin of builtInLayoutSkins) {
    const body = renderToStaticMarkup(<skin.Layout {...propsFor(panel)} />);
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>${skin.name}</title><style>${css}</style></head><body>${body}</body></html>`;
    writeFileSync(join(outDir, `${skin.id}.html`), html, "utf8");
  }
});
