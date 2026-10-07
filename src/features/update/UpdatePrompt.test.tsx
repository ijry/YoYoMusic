import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UpdatePrompt } from "./UpdatePrompt";
import type { UpdateChecker, UpdateStatus } from "./useUpdateChecker";

const release = {
  version: "0.0.2",
  currentVersion: "0.0.1",
  notes: "## 修复\n- 播放列表不再跳行",
  date: null,
};

function checkerWith(status: UpdateStatus): UpdateChecker {
  return {
    status,
    checkNow: vi.fn(),
    install: vi.fn(),
    relaunch: vi.fn(),
    dismiss: vi.fn(),
    intervalMs: 1_800_000,
  };
}

describe("UpdatePrompt", () => {
  it("stays hidden unless there is something to do", () => {
    for (const status of [{ kind: "idle" }, { kind: "checking" }, { kind: "up-to-date" }] as UpdateStatus[]) {
      const { container, unmount } = render(<UpdatePrompt checker={checkerWith(status)} />);
      expect(container.querySelector(".update-card"), status.kind).not.toBeInTheDocument();
      unmount();
    }
  });

  it("names the new version and what is running now", () => {
    render(<UpdatePrompt checker={checkerWith({ kind: "available", update: release })} />);

    expect(screen.getByText(/发现新版本 0\.0\.2/)).toBeInTheDocument();
    expect(screen.getByText(/当前版本 0\.0\.1/)).toBeInTheDocument();
  });

  it("shows the release notes", () => {
    render(<UpdatePrompt checker={checkerWith({ kind: "available", update: release })} />);
    expect(screen.getByText(/播放列表不再跳行/)).toBeInTheDocument();
  });

  describe("release notes rendering", () => {
    /*
     * The notes are the annotated tag message, which is Markdown. Printing it
     * raw showed the literal `##` and `-`, which is not what the release page
     * does — it renders the same text.
     *
     * These query `document`, not the render container: the dialog is portalled
     * to <body>, so nothing it renders is inside the container.
     */
    function renderNotes(notes: string) {
      render(
        <UpdatePrompt
          checker={checkerWith({ kind: "available", update: { ...release, notes } })}
        />,
      );
      return document.querySelector(".update-card__notes");
    }

    it("renders headings as headings, not as literal hashes", () => {
      renderNotes("## 修复\n- 播放列表不再跳行");

      const heading = document.querySelector(".update-card__notes-heading");
      expect(heading).toHaveTextContent("修复");
      expect(heading?.textContent).not.toContain("#");
      expect(document.querySelector(".update-card__notes")?.textContent).not.toContain("##");
    });

    it("renders bullets as items without their marker", () => {
      renderNotes("- 播放列表不再跳行");

      const item = document.querySelector(".update-card__notes-item");
      expect(item).toHaveTextContent("播放列表不再跳行");
      expect(item?.textContent).not.toMatch(/^[-*]\s/);
    });

    it("keeps a plain paragraph as text", () => {
      renderNotes("修了一些问题");
      expect(document.querySelector(".update-card__notes-text")).toHaveTextContent("修了一些问题");
    });

    it("never injects markup from the release body", () => {
      // The manifest is fetched over the network; its content must stay text.
      renderNotes("<img src=x onerror=alert(1)>");

      expect(document.querySelector(".update-card__notes img")).toBeNull();
      expect(document.querySelector(".update-card__notes")?.textContent).toContain(
        "<img src=x onerror=alert(1)>",
      );
    });

    it("ignores blank lines rather than spacing them out", () => {
      const notes = renderNotes("## 标题\n\n\n- 一条\n\n- 两条\n");
      expect(notes?.children).toHaveLength(3);
    });

    it("renders nothing when the notes are only whitespace", () => {
      renderNotes("   \n\n  ");
      expect(document.querySelector(".update-card__notes")).toBeNull();
    });
  });

  it("hides the notes block when the release has none", () => {
    const { container } = render(
      <UpdatePrompt
        checker={checkerWith({ kind: "available", update: { ...release, notes: null } })}
      />,
    );
    expect(container.querySelector(".update-card__notes")).not.toBeInTheDocument();
  });

  /*
   * Every `.modern-panel` clips its overflow, so a dialog rendered in place
   * would be cut off and its buttons unclickable — the same trap the volume
   * popover fell into.
   */
  it("escapes the panels it is rendered inside", () => {
    const { container } = render(
      <div style={{ overflow: "hidden" }}>
        <UpdatePrompt checker={checkerWith({ kind: "available", update: release })} />
      </div>,
    );

    const card = screen.getByRole("dialog", { name: "软件更新" });
    expect(card.closest(".update-overlay")?.parentElement).toBe(document.body);
    expect(container.contains(card)).toBe(false);
  });

  it("starts and dismisses the install", async () => {
    const user = userEvent.setup();
    const checker = checkerWith({ kind: "available", update: release });
    render(<UpdatePrompt checker={checker} />);

    await user.click(screen.getByRole("button", { name: "立即更新" }));
    expect(checker.install).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "稍后" }));
    expect(checker.dismiss).toHaveBeenCalledTimes(1);
  });

  it("gives the close button its own name", async () => {
    // "稍后" for both the X and the defer button would leave a screen reader
    // with two controls it cannot tell apart.
    const user = userEvent.setup();
    const checker = checkerWith({ kind: "available", update: release });
    render(<UpdatePrompt checker={checker} />);

    await user.click(screen.getByRole("button", { name: "关闭更新提示" }));
    expect(checker.dismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Escape", async () => {
    const user = userEvent.setup();
    const checker = checkerWith({ kind: "available", update: release });
    render(<UpdatePrompt checker={checker} />);

    await user.keyboard("{Escape}");
    expect(checker.dismiss).toHaveBeenCalledTimes(1);
  });

  it("shows download progress with a known size", () => {
    render(
      <UpdatePrompt
        checker={checkerWith({
          kind: "downloading",
          update: release,
          progress: { downloaded: 512 * 1024, total: 1024 * 1024 },
        })}
      />,
    );

    expect(screen.getByText("512.0 KB / 1.0 MB")).toBeInTheDocument();
    const bar = document.querySelector<HTMLElement>(".update-card__bar span");
    expect(bar?.style.width).toBe("50%");
    // A known size means a real percentage, not the indeterminate animation.
    expect(bar?.dataset.indeterminate).toBe("false");
  });

  it("falls back to motion when the size is unknown", () => {
    render(
      <UpdatePrompt
        checker={checkerWith({
          kind: "downloading",
          update: release,
          progress: { downloaded: 4096, total: null },
        })}
      />,
    );

    const bar = document.querySelector<HTMLElement>(".update-card__bar span");
    expect(bar?.dataset.indeterminate).toBe("true");
  });

  it("offers a relaunch once the download lands", async () => {
    const user = userEvent.setup();
    const checker = checkerWith({ kind: "ready", update: release });
    render(<UpdatePrompt checker={checker} />);

    expect(screen.getByText("更新已下载")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /重启以完成更新/ }));
    expect(checker.relaunch).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed mid-download", () => {
    // Closing the dialog after the bytes are committed would strand the update.
    render(
      <UpdatePrompt
        checker={checkerWith({
          kind: "downloading",
          update: release,
          progress: { downloaded: 1, total: 2 },
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /稍后/ })).not.toBeInTheDocument();
  });
});
