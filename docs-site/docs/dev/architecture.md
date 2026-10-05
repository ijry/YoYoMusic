# 架构总览

## 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面壳 | Tauri 2 |
| 前端 | React 19 + TypeScript + Vite 8 |
| 音频核心 | Rust（[rodio](https://github.com/RustAudio/rodio) 播放，[lofty](https://github.com/Serial-ATA/lofty-rs) 读标签） |
| 测试 | Vitest + jsdom + Testing Library（前端），`cargo test`（Rust） |
| 图标 | lucide-react |

前端只负责界面与交互，所有文件访问、解码、播放和标签读写都在 Rust 侧完成，通过 Tauri command 通信。

## 目录结构

```
src/
  App.tsx                     主窗口：状态、事件订阅、命令分发
  shared/                     跨 feature 复用的类型、图标、封面、工具
  features/
    player/                   播放状态机与底部播放条
    playlist/                 播放列表
    visualization/            可视化引擎（信号 + 绘制 + 画布组件）
    skin/                     皮肤注册表、布局、面板框架
    lyrics/                   歌词面板、桌面歌词
    equalizer/                均衡器
    tags/                     标签编辑
    settings/                 设置
    mini/                     迷你播放器
    shell/                    错误横幅、自绘窗口边框（拖动区 + 窗口按钮）
  styles/                     theme.css / app.css / skin-layouts.css
src-tauri/
  src/                        Rust 侧命令与播放服务
docs-site/                    VitePress 文档站（本页所在站点）
```

## 皮肤系统

四套内置皮肤**共享同一个 `ModernPlayerLayout`**，差异只靠 CSS 自定义属性：

```
--skin-primary  主色      --skin-accent     强调色
--skin-canvas   画布      --skin-canvas-deep  画布深色端
--skin-ink      墨色      --skin-glow       光晕
--viz-a / --viz-b / --viz-ink                可视化配色
```

这样布局与响应式行为只有一份实现，皮肤层只剩配色，新增皮肤不需要碰任何布局代码。

新增一套皮肤需要三处改动：

1. `src/features/skin/layoutRegistry.tsx` 注册一条定义。
2. `src/styles/skin-layouts.css` 增加 `.skin-layout--<id>` 配色块。
3. 同文件增加 `.skin-thumbnail--<id> span` 缩略图渐变（缩略图必须写死自己的颜色，因为它渲染在**当前**皮肤里）。

## 可视化引擎

后端在 Rust 侧解码，webview 拿不到 PCM 数据，也没有 `AnalyserNode`。因此可视化使用一套模拟信号引擎：

- `signal.ts` 里的 `SignalEngine` 合成频谱、波形与节拍包络。每帧推进：频段做平滑游走（快起慢落），周期性 kick 提升低频，暂停时收敛到低幅度呼吸线。以曲目 id 播种，保证同一首歌形态稳定。
- `drawModes.ts` 集中全部绘制逻辑，`drawModeMap` 是模式注册表。
- `AudioVisualizer.tsx` 自己跑 `requestAnimationFrame` 循环，负责画布尺寸（含 devicePixelRatio）、`ResizeObserver`、`prefers-reduced-motion` 降级，并从 CSS 变量读取调色板。

::: warning 不要把可视化接到播放状态轮询上
主窗口的播放状态每 500ms 轮询一次，这个频率远不足以驱动动画。可视化的动画必须由自己的 RAF 循环驱动，只把「是否在播放」和「曲目 id」当作输入。
:::

新增一种可视化模式需要同时改四处：`shared/types.ts` 的 `VisualizationMode`、`modes.ts` 的模式目录、`drawModes.ts` 的绘制函数与注册表。Rust 侧的 `visualization_mode` 是无校验字符串，不需要改动后端。

## 布局约束

界面外壳是 `grid-template-rows: auto minmax(0, 1fr) auto`（顶栏 / 主区 / 播放条）。

有两条容易踩的规则：

1. **条件渲染的元素不要独占 grid 行或列。** 它返回 `null` 时后面的元素会整体前移。主区的列模板随 `data-library` / `data-inspector` 属性成组切换，正是为了让「隐藏左栏」与「少一列」同步发生。错误横幅则改为绝对定位浮层。
2. **网格里的列表行必须渲染相同数量的子元素**，否则某一行的元素会换行。需要条件显示时用「始终渲染 + 切换 class」。

## 窗口边框

三个窗口（主窗口 / 迷你 / 桌面歌词）全部 `decorations: false`，
**自绘 chrome 组件在 `features/shell/WindowChrome.tsx`**：

- `DragRegion` —— 拖动区。内部按钮通过 `closest("button, input, select, a")` 排除，
  所以按钮可以留在拖动区里而仍然可点；`disabled` 时不启动拖动（桌面歌词的锁定用）。
- `WindowButtons` —— 最小化 / 最大化 / 关闭，迷你窗口只保留关闭。

窗口操作统一走 `shared/windowControl.ts`，内部用 `isTauriWindowRuntime()` 短路，
这样组件在 jsdom（没有 Tauri 运行时）里也能渲染与测试。

::: warning 透明窗口要看四层背景
桌面歌词的 `transparent: true)` 只作用于 webview 层。
`body` 上的背景色仍会让整个窗口变成一块不透明矩形，
所以路由要给 `document.body.dataset.window` 打标记，CSS 据此把
`body` 与 `#root` 一起覆盖为 `transparent`。
改这块样式时，务必用 `getComputedStyle` 确认
**html / body / #root / 外壳**四层都是透明。
:::

## 设置的读写

`AppSettings` 新增字段时，Rust 侧的 `#[serde(...)]` **必须带 `default`**，
否则旧的 `settings.json` 缺字段会直接反序列化失败。

桌面歌词的偏好由 `shared/useDesktopLyricsSettings.ts` 持有，
分两层：UI 状态**自带默认值**（保证加载前点击就生效），
整份 settings 文档只放 `useRef` 里当写入目标，
**加载完成前不落盘**（否则会用默认值覆盖用户真实设置）。
歌词面板与桌面歌词浮窗写的是同一份数据，通过持久化文件同步，不做跨窗口消息。

## 测试与校验

```bash
npm test                          # 前端单元测试
npm run build                     # 类型检查 + 生产构建
npx oxlint src                    # 静态检查
cargo test --manifest-path src-tauri/Cargo.toml
```

另有若干测试直接读取 `src/styles/*.css` 断言关键布局钩子，用来防止样式重构时无意破坏固定分区。
