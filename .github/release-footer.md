
---

## 下载

| 平台 | 安装包 |
| --- | --- |
| Windows 10/11 | `.exe`（NSIS 安装器）或 `.msi` |
| macOS（Apple Silicon） | `.dmg` |
| Linux | `.deb` 或 `.AppImage` |

> macOS 目前只提供 Apple Silicon（M 系列）构建，Intel 机型暂不可用 ——
> 构建跑在 arm64 runner 上，产物是 `aarch64.dmg`，无法在 Intel 上运行。

## 安装提示

- **macOS**：安装包未做代码签名与公证，首次打开请右键点击图标 → 选择「打开」，或在「系统设置 → 隐私与安全性」中允许。
- **Windows**：未做代码签名，SmartScreen 可能提示「Windows 已保护你的电脑」，点击「更多信息」→「仍要运行」即可。
- **Linux AppImage**：下载后先 `chmod +x 文件名.AppImage` 再运行。

## 链接

- 文档与界面预览：<https://ijry.github.io/YoYoMusic/>
- 问题反馈：<https://github.com/ijry/YoYoMusic/issues>
- 本项目以 **AGPL-3.0-or-later** 许可发布，详见 [LICENSE](https://github.com/ijry/YoYoMusic/blob/main/LICENSE)。
