import { describe, expect, it, vi } from "vitest";
import { invokeCommand, listenToAppEvent } from "./tauri";

const listenMock = vi.hoisted(() =>
  vi.fn(async (_event: string, _handler: (event: { payload: unknown }) => void) => vi.fn()),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (name: string, payload: unknown) => ({ name, payload })),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, handler: (event: { payload: unknown }) => void) => listenMock(event, handler),
}));

describe("invokeCommand", () => {
  it("forwards a typed command to Tauri invoke", async () => {
    const result = await invokeCommand("get_playlist", { playlistId: "default" });

    expect(result).toEqual({
      name: "get_playlist",
      payload: { playlistId: "default" },
    });
  });
});

describe("listenToAppEvent", () => {
  it("forwards event payloads to the handler", async () => {
    const handler = vi.fn();
    await listenToAppEvent("playback_state_changed", handler);

    const registeredHandler = listenMock.mock.calls[0][1] as (event: { payload: unknown }) => void;
    registeredHandler({ payload: { isPlaying: true } });

    expect(listenMock).toHaveBeenCalledWith("playback_state_changed", expect.any(Function));
    expect(handler).toHaveBeenCalledWith({ isPlaying: true });
  });
});
