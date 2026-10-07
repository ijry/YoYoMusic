import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * `tauri build` refuses to run when the Rust `tauri` crate and the npm
 * `@tauri-apps/api` package are on different major.minor versions:
 *
 *     Error Found version mismatched Tauri packages.
 *     tauri (v2.11.5) : @tauri-apps/api (v2.12.1)
 *
 * Nothing else catches it. `cargo test` does not care, and the frontend build
 * does not either, so the mismatch only surfaces in the release job — after a
 * tag has been pushed, on all three platforms, and the only way out is to
 * delete the tag and start again.
 *
 * It happened once: installing the updater plugins with `^2` pulled
 * `@tauri-apps/api` from 2.11.1 to 2.12.1, because those plugin versions
 * declare `@tauri-apps/api: ^2.12.0`.
 *
 * So compare the two resolved versions and fail early. This reads the lockfiles
 * rather than the manifests: what matters is what will actually be installed,
 * not the range someone wrote.
 */

export const TAURI_CRATE = "tauri";
export const TAURI_NPM_PACKAGE = "@tauri-apps/api";

/** `2.11.5` -> `2.11`. */
export function majorMinor(version) {
  const [major, minor] = String(version).split(".");
  if (!major || !minor) throw new Error(`Not a semver version: ${version}`);
  return `${major}.${minor}`;
}

/**
 * Reads the version of `name` from a Cargo.lock.
 *
 * The file is TOML, but every package entry is the same three-line shape and
 * pulling in a TOML parser for this is not worth a dependency.
 */
export function cargoLockVersion(lockText, name) {
  const blocks = lockText.split(/^\[\[package\]\]$/m);
  for (const block of blocks) {
    const nameMatch = block.match(/^name\s*=\s*"([^"]+)"/m);
    if (nameMatch?.[1] !== name) continue;
    const versionMatch = block.match(/^version\s*=\s*"([^"]+)"/m);
    if (versionMatch) return versionMatch[1];
  }
  return null;
}

/** Reads the version installed at `node_modules/<name>` from a package-lock. */
export function npmLockVersion(lockJson, name) {
  const key = `node_modules/${name}`;
  return lockJson.packages?.[key]?.version ?? null;
}

export function findMismatch({ cargoLock, npmLock }) {
  const rustVersion = cargoLockVersion(cargoLock, TAURI_CRATE);
  const npmVersion = npmLockVersion(npmLock, TAURI_NPM_PACKAGE);

  if (!rustVersion) throw new Error(`Cargo.lock has no \`${TAURI_CRATE}\` package`);
  if (!npmVersion) throw new Error(`package-lock.json has no \`${TAURI_NPM_PACKAGE}\``);

  return {
    rustVersion,
    npmVersion,
    ok: majorMinor(rustVersion) === majorMinor(npmVersion),
  };
}

export function checkTauriVersions(repoRoot) {
  const result = findMismatch({
    cargoLock: readFileSync(path.join(repoRoot, "src-tauri/Cargo.lock"), "utf8"),
    npmLock: JSON.parse(readFileSync(path.join(repoRoot, "package-lock.json"), "utf8")),
  });

  if (!result.ok) {
    throw new Error(
      `Tauri versions are on different minor releases, so \`tauri build\` will refuse to run:\n` +
        `  ${TAURI_CRATE} (Rust)   ${result.rustVersion}\n` +
        `  ${TAURI_NPM_PACKAGE} (npm)  ${result.npmVersion}\n` +
        `Pin them to the same major.minor — see the note in src-tauri/Cargo.toml.`,
    );
  }

  return result;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const repoRoot = process.argv[2] ?? path.resolve(fileURLToPath(import.meta.url), "../..");
  try {
    const { rustVersion, npmVersion } = checkTauriVersions(repoRoot);
    console.log(`${TAURI_CRATE} ${rustVersion} : ${TAURI_NPM_PACKAGE} ${npmVersion} — 一致 ✓`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
