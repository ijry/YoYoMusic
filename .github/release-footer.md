---

## 下载

| 平台 | 安装包 |
| --- | --- |
| Windows 10/11 | `<名称> Setup <版本>.exe`（NSIS 安装器） |
| macOS | `.dmg`（universal，同时支持 Intel 与 Apple Silicon） |
| Linux | `.deb`，或 `install.sh` + tar.gz（安装到 `~/.local`，可自行更新） |

## 安装提示

- **macOS**：安装包未做代码签名与公证，首次打开请右键点击图标 → 选择「打开」，或在「系统设置 → 隐私与安全性」中允许。
- **Windows**：未做代码签名，SmartScreen 可能提示「Windows 已保护你的电脑」，点击「更多信息」→「仍要运行」即可。
- **Linux**：AppImage 式 tar 包解压后运行其中的 `install.sh`；也可直接使用 `.deb`。

## 更新

安装后的版本会自行检查更新（`文件 → 检查更新…`），差量下载后重启即生效，无需重新安装。

## 链接

- 问题反馈：<https://github.com/ijry/YoYoMusic/issues>
- 本项目以 **AGPL-3.0-or-later** 许可发布，详见 [LICENSE](https://github.com/ijry/YoYoMusic/blob/go/LICENSE)。
