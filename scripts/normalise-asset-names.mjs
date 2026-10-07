import { readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Renames the bundles to their published asset names.
 *
 * Tauri names everything after `productName`, which is 悠悠乐听 here, and the
 * GitHub release uploader strips non-ASCII characters from asset names — so a
 * bundle would land as `_0.0.1_x64-setup.exe`. Renaming them before the upload
 * is what keeps the URLs the updater manifest points at actually resolvable.
 *
 * This runs *before* the manifest is generated, so the manifest picks up the
 * final names. Renaming does not invalidate a signature: minisign covers the
 * file's bytes, not its name.
 */

/** What a Chinese product name is replaced with. */
export const ASCII_PREFIX = "YoYoMusic";

/**
 * Characters dropped from the front of a name before the prefix is added —
 * anything that is not a letter, a digit or a dot.
 *
 * The dot has to stay: macOS produces `悠悠乐听.app.tar.gz`, and the `.app`
 * segment is what says "this is the updater payload" as opposed to the dmg
 * beside it. Stripping it too yields `YoYoMusic_app.tar.gz`, which no longer
 * reads as an app bundle. A `.` in that leading position is a deliberate part
 * of the name, not separator noise.
 */
const LEADING_NOISE = /^[^A-Za-z0-9.]+/;

/** Turns one Chinese filename into its published name. */
export function publishedName(fileName) {
  const rest = fileName.replace(LEADING_NOISE, "");

  // `悠悠乐听.app.tar.gz` → `YoYoMusic.app.tar.gz`
  if (rest.startsWith(".")) return `${ASCII_PREFIX}${rest}`;

  // `悠悠乐听_0.0.1_x64-setup.exe` → `YoYoMusic_0.0.1_x64-setup.exe`
  return `${ASCII_PREFIX}_${rest}`;
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

export async function normaliseAssetNames(assetsDir) {
  const rootStat = await stat(assetsDir).catch(() => null);
  if (!rootStat?.isDirectory()) throw new Error(`Not a directory: ${assetsDir}`);

  const renamed = [];
  for (const file of await listFiles(assetsDir)) {
    const directory = path.dirname(file);
    const base = path.basename(file);
    if (base.startsWith(ASCII_PREFIX)) continue;

    const target = path.join(directory, publishedName(base));
    await rename(file, target);
    renamed.push([base, path.basename(target)]);
  }

  return renamed;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const assetsDir = process.argv[2];
  if (!assetsDir) {
    console.error("Usage: node scripts/normalise-asset-names.mjs <assets-dir>");
    process.exitCode = 1;
  } else {
    normaliseAssetNames(assetsDir)
      .then((renamed) => {
        for (const [from, to] of renamed) console.log(`${from} → ${to}`);
        if (renamed.length === 0) console.log("nothing to rename");
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
  }
}
