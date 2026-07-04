import { describe, expect, it } from "vitest";
import { applyThemeTokens } from "./theme";

describe("applyThemeTokens", () => {
  it("writes skin tokens as css variables", () => {
    const root = document.createElement("div");
    applyThemeTokens(
      { colors: { primary: "#102030", surface: "#ffffff", text: "#111111" } },
      root,
    );

    expect(root.style.getPropertyValue("--color-primary")).toBe("#102030");
    expect(root.style.getPropertyValue("--color-surface")).toBe("#ffffff");
  });
});
