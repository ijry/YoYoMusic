# 悠悠乐听音乐播放器

悠悠乐听是一款基于 Tauri 2、React、TypeScript 和 Rust Core 的跨平台桌面音乐播放器，目标平台为 Windows、macOS 和 Linux。

## 已实现范围

- 本地播放列表和基础播放状态机。
- 播放、暂停、上一首、下一首、seek、音量、静音和播放模式命令。
- 歌词解析和主窗歌词显示。
- 桌面歌词窗口和迷你播放器窗口。
- 标签编辑、封面缓存 key 和元数据 fallback。
- 三种可视化模式：频谱柱、波形、环形脉冲。
- 10 段均衡器控制。
- 自定义皮肤包校验、主题 token 应用和皮肤格式文档。
- 系统托盘、全局快捷键冲突检测和窗口状态插件。
- GitHub Actions 手动三端安装包构建计划。

## 开发

```powershell
npm install
npm run tauri dev
```

## 测试

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## 构建安装包

```powershell
npm run tauri build
```

更多说明见 [docs/building.md](docs/building.md)。
