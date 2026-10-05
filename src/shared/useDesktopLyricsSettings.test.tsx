import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopLyricsSettings } from "./useDesktopLyricsSettings";
import type { AppSettings } from "./types";

const testState = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({}) as unknown),
  /** When set, `load_settings` resolves with this document. */
  loaded: null as AppSettings | null,
  /** When true, `load_settings` rejects. */
  failLoad: false,
  tauri: true,
}));

vi.mock("./tauri", () => ({
  isTauriRuntime: () => testState.tauri,
  invokeCommand: testState.invoke,
}));

function settings(overrides: Partial<AppSettings["desktopLyrics"]> = {}): AppSettings {
  return {
    defaultSkin: "aurora-glass",
    shortcuts: {},
    enrichmentEnabled: false,
    cacheRetentionDays: 30,
    recentPlaylists: [],
    restoreSession: true,
    visualizationMode: "spectrum",
    equalizer: { enabled: false, preset: "flat", bands: [] },
    desktopLyrics: {
      theme: "aurora",
      fontScale: 1,
      pinned: false,
      clickThrough: false,
      ...overrides,
    },
  };
}

function Probe() {
  const { prefs, setTheme, setFontScale, toggleLock, toggleClickThrough } =
    useDesktopLyricsSettings();

  return (
    <div>
      <span data-testid="state">
        {prefs.theme}|{prefs.fontScale}|{String(prefs.pinned)}|{String(prefs.clickThrough)}
      </span>
      <button type="button" onClick={() => setTheme("mint")}>
        theme
      </button>
      <button type="button" onClick={() => setFontScale(1.8)}>
        scale
      </button>
      <button type="button" onClick={toggleLock}>
        lock
      </button>
      <button type="button" onClick={toggleClickThrough}>
        through
      </button>
    </div>
  );
}

function state() {
  return screen.getByTestId("state").textContent;
}

describe("useDesktopLyricsSettings", () => {
  beforeEach(() => {
    testState.loaded = null;
    testState.failLoad = false;
    testState.tauri = true;
    testState.invoke.mockReset();
    testState.invoke.mockImplementation(async (command: string) => {
      if (command === "load_settings") {
        if (testState.failLoad) throw new Error("no settings");
        return testState.loaded ?? settings();
      }
      return {};
    });
  });

  /*
   * Regression: the preferences used to live inside a nullable `settings`
   * object, so every toolbar click made before the load resolved was silently
   * dropped — and in the browser preview, where there is no load at all, none
   * of them worked. They must respond on the first click.
   */
  it("applies a theme change on the very first click, before any load resolves", async () => {
    const user = userEvent.setup();
    // A load that never settles, so nothing can rescue the state later.
    testState.invoke.mockImplementation(
      () => new Promise(() => {}) as Promise<unknown>,
    );

    render(<Probe />);
    expect(state()).toBe("aurora|1|false|false");

    await user.click(screen.getByRole("button", { name: "theme" }));
    expect(state()).toBe("mint|1|false|false");
  });

  it("toggles lock and click-through without waiting for persistence", async () => {
    const user = userEvent.setup();
    testState.invoke.mockImplementation(() => new Promise(() => {}) as Promise<unknown>);

    render(<Probe />);

    await user.click(screen.getByRole("button", { name: "lock" }));
    expect(state()).toBe("aurora|1|true|false");

    await user.click(screen.getByRole("button", { name: "lock" }));
    expect(state()).toBe("aurora|1|false|false");

    await user.click(screen.getByRole("button", { name: "through" }));
    expect(state()).toBe("aurora|1|false|true");
  });

  it("adopts the persisted look once settings load", async () => {
    testState.loaded = settings({ theme: "candy", fontScale: 1.4, pinned: true });
    render(<Probe />);

    expect(await screen.findByText("candy|1.4|true|false")).toBeInTheDocument();
  });

  it("merges per field so a partial persisted object keeps the defaults", async () => {
    // Simulates a settings file written before a field existed.
    testState.loaded = settings();
    testState.invoke.mockImplementation(async (command: string) => {
      if (command === "load_settings") {
        return { ...settings(), desktopLyrics: { theme: "sunset" } } as AppSettings;
      }
      return {};
    });

    render(<Probe />);
    expect(await screen.findByText("sunset|1|false|false")).toBeInTheDocument();
  });

  it("does not save before the document is known, so defaults cannot clobber it", async () => {
    const user = userEvent.setup();
    testState.invoke.mockImplementation(() => new Promise(() => {}) as Promise<unknown>);

    render(<Probe />);
    await user.click(screen.getByRole("button", { name: "theme" }));

    const saves = testState.invoke.mock.calls.filter(([command]) => command === "save_settings");
    expect(saves).toHaveLength(0);
  });

  it("merges writes into the loaded document instead of replacing it", async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await screen.findByText("aurora|1|false|false");

    await user.click(screen.getByRole("button", { name: "through" }));

    const save = testState.invoke.mock.calls.find(([command]) => command === "save_settings");
    expect(save).toBeDefined();
    const payload = save![1] as { settings: AppSettings };
    // The rest of the document survives the write.
    expect(payload.settings.defaultSkin).toBe("aurora-glass");
    expect(payload.settings.visualizationMode).toBe("spectrum");
    expect(payload.settings.desktopLyrics.clickThrough).toBe(true);
  });

  it("stays usable when loading fails", async () => {
    const user = userEvent.setup();
    testState.failLoad = true;
    render(<Probe />);

    await act(async () => {});

    await user.click(screen.getByRole("button", { name: "lock" }));
    expect(state()).toBe("aurora|1|true|false");
  });

  it("never loads or saves in the browser preview", async () => {
    const user = userEvent.setup();
    testState.tauri = false;
    render(<Probe />);

    await user.click(screen.getByRole("button", { name: "theme" }));
    expect(state()).toBe("mint|1|false|false");
    expect(testState.invoke).not.toHaveBeenCalled();
  });
});
