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
