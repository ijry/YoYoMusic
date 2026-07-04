import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsPanel } from "./SettingsPanel";

describe("SettingsPanel", () => {
  it("shows shortcut conflict messages", () => {
    render(
      <SettingsPanel
        shortcuts={{ toggle_playback: "Ctrl+Alt+P" }}
        enrichmentEnabled
        errorCode="shortcut_conflict"
        onShortcutChange={() => undefined}
      />,
    );

    expect(screen.getByText(/快捷键冲突/)).toBeInTheDocument();
    expect(screen.getByLabelText("播放/暂停快捷键")).toHaveValue("Ctrl+Alt+P");
  });
});
