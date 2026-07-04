import { describe, expect, it } from "vitest";
import { mapAppError } from "./errors";

describe("mapAppError", () => {
  it("maps invalid skin errors to Chinese user copy", () => {
    expect(mapAppError({ code: "invalid_skin_package", message: "missing manifest" })).toBe(
      "皮肤包无效：missing manifest",
    );
  });
});
