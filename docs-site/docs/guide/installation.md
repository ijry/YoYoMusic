# 安装

悠悠乐听提供 Windows、macOS 与 Linux 三个平台的安装包，全部从 GitHub Releases 分发。

## 下载

前往 [最新版本](https://github.com/ijry/YoYoMusic/releases/latest)，按平台选择：

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows 10/11 | `*_x64-setup.exe` | NSIS 安装器，可选安装目录 |
| Windows 10/11 | `*_x64_zh-CN.msi` | MSI 安装包，适合批量部署 |
| macOS | `*.dmg` | 通用包，Apple Silicon 与 Intel 均可运行 |
| Linux | `*.deb` | Debian / Ubuntu，`sudo dpkg -i` 或双击安装 |
| Linux | `*.AppImage` | 免安装，下载后 `chmod +x` 直接运行 |

## 首次运行提示

安装包**未做代码签名**，系统可能会给出安全提示。这不是因为程序有问题，而是开源项目通常不购买签名证书。

::: warning macOS：提示「无法验证开发者」
右键点击应用图标 → 选择「打开」→ 在弹窗中再点「打开」。或者前往「系统设置 → 隐私与安全性」，在底部点击「仍要打开」。

也可以一次性移除隔离属性：

```bash
xattr -dr com.apple.quarantine /Applications/悠悠乐听.app
```
:::

::: warning Windows：SmartScreen 拦截
点击弹窗里的「更多信息」→「仍要运行」。
:::

::: tip Linux AppImage
```bash
chmod +x 悠悠乐听_0.0.1_amd64.AppImage
./悠悠乐听_0.0.1_amd64.AppImage
```
:::

## 从源码构建

需要 Node.js 22+、Rust 1.77+，以及对应平台的 [Tauri 系统依赖](https://tauri.app/start/prerequisites/)。

```bash
git clone https://github.com/ijry/YoYoMusic.git
cd YoYoMusic
npm install
npm run tauri dev          # 开发模式
npm run tauri build        # 构建安装包
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 系统要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows 10 及以上 / macOS 11 及以上 / 主流 Linux 发行版 |
| 架构 | x86_64（macOS 另支持 Apple Silicon） |
| 音频后端 | Windows WASAPI、macOS CoreAudio、Linux ALSA/PulseAudio |
| 支持格式 | 由 [rodio](https://github.com/RustAudio/rodio) 与 [lofty](https://github.com/Serial-ATA/lofty-rs) 决定，覆盖 MP3 / FLAC / AAC / WAV / OGG 等常见格式 |

::: tip Linux 缺少音频库
若启动后无法播放，安装 ALSA 开发库：

```bash
sudo apt-get install libasound2
```
:::
