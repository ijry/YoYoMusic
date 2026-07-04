import { describe, expect, it } from "vitest";
import { normalizeFrameValues } from "./renderers";

describe("normalizeFrameValues", () => {
  it("clamps visualizer values", () => {
    expect(normalizeFrameValues([-1, 0.5, 2])).toEqual([0, 0.5, 1]);
  });
});
