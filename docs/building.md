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
