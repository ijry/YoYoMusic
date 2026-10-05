import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The logo exists once in `public/favicon.svg` and is reused three ways: the
 * browser tab icon (via `index.html`), the in-app title mark, and — after
 * `npx tauri icon` — the whole platform icon set. These tests pin the wiring so
 * a rename or a moved file fails here rather than as a blank image.
 */

const logo = readFileSync(join(process.cwd(), "public/favicon.svg"), "utf8").replace(/\r\n/g, "\n");
const html = readFileSync(join(process.cwd(), "index.html"), "utf8").replace(/\r\n/g, "\n");
const tauriConf = readFileSync(join(process.cwd(), "src-tauri/tauri.conf.json"), "utf8");
const docsLogo = readFileSync(
  join(process.cwd(), "docs-site/docs/public/logo.svg"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("app logo", () => {
  it("serves the logo from the Vite public dir", () => {
    // Vite's publicDir defaults to <root>/public. A file under src/public is
    // silently NOT served — the request falls through to index.html and the
    // logo renders blank.
    expect(logo).toContain("<svg");
    expect(logo).toContain('viewBox="0 0 64 64"');
  });

  it("is referenced by the document title bar", () => {
    expect(html).toContain('href="/favicon.svg"');
  });

  it("draws a gradient plate plus spectrum bars", () => {
    expect(logo).toContain("linearGradient");
    // Five bars, matching the spectrum motif of the visualiser.
    expect(logo.match(/<rect x="\d+"/g) ?? []).toHaveLength(5);
  });

  it("matches the docs-site logo so the two stay in sync", () => {
    expect(logo.trim()).toBe(docsLogo.trim());
  });

  it("bundles the generated platform icons", () => {
    for (const file of ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico", "icons/icon.icns"]) {
      expect(tauriConf).toContain(file);
    }
  });
});
