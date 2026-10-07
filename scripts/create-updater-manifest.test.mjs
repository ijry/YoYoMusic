import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createManifest } from "./create-updater-manifest.mjs";

const TAG = "v0.0.1";
const REPO = "ijry/YoYoMusic";

async function fixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "yoyo-manifest-"));
  // The release job downloads every build artifact into `release-assets/`, and
  // the directory names there are what the script keys platforms off.
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(root, "release-assets", relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return root;
}

/** Mirrors what the release job leaves behind, after the ASCII rename. */
const REAL_LAYOUT = {
  "yoyomusic-windows/YoYoMusic_0.0.1_x64-setup.exe": "installer",
  "yoyomusic-windows/YoYoMusic_0.0.1_x64-setup.exe.sig": "sig-windows-nsis\n",
  "yoyomusic-windows/YoYoMusic_0.0.1_x64_zh-CN.msi": "msi",
  "yoyomusic-windows/YoYoMusic_0.0.1_x64_zh-CN.msi.sig": "sig-windows-msi\n",
  // The rename keeps the `.app.tar.gz` suffix: it is what says "this is the
  // updater payload", as opposed to the dmg beside it.
  "yoyomusic-macos/YoYoMusic.app.tar.gz": "appbundle",
  "yoyomusic-macos/YoYoMusic.app.tar.gz.sig": "sig-macos\n",
  "yoyomusic-macos/YoYoMusic_0.0.1_aarch64.dmg": "dmg",
  "yoyomusic-linux/YoYoMusic_0.0.1_amd64.AppImage": "appimage",
  "yoyomusic-linux/YoYoMusic_0.0.1_amd64.AppImage.sig": "sig-linux\n",
  ".github/release-notes/v0.0.1.md": "## 更新内容\n- 修好了播放列表\n",
};

async function run(files, notesFile) {
  const root = await fixture(files);
  const output = path.join(root, "release-assets", "latest.json");
  const manifest = await createManifest({
    assetsDir: path.join(root, "release-assets"),
    tag: TAG,
    repo: REPO,
    notesFile,
    output,
  });
  return { root, output, manifest };
}

