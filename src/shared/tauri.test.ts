import { describe, expect, it, vi } from "vitest";
import { invokeCommand } from "./tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (name: string, payload: unknown) => ({ name, payload })),
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
