import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./icons";

/*
 * The icon set is a vocabulary, and a vocabulary only works if a word means one
 * thing. Two rules, both broken before:
 *
 * 1. No two concepts share a glyph. `Minimize2` used to be both "mini mode" and
 *    "restore window", and it sat one button away from the real minimise.
 * 2. Concepts that appear together must not look alike, so `mini` is no longer
 *    a window-control arrow.
 *
 * Comparison is by rendered markup: `glyph()` returns a fresh wrapper per entry,
 * so comparing the components by identity would never catch a collision.
 */
function renderGlyph(component: () => React.ReactNode) {
  const { container } = render(<>{component()}</>);
  return container.innerHTML;
}

describe("icon vocabulary", () => {
  it("never reuses one glyph for two concepts", () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const [name, component] of Object.entries(Icon)) {
      const svg = renderGlyph(component as () => React.ReactNode);
      const previous = seen.get(svg);
      if (previous) collisions.push(`${previous} 与 ${name} 用了同一个字形`);
      else seen.set(svg, name);
    }

    expect(collisions).toEqual([]);
  });

  it("keeps mini mode visually distinct from the window controls", () => {
    // Both live in the top-right corner; a shared arrow glyph made them
    // indistinguishable at a glance.
    expect(renderGlyph(Icon.mini)).not.toBe(renderGlyph(Icon.minimize));
    expect(renderGlyph(Icon.mini)).not.toBe(renderGlyph(Icon.restore));
    expect(renderGlyph(Icon.mini)).not.toBe(renderGlyph(Icon.maximize));
  });

  it("keeps restore and maximise as the OS pair they are meant to be", () => {
    expect(renderGlyph(Icon.restore)).not.toBe(renderGlyph(Icon.maximize));
  });

  it("tells the lyrics panel apart from the desktop-lyrics window", () => {
    expect(renderGlyph(Icon.lyrics)).not.toBe(renderGlyph(Icon.desktopLyrics));
  });

  it("tells the visualiser apart from the play modes", () => {
    expect(renderGlyph(Icon.visualization)).not.toBe(renderGlyph(Icon.sequence));
    expect(renderGlyph(Icon.visualization)).not.toBe(renderGlyph(Icon.repeatAll));
    expect(renderGlyph(Icon.visualization)).not.toBe(renderGlyph(Icon.shuffle));
  });

  it("hides every glyph from assistive tech", () => {
    // Names live on the surrounding button's aria-label; a glyph that
    // announced itself would double up with it.
    for (const component of Object.values(Icon)) {
      const { container } = render(<>{component()}</>);
      expect(container.querySelector("svg")).toHaveAttribute("aria-hidden");
    }
  });
});
