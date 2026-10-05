import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DragRegion, WindowButtons } from "./WindowChrome";

/*
 * The window chrome calls into the Tauri window API, which is absent under
 * jsdom. `isTauriWindowRuntime()` therefore short-circuits every action, so
 * these tests cover the DOM contract (labels, grouping, drag opt-out) rather
 * than the native calls themselves.
 */

describe("WindowChrome", () => {
  it("renders the three window buttons with accessible names", () => {
    render(<WindowButtons />);

    const chrome = screen.getByRole("group", { name: "窗口控制" });
    expect(chrome).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最小化" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最大化" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭窗口" })).toBeInTheDocument();
  });

  it("can hide minimise and maximise for a fixed-size strip", () => {
    render(<WindowButtons showMinimize={false} showMaximize={false} closeLabel="关闭迷你播放器" />);

    expect(screen.getByRole("button", { name: "关闭迷你播放器" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "最小化" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "最大化" })).not.toBeInTheDocument();
  });

  it("starts a drag from the region background", async () => {
    const user = userEvent.setup();
    render(
      <DragRegion className="strip">
        <span>拖我</span>
      </DragRegion>,
    );

    const region = screen.getByText("拖我").parentElement!;
    expect(region).toHaveAttribute("data-drag-region", "enabled");
    await user.pointer([{ target: region, keys: "[MouseLeft>]" }]);
  });

  it("does not drag when the region is disabled", () => {
    render(
      <DragRegion disabled>
        <span>锁住了</span>
      </DragRegion>,
    );

    expect(screen.getByText("锁住了").parentElement).toHaveAttribute("data-drag-region", "disabled");
  });

  it("keeps buttons inside a drag region clickable", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DragRegion>
        <button type="button" onClick={onClick}>
          播放
        </button>
      </DragRegion>,
    );

    await user.click(screen.getByRole("button", { name: "播放" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
