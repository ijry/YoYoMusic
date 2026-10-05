# 发布流程

发布由 GitHub Actions 自动完成，触发条件是推送一个 `v*.*.*` 形式的标签。

## 工作流总览

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| `ci.yml` | 推送到 `main`、PR | 前端 lint / 构建 / 单元测试 + Rust 测试 |
| `release.yml` | 推送 `v*.*.*` 标签 | 校验版本 → 三端构建安装包 → 发布 GitHub Release |
| `docs.yml` | `docs-site/**` 变更 | 构建文档站并部署到 GitHub Pages |

## 发版步骤

### 1. 同步版本号

三处版本号必须一致，`release.yml` 会在构建前逐项校验，不一致直接失败：

```bash
# 1) package.json
node -p "require('./package.json').version"

# 2) src-tauri/tauri.conf.json
node -p "require('./src-tauri/tauri.conf.json').version"

# 3) src-tauri/Cargo.toml
grep -m1 '^version' src-tauri/Cargo.toml
```

改完 `Cargo.toml` 后同步 `Cargo.lock` 里 `yoyomusic` 条目，或直接跑一次 `cargo check`。

### 2. 本地自检

```bash
npm test
npm run build
npx oxlint src
cargo test --manifest-path src-tauri/Cargo.toml
```

### 3. 提交并打标签

标签信息（annotated tag 的正文）会**原样成为 Release 说明**，所以要把它当成正式更新日志来写：

```bash
git add -A
git commit -m "chore: release v0.0.1"
git tag -a v0.0.1 -m "$(cat <<'EOF'
## 亮点

- 全新的深色玻璃拟态界面
- 六种 Canvas 音频可视化
- 四套内置皮肤

## 修复

- ...
EOF
)"
git push origin main
git push origin v0.0.1
```

推送标签后 `release.yml` 会自动跑起来。

### 4. 验证产物

工作流结束后，Release 页面应当出现四个安装包：

- Windows：`.exe`（NSIS）与 `.msi`
- macOS：`.dmg`
- Linux：`.deb` 与 `.AppImage`

## release.yml 做了什么

1. **verify** —— 校验标签版本与三处版本文件一致，并确认标签提交位于默认分支上；随后在 Ubuntu 上跑 lint、前端测试与 Rust 测试。
2. **build** —— 三个平台并行构建。Windows 出 NSIS + MSI，macOS 出 DMG，Linux 出 DEB + AppImage。构建由 `npx tauri build --ci --bundles <列表>` 完成，前端产物由 Tauri 的 `beforeBuildCommand` 自动构建。
3. **publish** —— 汇总三个平台的产物，把标签正文与 `.github/release-footer.md` 拼接成 Release 说明，最后创建正式 Release。

## 代码签名

当前安装包**未做代码签名**，因为签名证书需要付费且按平台分别申请。用户首次运行时 macOS 与 Windows 会给出安全提示，处理方式见[安装](/guide/installation)。

如果后续要接入签名，需要补充：

- macOS：`APPLE_CERTIFICATE`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`
- Windows：`WINDOWS_CERTIFICATE`、`WINDOWS_CERTIFICATE_PASSWORD`

## 文档站

文档站位于 `docs-site/`，使用 VitePress。本地预览：

```bash
cd docs-site
npm install
npm run docs:dev
```

推送到 `main` 且改动落在 `docs-site/**` 时，`docs.yml` 会构建并部署到 GitHub Pages。仓库的 Pages 来源需要设置为 **GitHub Actions**。
