import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { normaliseAssetNames, publishedName } from "./normalise-asset-names.mjs";

describe("publishedName", () => {
  it("replaces the Chinese product name with an ASCII one", () => {
    assert.equal(publishedName("悠悠乐听_0.0.1_x64-setup.exe"), "YoYoMusic_0.0.1_x64-setup.exe");
    assert.equal(publishedName("悠悠乐听_0.0.1_amd64.deb"), "YoYoMusic_0.0.1_amd64.deb");
    assert.equal(
      publishedName("悠悠乐听_0.0.1_amd64.AppImage"),
      "YoYoMusic_0.0.1_amd64.AppImage",
    );
  });

  /*
   * The bug this pins: the first version stripped every leading non-alphanumeric
   * character including the dot, so `悠悠乐听.app.tar.gz` became
   * `YoYoMusic_app.tar.gz`. The `.app` segment is what identifies the macOS
   * updater payload, and `cmd > published` keeps `_app` out of the name.
   */
  it("keeps a dot separator, so the .app suffix survives", () => {
    assert.equal(publishedName("悠悠乐听.app.tar.gz"), "YoYoMusic.app.tar.gz");
    assert.notEqual(publishedName("悠悠乐听.app.tar.gz"), "YoYoMusic_app.tar.gz");
  });

  it("keeps the signature suffix attached", () => {
    assert.equal(
      publishedName("悠悠乐听_0.0.1_x64-setup.exe.sig"),
      "YoYoMusic_0.0.1_x64-setup.exe.sig",
    );
    assert.equal(publishedName("悠悠乐听.app.tar.gz.sig"), "YoYoMusic.app.tar.gz.sig");
  });

  it("handles a dmg, which carries the version rather than a dot", () => {
    assert.equal(publishedName("悠悠乐听_0.0.1_aarch64.dmg"), "YoYoMusic_0.0.1_aarch64.dmg");
  });

  it("copes with a run of leading separators", () => {
    assert.equal(publishedName("__悠悠乐听_1.0.0.msi"), "YoYoMusic_1.0.0.msi");
  });

  it("leaves a name that has no Chinese prefix alone", () => {
    assert.equal(publishedName("0.0.1_x64-setup.exe"), "YoYoMusic_0.0.1_x64-setup.exe");
  });
});

async function fixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "yoyo-rename-"));
  for (const relative of files) {
    const target = path.join(root, "release-assets", relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "x");
  }
  return path.join(root, "release-assets");
}

async function namesUnder(root) {
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
}

describe("normaliseAssetNames", () => {
  it("renames every platform's bundles, signatures included", async () => {
    const assets = await fixture([
      "yoyomusic-windows/悠悠乐听_0.0.1_x64-setup.exe",
      "yoyomusic-windows/悠悠乐听_0.0.1_x64-setup.exe.sig",
      "yoyomusic-macos/悠悠乐听.app.tar.gz",
      "yoyomusic-macos/悠悠乐听.app.tar.gz.sig",
      "yoyomusic-macos/悠悠乐听_0.0.1_aarch64.dmg",
      "yoyomusic-linux/悠悠乐听_0.0.1_amd64.AppImage",
      "yoyomusic-linux/悠悠乐听_0.0.1_amd64.AppImage.sig",
      "yoyomusic-linux/悠悠乐听_0.0.1_amd64.deb",
    ]);

    await normaliseAssetNames(assets);

    assert.deepEqual(await namesUnder(assets), [
      "yoyomusic-linux/YoYoMusic_0.0.1_amd64.AppImage",
      "yoyomusic-linux/YoYoMusic_0.0.1_amd64.AppImage.sig",
      "yoyomusic-linux/YoYoMusic_0.0.1_amd64.deb",
      "yoyomusic-macos/YoYoMusic.app.tar.gz",
      "yoyomusic-macos/YoYoMusic.app.tar.gz.sig",
      "yoyomusic-macos/YoYoMusic_0.0.1_aarch64.dmg",
      "yoyomusic-windows/YoYoMusic_0.0.1_x64-setup.exe",
      "yoyomusic-windows/YoYoMusic_0.0.1_x64-setup.exe.sig",
    ]);
  });

  it("keeps the .app suffix so the manifest can find the payload", async () => {
    const assets = await fixture(["yoyomusic-macos/悠悠乐听.app.tar.gz"]);
    await normaliseAssetNames(assets);

    assert.deepEqual(await namesUnder(assets), ["yoyomusic-macos/YoYoMusic.app.tar.gz"]);
  });

  it("does not touch a name that is already published", async () => {
    // The step can be re-run; a second pass must be a no-op rather than
    // producing `YoYoMusic_YoYoMusic_...`.
    const assets = await fixture(["yoyomusic-linux/YoYoMusic_0.0.1_amd64.AppImage"]);
    const renamed = await normaliseAssetNames(assets);

    assert.deepEqual(renamed, []);
    assert.deepEqual(await namesUnder(assets), ["yoyomusic-linux/YoYoMusic_0.0.1_amd64.AppImage"]);
  });

  it("reports what it renamed", async () => {
    const assets = await fixture(["yoyomusic-linux/悠悠乐听_0.0.1_amd64.deb"]);
    const renamed = await normaliseAssetNames(assets);

    assert.deepEqual(renamed, [
      ["悠悠乐听_0.0.1_amd64.deb", "YoYoMusic_0.0.1_amd64.deb"],
    ]);
  });

  it("fails loudly when there is nothing to work on", async () => {
    await assert.rejects(normaliseAssetNames("/definitely/not/here"), /Not a directory/);
  });
});
