const audioExtensions = ["mp3", "flac", "wav", "ogg", "m4a", "aac"];

export async function openAudioFiles() {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Audio", extensions: audioExtensions }],
  });
  return normalizeSelection(selected);
}

export async function openAudioFolders() {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: true,
    directory: true,
  });
  return normalizeSelection(selected);
}

export async function openSkinPackageFolder() {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    directory: true,
  });
  return normalizeSelection(selected)[0] ?? null;
}

function normalizeSelection(selection: string | string[] | null) {
  if (!selection) return [];
  return Array.isArray(selection) ? selection : [selection];
}
