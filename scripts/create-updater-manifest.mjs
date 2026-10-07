import { mkdir, readdir, readFile, stat, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Builds the updater manifest (`latest.json`) that the app polls.
 *
 * Tauri writes one `.sig` next to every bundle it signs. Each signature pairs
 * with the file beside it, and the signature *text* — not a path or URL — goes
 * into the manifest, because that is what the app verifies the download
 * against.
 *
 * Run this *after* the installer files have been renamed to their ASCII asset
 * names: the URLs in the manifest have to match what the release ends up
 * hosting. Renaming a file does not invalidate its signature, which covers the
 * bytes rather than the name.
 */

/**
 * Build-matrix directory → the key the updater looks itself up under.
 *
 * The keys are `OS-ARCH` as Tauri reports them. `macos-latest` on GitHub is
 * arm64, which is why only `darwin-aarch64` appears.
 */
const PLATFORMS = new Map([
  ["yoyomusic-windows", "windows-x86_64"],
  ["yoyomusic-macos", "darwin-aarch64"],
  ["yoyomusic-linux", "linux-x86_64"],
]);

/**
 * Every platform the release is supposed to ship.
 *
 * Checked explicitly, because the first signed release went out with only two
 * of the three: macOS had been built with `--bundles dmg`, and `dmg` is not an
 * updater-enabled target, so it produced no `.sig`. Tauri only *warned* about
 * that, and this script silently omitted the platform it had no signature for —
 * so the release looked successful and macOS users would simply never be
 * offered an update. A missing platform is a broken release, not a smaller one.
 */
const REQUIRED_PLATFORMS = [...PLATFORMS.values()];

/**
 * Which signed file is the update payload.
 *
 * A signed directory can hold several bundles — Windows signs both the NSIS
 * installer and the MSI — but only one is what the updater downloads. The
 * preference order decides; these mirror what Tauri produces for each platform.
 */
const PAYLOAD_PREFERENCE = [
  /\.app\.tar\.gz$/i, // macOS: the updater cannot swap out a running .app in place
  /-setup\.exe$/i, // Windows: NSIS is the updater target, not the MSI
  /\.AppImage$/i, // Linux
  /\.exe$/i,
  /\.msi$/i,
];

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    }
    args.set(key.slice(2), value);
  }
  return args;
}

function required(args, key) {
  const value = args.get(key);
  if (!value) throw new Error(`Missing --${key}`);
  return value;
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function pickPayload(candidates) {
  for (const pattern of PAYLOAD_PREFERENCE) {
    const match = candidates.find((candidate) => pattern.test(candidate));
    if (match) return match;
  }
  return candidates[0];
}

export async function createManifest({ assetsDir, tag, repo, notesFile, output }) {
  const rootStat = await stat(assetsDir);
  if (!rootStat.isDirectory()) throw new Error(`Not a directory: ${assetsDir}`);

  const files = await listFiles(assetsDir);
  const signatures = files.filter((file) => file.endsWith(".sig"));
  if (signatures.length === 0) {
    throw new Error(
      `No .sig files under ${assetsDir}. Is bundle.createUpdaterArtifacts set, and were TAURI_SIGNING_PRIVATE_KEY and its password passed to the build?`,
    );
  }

  const byDirectory = new Map();
  for (const signaturePath of signatures) {
    const assetPath = signaturePath.slice(0, -".sig".length);
    if (!files.includes(assetPath)) {
      throw new Error(`Signature has no matching file: ${signaturePath}`);
    }
    const directory = path.relative(assetsDir, signaturePath).split(path.sep)[0];
    const entries = byDirectory.get(directory) ?? [];
    entries.push({ assetPath, signaturePath });
    byDirectory.set(directory, entries);
  }

  const platforms = {};
  for (const [directory, entries] of [...byDirectory.entries()].sort()) {
    const platform = PLATFORMS.get(directory);
    if (!platform) {
      throw new Error(
        `Unknown build directory "${directory}". Expected one of: ${[...PLATFORMS.keys()].join(", ")}`,
      );
    }
    if (platforms[platform]) {
      throw new Error(`Two directories both claim ${platform}`);
    }

    const assetPath = pickPayload(entries.map((entry) => entry.assetPath));
    const signaturePath = `${assetPath}.sig`;

    platforms[platform] = {
      signature: (await readFile(signaturePath, "utf8")).trim(),
      url: `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(
        path.basename(assetPath),
      )}`,
    };
  }

  const notes = notesFile ? (await readFile(notesFile, "utf8")).trim() : "";

  const missing = REQUIRED_PLATFORMS.filter((platform) => !platforms[platform]);
  if (missing.length > 0) {
    throw new Error(
      `No signed updater bundle for: ${missing.join(", ")}.\n` +
        `  Every build directory must contain at least one signed file. The usual cause is a ` +
        `platform built without an updater-enabled target — macOS needs \`--bundles app\` ` +
        `(dmg alone is not enough), Windows needs nsis, Linux needs appimage.`,
    );
  }

  const manifest = {
    version: tag.replace(/^v/i, ""),
    notes,
    pub_date: new Date().toISOString(),
    platforms,
  };

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);

  /*
   * The signatures now travel inline, and the manifest is the only thing that
   * reads them — the updater never fetches a sibling `.sig`. Leaving them on
   * the release page would only add clutter.
   */
  for (const signaturePath of signatures) await unlink(signaturePath);

  return manifest;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  createManifest({
    assetsDir: required(args, "assets-dir"),
    tag: required(args, "tag"),
    repo: required(args, "repo"),
    notesFile: args.get("notes-file"),
    output: required(args, "output"),
  })
    .then((manifest) => {
      const keys = Object.keys(manifest.platforms);
      console.log(`latest.json → ${keys.join(", ")} (version ${manifest.version})`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
