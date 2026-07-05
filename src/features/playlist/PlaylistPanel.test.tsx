import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaylistPanel } from "./PlaylistPanel";

describe("PlaylistPanel", () => {
  it("marks current and missing tracks", () => {
    const { container } = render(
      <PlaylistPanel
        currentTrackId="2"
        tracks={[
          {
            id: "1",
            filePath: "a.mp3",
            title: "a",
            artist: "",
            album: "",
            durationMs: 0,
            coverArtRef: null,
            lyricsRef: null,
            tagStatus: "clean",
            status: "missing",
          },
          {
            id: "2",
            filePath: "b.mp3",
            title: "b",
            artist: "artist",
            album: "",
            durationMs: 0,
            coverArtRef: null,
            lyricsRef: null,
            tagStatus: "clean",
            status: "ready",
          },
        ]}
        onPlay={() => undefined}
        onRemove={() => undefined}
      />,
    );

    expect(screen.getByText("2 首")).toHaveClass("playlist-panel__counter");
    expect(container.querySelector(".playlist-panel__status")).toHaveTextContent("当前 b");
    expect(container.querySelectorAll(".playlist-action-button")).toHaveLength(3);
    expect(screen.getByText("01")).toHaveClass("track-index");
    expect(screen.getByText("02")).toHaveClass("track-index");
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("文件丢失")).toBeInTheDocument();
    expect(screen.getByText("正在播放")).toBeInTheDocument();
    expect(container.querySelectorAll(".track-flag")).toHaveLength(2);
  });
});
