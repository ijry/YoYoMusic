# YoYoMusic · 悠悠乐听

用 Go 与原生 UI 打造的桌面音乐播放器，基于 [mygo](https://github.com/egoist/mygo) 框架重写，取代此前的 Tauri + React 实现。

**纯 Go，无 cgo，无 WebView。** 界面由 Go 直接绘制，音频解码同样全部使用纯 Go 实现。

## 特性

- **6 种实时音频可视化** — 频谱、波形、径向、粒子、极光、瀑布
- **4 套玻璃拟态主题** — 极光玻璃、午夜霓虹、落日熔金、薄荷录音室
- **10 段参数均衡器** — 7 组预设，可逐段微调
- **本地音乐库** — 支持 WAV / MP3 / FLAC / OGG
- **桌面歌词占位**与可视化切换
- **全局快捷键** — 后台也能控制播放
- **系统托盘** — 播放控制与导入
- **自动更新** — 签名校验，差量下载
- **无缝升级** — 自动继承旧版 Tauri 版本的设置与曲库

## 构建

需要 Go 1.27 或更高版本。

```bash
go build -o yoyomusic .
```

跨平台构建（无需目标平台的工具链，因为不使用 cgo）：

```bash
GOOS=windows GOARCH=amd64 go build -o yoyomusic.exe .
GOOS=darwin  GOARCH=arm64 go build -o yoyomusic .
GOOS=linux   GOARCH=amd64 go build -o yoyomusic .
```

发布带自动更新的构建：

```bash
go tool mygo build -upload
```

打 tag 后由 GitHub Actions 自动发布三个平台的安装包：

```bash
git tag -a go-v1.0.1 -m "## 1.0.1

- 修了某个问题
"
git push origin go-v1.0.1
```

> **`mygo.json` 的 `name` 必须是 ASCII。** 它会被用作可执行文件名、安装目录名和
> 快捷方式名，而 NSIS 无法处理绝对路径中的非 ASCII 文件名（实测
> `File "…\悠悠乐听.exe"` 报 `no files found`）。中文名写在 `main.go` 的
> `mygo.App.SetName` 与窗口标题里——用户看到中文，落盘是 ASCII，两者互不影响。

## 开发

```bash
go run .                     # 直接运行
go run . -play some.wav      # 启动并播放指定文件
go test ./...                # 运行测试
```

## 图标资源

`resources/` 下的图标与 Tauri 版保持一致，`mygo build` 会基于 `icon.png` 自动生成各平台格式：

| 文件 | 尺寸 | 用途 |
|---|---|---|
| `icon.png` | 512×512 | 打包主图标（macOS .icns / Windows / Linux 均由此生成） |
| `icon-32.png` | 32×32 | 系统托盘（托盘本身会缩放，直接用原生小图最清晰） |
| `icon-128.png` | 128×128 | 中等尺寸备用 |
| `icon-256.png` | 256×256 | 高分屏 |
| `icon.ico` | 16–256 多尺寸 | Windows 原始多尺寸图标 |
| `icon.icns` | 多尺寸 | macOS 原始图标 |

## 从旧版升级

旧版（Tauri）的设置保存在 `%APPDATA%/com.xyito.yoyomusic/settings.json`。
本版本首次启动时会自动读取该文件，把皮肤、可视化模式、均衡器、快捷键与曲库迁移到
`%APPDATA%/YoYoMusic/settings.json`，无需任何手动操作。

旧版中已不存在的皮肤会回退到内置主题；曲库中文件已丢失的条目会被跳过。

## CI 与发布

两个工作流，都由 GitHub Actions 运行：

| 工作流 | 触发 | 内容 |
|---|---|---|
| `ci.yml` | push / PR 到 `go` | gofmt、vet、测试；**四个目标**（linux/amd64、windows/amd64、darwin/universal、darwin/arm64）各自编译 + 冒烟 + 打包 |
| `release.yml` | push `go-v*.*.*` tag，或手动 | 校验 tag 与版本号一致、签名密钥在位 → 三平台构建并上传为草稿 Release → 发布 |

因为不用 cgo，任何平台都能在任意 runner 上交叉编译，所以 CI 矩阵不需要
Linux 的 webkit/appindicator/rsvg/patchelf 那一整套系统依赖——这是相对
Tauri 版最省事的一点。

发布需要的 secret：

- `MYGO_UPDATER_PRIVATE_KEY` — `go tool mygo keygen` 生成的私钥内容
  （公钥已写在 `mygo.json` 的 `updates.publicKey`）

`mygo build -upload` 会把安装包和 `update-<target>.json` 传到该版本的
Release（草稿状态），`publish` job 再把它转为正式发布，已安装的应用这才
会看到更新。

## 代码结构

```
main.go                      窗口、菜单、托盘、快捷键装配
.github/workflows/           CI 与发布流水线
internal/app/                应用状态、播放控制、设置持久化、自动更新、旧版数据迁移
  audio/                     解码（WAV/MP3/FLAC/OGG）、播放引擎、FFT 分析、10 段均衡器
  ui/                        原生 UI 布局与 6 种可视化绘制
```

## 关于格式支持

AAC / M4A / Opus 暂不支持。目前没有可用的纯 Go 解码器——成熟的实现（如 fdk-aac）
都是 C 库，Go 绑定需要 cgo，而本项目遵循 mygo 的纯 Go 约定。这些格式在界面中会
明确标注为「暂不支持」，不会静默失败。

## 许可

AGPL-3.0-or-later
