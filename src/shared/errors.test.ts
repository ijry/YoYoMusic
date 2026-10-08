import { describe, expect, it } from "vitest";
import { mapAppError } from "./errors";

describe("mapAppError", () => {
  it("maps invalid skin errors to Chinese user copy", () => {
    expect(mapAppError({ code: "invalid_skin_package", message: "missing manifest" })).toBe(
      "皮肤包无效：missing manifest",
    );
  });

  it("does not call a failed seek an unplayable file", () => {
    /*
     * The two used to be the same code, so a source that could not seek
     * reported "音频文件不可播放" for a track that was playing fine. Chasing
     * that message led away from the actual fault, which was a decorator
     * swallowing `try_seek`.
     */
    const seek = mapAppError({ code: "seek_failed", message: "Seeking is not supported" });
    const decode = mapAppError({ code: "unplayable", message: "bad.mp3: no stream" });

    expect(seek).toBe("无法跳转到该位置：Seeking is not supported");
    expect(decode).toBe("音频文件不可播放：bad.mp3: no stream");
    expect(seek).not.toBe(decode);
  });

  it("falls back to a generic prefix for a code it does not know", () => {
    // The Rust side can add a code before this table catches up.
    expect(mapAppError({ code: "something_new", message: "boom" })).toBe("应用错误：boom");
  });
});
