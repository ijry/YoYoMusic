import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inspectRelease, REQUIRED_PLATFORMS } from "./verify-release.mjs";

/*
 * `inspectRelease` reads what a release actually published, which is the only
 * thing a client sees. A green workflow is not the same as a correct release:
 * one release here was green, created a Release, and was missing a platform
 * because macOS had been built without an updater-enabled target.
 */

const TAG = "v0.0.2";

/** A release that is entirely correct, to mutate per test. */
function goodRelease() {
  return {
    tag: TAG,
    assets: [
      "latest.json",
      "YoYoMusic.app.tar.gz",
      "YoYoMusic_0.0.2_aarch64.dmg",
      "YoYoMusic_0.0.2_amd64.AppImage",
      "YoYoMusic_0.0.2_amd64.deb",
      "YoYoMusic_0.0.2_x64-setup.exe",
      "YoYoMusic_0.0.2_x64_zh-CN.msi",
    ],
    manifest: {
      version: "0.0.2",
      notes: "## 悠悠乐听 v0.0.2",
      pub_date: "2026-10-08T02:42:52.988Z",
      platforms: {
        "windows-x86_64": {
          signature: "sig-win",
          url: "https://github.com/ijry/YoYoMusic/releases/download/v0.0.2/YoYoMusic_0.0.2_x64-setup.exe",
        },
        "darwin-aarch64": {
          signature: "sig-mac",
          url: "https://github.com/ijry/YoYoMusic/releases/download/v0.0.2/YoYoMusic.app.tar.gz",
        },
        "linux-x86_64": {
          signature: "sig-linux",
          url: "https://github.com/ijry/YoYoMusic/releases/download/v0.0.2/YoYoMusic_0.0.2_amd64.AppImage",
        },
      },
    },
    body: [
      "## 悠悠乐听 v0.0.2",
      "### 底层升级到 Tauri 2.12",
      "### 说明",
      "## 下载",
      "## 安装提示",
      "## 链接",
    ].join("\n"),
  };
}

describe("inspectRelease", () => {
  it("passes a correct release", () => {
    assert.deepEqual(inspectRelease(goodRelease()), []);
  });

  describe("the manifest version", () => {
    it("catches a manifest for the wrong version", () => {
      // Clients compare the manifest version against their own, so a stale one
      // means nobody on the new version is ever offered the update.
      const release = goodRelease();
      release.manifest.version = "0.0.1";

      const problems = inspectRelease(release);
      assert.equal(problems.length, 1);
      assert.match(problems[0], /says 0\.0\.1, but the tag is v0\.0\.2/);
      assert.match(problems[0], /would not be offered/);
    });

    it("catches a manifest that was never published", () => {
      const release = goodRelease();
      release.manifest = null;
      assert.match(inspectRelease(release)[0], /latest\.json was not published/);
    });
  });

  describe("platform coverage", () => {
    it("catches a missing platform — the failure that shipped once", () => {
      const release = goodRelease();
      delete release.manifest.platforms["darwin-aarch64"];

      const problems = inspectRelease(release);
      assert.ok(problems.some((p) => /darwin-aarch64 is missing/.test(p)));
      assert.ok(problems.some((p) => /get no update/.test(p)));
    });

    it("checks every required platform", () => {
      for (const platform of REQUIRED_PLATFORMS) {
        const release = goodRelease();
        delete release.manifest.platforms[platform];
        assert.ok(
          inspectRelease(release).some((p) => p.includes(platform)),
          `${platform} should be required`,
        );
      }
    });
  });

  describe("URLs", () => {
    it("catches a URL pointing at an asset that was not published", () => {
      const release = goodRelease();
      release.assets = release.assets.filter((name) => name !== "YoYoMusic.app.tar.gz");

      assert.match(inspectRelease(release)[0], /not a published asset/);
    });

    it("catches a macOS payload that is not an .app tarball", () => {
      // The dmg installs by hand; only the .app tarball can replace a running
      // app, so pointing the updater at the dmg breaks macOS updates.
      const release = goodRelease();
      release.manifest.platforms["darwin-aarch64"].url =
        "https://github.com/ijry/YoYoMusic/releases/download/v0.0.2/YoYoMusic_0.0.2_aarch64.dmg";

      assert.match(inspectRelease(release)[0], /not an \.app\.tar\.gz/);
    });

    it("catches a missing signature", () => {
      const release = goodRelease();
      release.manifest.platforms["linux-x86_64"].signature = "";

      assert.ok(inspectRelease(release).some((p) => /has no signature/.test(p)));
    });
  });

  it("catches signatures published as separate assets", () => {
    // They are inlined into the manifest; leaving the files up clutters the
    // release and invites someone to use the wrong one.
    const release = goodRelease();
    release.assets.push("YoYoMusic_0.0.2_x64-setup.exe.sig");

    assert.match(inspectRelease(release)[0], /signature files were published/);
  });

  describe("the release body", () => {
    it("catches a truncated body", () => {
      const release = goodRelease();
      release.body = "## 悠悠乐听 v0.0.2";
      assert.match(inspectRelease(release)[0], /looks truncated/);
    });

    it("catches a missing footer section", () => {
      const release = goodRelease();
      // The body has no trailing newline, so filter the line rather than
      // replacing `"## 链接\n"` — that would silently match nothing.
      release.body = release.body
        .split("\n")
        .filter((line) => line.trim() !== "## 链接")
        .join("\n");

      assert.ok(inspectRelease(release).some((p) => /missing the footer heading "## 链接"/.test(p)));
    });
  });

  it("reports every problem at once", () => {
    // A broken release usually has more than one thing wrong, and finding them
    // one per run wastes a round trip each time.
    const release = goodRelease();
    release.manifest.version = "0.0.1";
    delete release.manifest.platforms["darwin-aarch64"];
    release.assets.push("stray.sig");

    const problems = inspectRelease(release);
    assert.ok(problems.length >= 3, `expected several problems, got ${problems.length}`);
  });
});
