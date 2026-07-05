# Building YoYoMusic

## Development

```powershell
npm install
npm run tauri dev
```

## Tests

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Frontend build

```powershell
npm run build
```

## Local installer build

```powershell
npm run tauri build
```

Installer artifacts are created under `src-tauri/target/release/bundle/`.

## GitHub Actions installer build

Open GitHub Actions, choose `Build installers`, select `Run workflow`, and keep `releaseDraft` as `false` to upload platform artifacts only. Select `true` to create a draft release named `YoYoMusic manual build <run_number>`.

Artifacts:

- `yoyomusic-windows-installers`
- `yoyomusic-macos-installers`
- `yoyomusic-linux-installers`

## Release readiness checks

Run these before tagging or publishing an installer:

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

On Windows, `npm run tauri build` produces MSI and NSIS installers under `src-tauri/target/release/bundle/`. macOS and Linux installers are verified from the manual `Build installers` workflow artifacts after a GitHub Actions run completes.

Autoplay smoke check:

1. Add at least two local audio files.
2. Set play mode to `顺序播放` and play the first track.
3. Wait for the first track to finish and confirm the second track starts automatically.
4. Set play mode to `列表循环` and confirm the final track wraps to the first track.
5. Open mini mode and confirm it follows automatic track changes.
