import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagEditor } from "./TagEditor";

describe("TagEditor", () => {
  it("submits edited title artist and album", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { container } = render(
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

    expect(container.querySelector(".tag-editor__status")).toHaveTextContent("当前曲目 Old");
    expect(container.querySelectorAll(".tag-editor__field")).toHaveLength(3);
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
