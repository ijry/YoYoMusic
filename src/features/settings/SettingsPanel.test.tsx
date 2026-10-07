import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "../update/useUpdateChecker";
import { SettingsPanel } from "./SettingsPanel";

function renderPanel(overrides: Partial<React.ComponentProps<typeof SettingsPanel>> = {}) {
  const props = {
    shortcuts: { toggle_playback: "Ctrl+Alt+P" },
    enrichmentEnabled: true,
    errorCode: null,
    onShortcutChange: vi.fn(),
    updateStatus: { kind: "idle" } as UpdateStatus,
    onCheckUpdate: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SettingsPanel {...props} />) };
}

describe("SettingsPanel", () => {
  it("shows shortcut conflict messages", () => {
    const { container } = renderPanel({ errorCode: "shortcut_conflict" });

    expect(screen.getByText(/快捷键冲突/)).toBeInTheDocument();
    expect(screen.getByLabelText("播放/暂停快捷键")).toHaveValue("Ctrl+Alt+P");
    expect(container.querySelector(".settings-panel__status")).toHaveTextContent("联网补全已开启");
    expect(container.querySelectorAll(".settings-panel__field")).toHaveLength(3);
  });

  describe("software update", () => {
    it("offers a manual check", async () => {
      const user = userEvent.setup();
      const { props } = renderPanel();

      await user.click(screen.getByRole("button", { name: "检查更新" }));
      expect(props.onCheckUpdate).toHaveBeenCalledTimes(1);
    });

    it("reports each state in plain words", () => {
      const update = { version: "0.0.2", currentVersion: "0.0.1", notes: null, date: null };
      const cases: Array<[UpdateStatus, RegExp]> = [
        [{ kind: "idle" }, /尚未检查/],
        [{ kind: "checking" }, /正在检查/],
        [{ kind: "up-to-date" }, /已是最新/],
        [{ kind: "available", update }, /0\.0\.2/],
        [{ kind: "ready", update }, /重启/],
        [{ kind: "error", message: "网络不可用" }, /网络不可用/],
      ];

      for (const [status, expected] of cases) {
        const { unmount } = renderPanel({ updateStatus: status });
        expect(screen.getByText(expected), status.kind).toBeInTheDocument();
        unmount();
      }
    });

    it("disables the button while a check is running", () => {
      renderPanel({ updateStatus: { kind: "checking" } });
      expect(screen.getByRole("button", { name: "检查更新" })).toBeDisabled();
    });
  });
});