describe("create-updater-manifest", () => {
  it("maps every build directory onto its platform key", async () => {
    const { manifest } = await run(REAL_LAYOUT);

    assert.deepEqual(Object.keys(manifest.platforms).sort(), [
      "darwin-aarch64",
      "linux-x86_64",
      "windows-x86_64",
    ]);
  });

  it("picks the payload the updater actually installs", async () => {
    // Windows signs the MSI too, but only the NSIS installer is what the
    // updater runs; pointing the manifest at the MSI would silently break
    // Windows updates. macOS signs the dmg, but a running .app cannot be
    // swapped for a mounted image — the tarball is the updater payload.
    const { manifest } = await run(REAL_LAYOUT);

    assert.match(manifest.platforms["windows-x86_64"].url, /x64-setup\.exe$/);
    assert.match(manifest.platforms["darwin-aarch64"].url, /\.app\.tar\.gz$/);
    assert.match(manifest.platforms["linux-x86_64"].url, /\.AppImage$/);
  });

  it("carries the signature inline, not a path", async () => {
    const { manifest } = await run(REAL_LAYOUT);

    assert.equal(manifest.platforms["windows-x86_64"].signature, "sig-windows-nsis");
    assert.equal(manifest.platforms["linux-x86_64"].signature, "sig-linux");
  });

  it("builds release URLs that match the hosted asset names", async () => {
    const { manifest } = await run(REAL_LAYOUT);

    assert.equal(
      manifest.platforms["windows-x86_64"].url,
      `https://github.com/${REPO}/releases/download/${TAG}/YoYoMusic_0.0.1_x64-setup.exe`,
    );
    assert.equal(
      manifest.platforms["darwin-aarch64"].url,
      `https://github.com/${REPO}/releases/download/${TAG}/YoYoMusic.app.tar.gz`,
    );
  });

  it("takes the version from the tag, without the v", async () => {
    const { manifest } = await run(REAL_LAYOUT);
    assert.equal(manifest.version, "0.0.1");
  });

  it("writes the release notes into the manifest", async () => {
    const root = await fixture(REAL_LAYOUT);
    const notes = path.join(root, "notes.md");
    await writeFile(notes, "## 更新内容\n- 修好了播放列表\n");

    const { manifest } = await run(REAL_LAYOUT, notes);
    assert.equal(manifest.notes, "## 更新内容\n- 修好了播放列表");
  });

  it("writes the manifest to disk as valid JSON", async () => {
    const { output, manifest } = await run(REAL_LAYOUT);
    const parsed = JSON.parse(await readFile(output, "utf8"));

    assert.deepEqual(parsed, manifest);
    assert.ok(parsed.pub_date, "pub_date is required by the updater");
  });

  it("removes the signature files once they are inline", async () => {
    // The release page should not carry them, and nothing fetches them.
    const { root } = await run(REAL_LAYOUT);
    for (const leftover of [
      "yoyomusic-windows/YoYoMusic_0.0.1_x64-setup.exe.sig",
      "yoyomusic-macos/YoYoMusic_app.tar.gz.sig",
      "yoyomusic-linux/YoYoMusic_0.0.1_amd64.AppImage.sig",
    ]) {
      await assert.rejects(
        stat(path.join(root, "release-assets", leftover)),
        /ENOENT/,
        `${leftover} should have been deleted`,
      );
    }
  });

  it("refuses to publish a manifest with no signed bundles", async () => {
    // The failure this guards: build without the signing secrets, and ship a
    // release whose updater can never install anything.
    await assert.rejects(
      run({
        "yoyomusic-windows/YoYoMusic_0.0.1_x64-setup.exe": "installer",
      }),
      /No \.sig files/,
    );
  });

  it("refuses a signature whose asset is missing", async () => {
    await assert.rejects(run({ "yoyomusic-windows/orphan.exe.sig": "sig\n" }), /no matching file/);
  });

  it("refuses an unexpected build directory", async () => {
    await assert.rejects(
      run({
        "yoyomusic-solaris/YoYoMusic_0.0.1.bin.sig": "sig\n",
        "yoyomusic-solaris/YoYoMusic_0.0.1.bin": "x",
      }),
      /Unknown build directory/,
    );
  });

  it("refuses a release that is missing a platform", async () => {
    /*
     * The failure this guards, which actually shipped once: macOS was built with
     * `--bundles dmg`, and dmg is not an updater-enabled target, so no `.sig`
     * was produced. Tauri only warned; the manifest silently listed two
     * platforms, the release looked green, and macOS users would never have
     * been offered an update.
     */
    const withoutMacos = { ...REAL_LAYOUT };
    for (const key of Object.keys(withoutMacos)) {
      if (key.startsWith("yoyomusic-macos/")) delete withoutMacos[key];
    }

    await assert.rejects(run(withoutMacos), /No signed updater bundle for: darwin-aarch64/);
  });

  it("explains what to do about it", async () => {
    const withoutMacos = { ...REAL_LAYOUT };
    for (const key of Object.keys(withoutMacos)) {
      if (key.startsWith("yoyomusic-macos/")) delete withoutMacos[key];
    }

    await assert.rejects(run(withoutMacos), (error) => {
      assert.match(error.message, /macOS needs `--bundles app`/);
      assert.match(error.message, /Windows needs nsis/);
      assert.match(error.message, /Linux needs appimage/);
      return true;
    });
  });

  it("names every missing platform, not just the first", async () => {
    const onlyWindows = {};
    for (const [key, value] of Object.entries(REAL_LAYOUT)) {
      if (key.startsWith("yoyomusic-windows/")) onlyWindows[key] = value;
    }

    await assert.rejects(
      run(onlyWindows),
      /darwin-aarch64, linux-x86_64/,
    );
  });
});
