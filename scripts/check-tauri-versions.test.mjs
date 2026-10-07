import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  cargoLockVersion,
  checkTauriVersions,
  findMismatch,
  majorMinor,
  npmLockVersion,
} from "./check-tauri-versions.mjs";

/** A Cargo.lock fragment in the shape cargo actually writes. */
function cargoLock(tauriVersion, extra = "") {
  return `version = 4

[[package]]
name = "serde"
version = "1.0.219"

[[package]]
name = "tauri"
version = "${tauriVersion}"
source = "registry+https://github.com/rust-lang/crates.io-index"
dependencies = [
 "serde",
]

${extra}
[[package]]
name = "tauri-build"
version = "2.5.6"
`;
}

function npmLock(apiVersion) {
  return { packages: { "node_modules/@tauri-apps/api": { version: apiVersion } } };
}

describe("majorMinor", () => {
  it("keeps the first two components", () => {
    assert.equal(majorMinor("2.11.5"), "2.11");
    assert.equal(majorMinor("2.12.1"), "2.12");
    assert.equal(majorMinor("0.0.1"), "0.0");
  });

  it("rejects something that is not a version", () => {
    assert.throws(() => majorMinor("2"), /Not a semver/);
  });
});

describe("cargoLockVersion", () => {
  it("finds a package by name", () => {
    assert.equal(cargoLockVersion(cargoLock("2.11.5"), "tauri"), "2.11.5");
    assert.equal(cargoLockVersion(cargoLock("2.11.5"), "serde"), "1.0.219");
  });

  it("does not confuse a prefix with the real name", () => {
    // `tauri` must not match `tauri-build` — the release check compares `tauri`
    // itself, and reading the wrong one would pass a broken combination.
    const lock = cargoLock("2.11.5");
    assert.equal(cargoLockVersion(lock, "tauri"), "2.11.5");
    assert.equal(cargoLockVersion(lock, "tauri-build"), "2.5.6");
  });

  it("returns null when the package is absent", () => {
    assert.equal(cargoLockVersion(cargoLock("2.11.5"), "not-a-crate"), null);
  });
});

describe("npmLockVersion", () => {
  it("reads the installed version from the packages map", () => {
    assert.equal(npmLockVersion(npmLock("2.11.1"), "@tauri-apps/api"), "2.11.1");
  });

  it("returns null when the package is absent", () => {
    assert.equal(npmLockVersion(npmLock("2.11.1"), "@tauri-apps/something"), null);
  });
});

describe("findMismatch", () => {
  it("accepts matching minor versions", () => {
    const result = findMismatch({ cargoLock: cargoLock("2.11.5"), npmLock: npmLock("2.11.1") });
    assert.equal(result.ok, true);
  });

  it("accepts a patch difference", () => {
    // 2.11.5 against 2.11.1 is fine; only major.minor is enforced.
    const result = findMismatch({ cargoLock: cargoLock("2.11.5"), npmLock: npmLock("2.11.9") });
    assert.equal(result.ok, true);
  });

  it("rejects the mismatch that actually broke a release", () => {
    // tauri 2.11.5 : @tauri-apps/api 2.12.1 — the exact pair `tauri build`
    // refused, after the updater plugins pulled the npm package forward.
    const result = findMismatch({ cargoLock: cargoLock("2.11.5"), npmLock: npmLock("2.12.1") });
    assert.equal(result.ok, false);
    assert.equal(result.rustVersion, "2.11.5");
    assert.equal(result.npmVersion, "2.12.1");
  });

  it("rejects a major difference too", () => {
    const result = findMismatch({ cargoLock: cargoLock("2.11.5"), npmLock: npmLock("3.0.0") });
    assert.equal(result.ok, false);
  });

  it("complains when a lockfile is missing the package", () => {
    assert.throws(
      () => findMismatch({ cargoLock: cargoLock("2.11.5"), npmLock: { packages: {} } }),
      /no `@tauri-apps\/api`/,
    );
    assert.throws(
      () => findMismatch({ cargoLock: "version = 4\n", npmLock: npmLock("2.11.1") }),
      /no `tauri` package/,
    );
  });
});

describe("checkTauriVersions", () => {
  async function repo(cargoLockText, npmLockJson) {
    const root = await mkdtemp(path.join(tmpdir(), "yoyo-tauri-"));
    await mkdir(path.join(root, "src-tauri"), { recursive: true });
    await writeFile(path.join(root, "src-tauri/Cargo.lock"), cargoLockText);
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify(npmLockJson));
    return root;
  }

  it("passes on a consistent repository", async () => {
    const root = await repo(cargoLock("2.11.5"), npmLock("2.11.1"));
    const result = checkTauriVersions(root);
    assert.equal(result.ok, true);
  });

  it("names both versions in the error, so the fix is obvious", async () => {
    const root = await repo(cargoLock("2.11.5"), npmLock("2.12.1"));
    assert.throws(
      () => checkTauriVersions(root),
      (error) => {
        assert.match(error.message, /tauri \(Rust\)\s+2\.11\.5/);
        assert.match(error.message, /@tauri-apps\/api \(npm\)\s+2\.12\.1/);
        assert.match(error.message, /same major\.minor/);
        return true;
      },
    );
  });
});
