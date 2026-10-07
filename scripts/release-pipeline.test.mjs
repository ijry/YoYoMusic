import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createManifest } from "./create-updater-manifest.mjs";
import { normaliseAssetNames } from "./normalise-asset-names.mjs";

/*
 * The release pipeline is two scripts in sequence:
 *
 *   1. `normalise-asset-names` renames Tauri's Chinese-named bundles
 *   2. `create-updater-manifest` writes latest.json pointing at those names
 *
 * Testing each alone does not cover the seam, and the seam is where this
 * breaks: the manifest builds URLs from whatever names are on disk, so a
 * rename that produces a name the manifest would not pick leaves the update
 * silently pointing at nothing.
 */

const TAG = "v0.0.1";
const REPO = "ijry/YoYoMusic";

/** The bytes Tauri leaves behind, named after the Chinese `productName`. */
const TAURI_OUTPUT = {
  "yoyomusic-windows/悠悠乐听_0.0.1_x64-setup.exe": "nsis",
  "yoyomusic-windows/悠悠乐听_0.0.1_x64_zh-CN.msi": "msi",
  "yoyomusic-macos/悠悠乐听_0.0.1_aarch64.dmg": "dmg",
  "yoyomusic-macos/悠悠乐听.app.tar.gz": "app-bundle",
  "yoyomusic-linux/悠悠乐听_0.0.1_amd64.deb": "deb",
  "yoyomusic-linux/悠悠乐听_0.0.1_amd64.AppImage": "appimage",
};

/** Only these get signed — Tauri signs what the updater can install. */
const SIGNATURES = {
  "yoyomusic-windows/悠悠乐听_0.0.1_x64-setup.exe.sig": "WINDOWS-NSIS-SIG",
  "yoyomusic-windows/悠悠乐听_0.0.1_x64_zh-CN.msi.sig": "WINDOWS-MSI-SIG",
  "yoyomusic-macos/悠悠乐听.app.tar.gz.sig": "MACOS-APP-SIG",
  "yoyomusic-linux/悠悠乐听_0.0.1_amd64.AppImage.sig": "LINUX-APPIMAGE-SIG",
};

async function runPipeline() {
  const root = await mkdtemp(path.join(tmpdir(), "yoyo-pipeline-"));
  const assetsDir = path.join(root, "release-assets");

  for (const [relative, contents] of Object.entries({ ...TAURI_OUTPUT, ...SIGNATURES })) {
    const target = path.join(assetsDir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }

  const notesFile = path.join(root, "notes.md");
  await writeFile(notesFile, "## 更新内容\n\n- 真频谱\n");

  await normaliseAssetNames(assetsDir);
  const manifest = await createManifest({
    assetsDir,
    tag: TAG,
    repo: REPO,
    notesFile,
    output: path.join(assetsDir, "latest.json"),
  });

  return { assetsDir, manifest };
}

describe("release pipeline, rename then manifest", () => {
  it("publishes all three platforms", async () => {
    const { manifest } = await runPipeline();
    assert.deepEqual(Object.keys(manifest.platforms).sort(), [
      "darwin-aarch64",
      "linux-x86_64",
      "windows-x86_64",
    ]);
  });

  it("points every URL at a file the rename actually produced", async () => {
    // The property that matters end to end: after the rename, the manifest's
    // URL must name a real asset. If the two disagree, the updater 404s.
    const { assetsDir, manifest } = await runPipeline();
    const { readdir } = await import("node:fs/promises");

    const onDisk = new Set();
    for (const entry of await readdir(assetsDir, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) onDisk.add(entry.name);
    }

    for (const [platform, entry] of Object.entries(manifest.platforms)) {
      const assetName = decodeURIComponent(entry.url.split("/").pop());
      assert.ok(onDisk.has(assetName), `${platform} points at a missing asset: ${assetName}`);
    }
  });

  it("keeps the macOS updater payload identifiable after the rename", async () => {
    // `YoYoMusic.app.tar.gz` is the payload; the dmg is for installing by hand.
    const { manifest } = await runPipeline();
    assert.match(manifest.platforms["darwin-aarch64"].url, /\/YoYoMusic\.app\.tar\.gz$/);
  });

  it("lands the Windows updater on NSIS rather than MSI", async () => {
    const { manifest } = await runPipeline();
    assert.match(manifest.platforms["windows-x86_64"].url, /\/YoYoMusic_0\.0\.1_x64-setup\.exe$/);
  });

  it("carries the signature that belongs to the asset it points at", async () => {
    // A manifest that pairs the NSIS URL with the MSI signature would fail
    // verification on every client, and only at install time.
    const { manifest } = await runPipeline();

    assert.equal(manifest.platforms["windows-x86_64"].signature, "WINDOWS-NSIS-SIG");
    assert.equal(manifest.platforms["darwin-aarch64"].signature, "MACOS-APP-SIG");
    assert.equal(manifest.platforms["linux-x86_64"].signature, "LINUX-APPIMAGE-SIG");
  });

  it("leaves a manifest the updater would accept", async () => {
    // Shape check against what Tauri requires: version, notes, pub_date, and
    // url + signature for every platform.
    const { assetsDir, manifest } = await runPipeline();
    const parsed = JSON.parse(await readFile(path.join(assetsDir, "latest.json"), "utf8"));

    assert.equal(parsed.version, "0.0.1");
    assert.match(parsed.pub_date, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(parsed.notes, "## 更新内容\n\n- 真频谱");
    for (const entry of Object.values(parsed.platforms)) {
      assert.ok(entry.url.startsWith("https://github.com/"));
      assert.ok(entry.signature.length > 0);
    }
  });
});
