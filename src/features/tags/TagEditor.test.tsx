import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagEditor } from "./TagEditor";

describe("TagEditor", () => {
  it("submits edited title artist and album", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TagEditor
        track={{
          id: "1",
          filePath: "a.mp3",
          title: "Old",
          artist: "",
          album: "",
          durationMs: 0,
          coverArtRef: null,
          lyricsRef: null,
          tagStatus: "clean",
          status: "ready",
        }}
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText("标题"));
    await user.type(screen.getByLabelText("标题"), "New");
    await user.type(screen.getByLabelText("歌手"), "Singer");
    await user.click(screen.getByRole("button", { name: "保存标签" }));

    expect(onSave).toHaveBeenCalledWith({
      title: "New",
      artist: "Singer",
      album: "",
      coverPath: null,
    });
  });
});
