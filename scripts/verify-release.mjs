import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Post-release verification.
 *
 * A green release workflow is not the same as a correct release. This project
 * has already shipped one release that was green, created a Release, and was
 * missing a platform: macOS had been built with `--bundles dmg`, which is not
 * an updater-enabled target, so no `.app.tar.gz` and no `.sig` were produced,
 * and the manifest silently listed only two platforms. Every macOS user would
 * simply never have been offered an update.
 *
 * The manifest script now refuses a partial release, but this is the check that
 * reads what was actually published, which is the only thing a client sees.
 *
 *   node scripts/verify-release.mjs v0.0.2
 */

/**
 * Every platform the manifest must cover.
 *
 * The asset name is version-dependent, so it is derived rather than written
 * here — only the platform keys are fixed.
 */
export const REQUIRED_PLATFORMS = ["windows-x86_64", "darwin-aarch64", "linux-x86_64"];

/** Asset names that must never be published — the signatures are inlined. */
export const FORBIDDEN_SUFFIX = ".sig";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", cwd: repoRoot() });
}

function repoRoot() {
  return path.resolve(fileURLToPath(import.meta.url), "../..");
}

export function releaseAssets(tag) {
  const json = gh(["release", "view", tag, "--json", "assets"]);
  return JSON.parse(json).assets.map((asset) => asset.name);
}

export function releaseBody(tag) {
  return gh(["release", "view", tag, "--json", "body", "-q", ".body"]);
}

export function downloadManifest(tag, into) {
  gh(["release", "download", tag, "-p", "latest.json", "--clobber", "--dir", into]);
  return JSON.parse(readFileSync(path.join(into, "latest.json"), "utf8"));
}

/**
 * Checks a published release and returns the problems found.
 *
 * Returns findings rather than throwing so the caller can report all of them at
 * once — a broken release usually has more than one thing wrong.
 */
export function inspectRelease({ tag, assets, manifest, body }) {
  const problems = [];
  const version = tag.replace(/^v/i, "");

  // 1. The manifest must be published, and must be for this version.
  if (!manifest) {
    problems.push("latest.json was not published — no client can check for updates");
  } else if (manifest.version !== version) {
    problems.push(
      `latest.json says ${manifest.version}, but the tag is ${tag}. ` +
        `Clients on ${version} would not be offered this release.`,
    );
  }

  // 2. Every platform must be present.
  for (const platform of REQUIRED_PLATFORMS) {
    if (manifest && !manifest.platforms?.[platform]) {
      problems.push(`${platform} is missing from latest.json — those users get no update`);
    }
  }

  // 3. Every URL in the manifest must name an asset that actually exists.
  for (const [platform, entry] of Object.entries(manifest?.platforms ?? {})) {
    const name = decodeURIComponent(entry.url.split("/").pop());
    if (!assets.includes(name)) {
      problems.push(`${platform} points at ${name}, which is not a published asset`);
    }
    if (!entry.signature) problems.push(`${platform} has no signature`);
  }

  // 4. The macOS payload must be the .app tarball, not something else.
  if (manifest?.platforms?.["darwin-aarch64"]) {
    const url = manifest.platforms["darwin-aarch64"].url;
    if (!/\.app\.tar\.gz$/.test(url)) {
      problems.push(`darwin-aarch64 points at ${url}, not an .app.tar.gz`);
    }
  }

  // 5. Signatures must not be published separately.
  const straySignatures = assets.filter((name) => name.endsWith(FORBIDDEN_SUFFIX));
  if (straySignatures.length > 0) {
    problems.push(`signature files were published: ${straySignatures.join(", ")}`);
  }

  // 6. The release body must carry every heading from the notes, since the
  //    footer is appended by the workflow and a lost heading is invisible.
  const headings = (body ?? "").split("\n").filter((line) => /^#+\s/.test(line));
  if (headings.length < 5) {
    problems.push(`release body has only ${headings.length} headings — looks truncated`);
  }
  for (const expected of ["## 下载", "## 安装提示", "## 链接"]) {
    if (!headings.some((line) => line.trim() === expected)) {
      problems.push(`release body is missing the footer heading "${expected}"`);
    }
  }

  return problems;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const tag = process.argv[2];
  if (!tag) {
    console.error("Usage: node scripts/verify-release.mjs <tag>   e.g. v0.0.2");
    process.exitCode = 1;
  } else {
    const into = path.join(repoRoot(), ".visual-check");
    const assets = releaseAssets(tag);
    const manifest = downloadManifest(tag, into);
    const problems = inspectRelease({ tag, assets, manifest, body: releaseBody(tag) });

    console.log(`资产（${assets.length}）:`);
    for (const name of [...assets].sort()) console.log(`  ${name}`);
    console.log(`\n平台: ${Object.keys(manifest.platforms).sort().join(", ")}`);

    if (problems.length === 0) {
      console.log(`\n${tag} 核对通过 ✓`);
    } else {
      console.error(`\n发现 ${problems.length} 个问题:`);
      for (const problem of problems) console.error(`  ✗ ${problem}`);
      process.exitCode = 1;
    }
  }
}
