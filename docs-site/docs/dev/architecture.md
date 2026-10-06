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
public/
  favicon.svg                唯一的 logo 源文件
src-tauri/
  src/                        Rust 侧命令与播放服务
  icons/                      由 `npx tauri icon` 生成，勿手工编辑
docs-site/                    VitePress 文档站（本页所在站点）
```

## 应用图标

`public/favicon.svg` 是仓库里**唯一**的 logo 源文件，它被三处复用：

| 位置 | 引用方式 |
| --- | --- |
| 浏览器标签页 | `index.html` 的 `<link rel="icon">` |
| 应用内标题栏 | `layoutShared.tsx` 的 `.app-title__logo` |
| 桌面图标 / 安装包 | 由 `npx tauri icon` 从它生成 `src-tauri/icons/**` |

改了 logo 之后重新生成平台图标：

```bash
npx tauri icon public/favicon.svg
```

::: warning public 目录必须在仓库根
Vite 的 `publicDir` 默认是 `<root>/public`，**不是** `src/public`。
放在 `src/public` 里的文件不会被服务 —— 请求会落到 `index.html`，
表现为 logo 位置一片空白（而且控制台不报错，很难发现）。
`src/styles/logo.test.ts` 会守住这个约定。
:::

`npx tauri icon` 会顺带生成 `icons/android/` 与 `icons/ios/`。
本项目只做桌面端，这两 directories 生成后可以直接删掉。

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

### 信号是合成的，不是频谱分析

解码与播放都在 Rust（rodio），**webview 拿不到采样，也没有 `AnalyserNode`**。
`signal.ts` 的 `SignalEngine` 合成一段「像音乐」的信号：粉噪式倾斜 + 每频段正弦游走 +
周期 kick 包络，BPM 92–138 随机，以 trackId 播种。唯一真实输入是 `isPlaying`。

**所以「同一首歌每次形态一致」是设计结果，不是分析结果。**
若将来要做真频谱，得让 Rust 侧算 FFT 并通过事件推给前端，而不是在 `signal.ts` 里改参数。

## 可视化最大化

`visualizerMaximized` 让画布成为整个外壳的底层，其余元素浮在其上。三条约束：

1. **浮层必须是 `position: absolute`**，且挂在 `.chrome` 上。
   它是 `.chrome` 三行栅格（`auto minmax(0,1fr) auto`）的直接子元素，
   若参与布局会多占一行，把播放条挤出去。
2. **不能放在 `.modern-grid` 里**：`.modern-grid` 有 `overflow: hidden`，
   会把整屏浮层裁成中间那一列。
3. **靠 `z-index` 而不是 DOM 顺序压到最底**：浮层渲染在最后（这样它才是栅格的兄弟节点），
   所以必须给它 `z-index: 0`、给顶栏/栅格/播放条 `z-index: 1`。

::: warning 播放条的直接子元素是 `.modern-panel--transport`
`.player-controls` 在它**里面**。选择器写错会让播放条保持 `position: static`，
而静态块级元素的绘制层级**低于**定位元素 —— 画布会盖住播放条。
:::

最大化时中间列的 `.modern-panel--viz` 变成 `is-maximized-placeholder`：
不画背景、不画边框、不模糊，只用来**占住中间列**（列模板因此无需切换），
同时承载模式切换条 —— 切换条留在原处，展开/还原按钮位置不变。


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

## 图标与按钮

### 按钮只有一套度量

顶栏操作、窗口控制、右侧图标栏、迷你窗口按钮**共享同一个基类**（`.title-action-button, .window-button, .feature-tab`）：
相同的圆角语言、相同的悬停底色、相同的「选中」填充（皮肤渐变）。

只有**尺寸**不同，而且是有意的层级：右侧图标栏是主导航，比顶栏大一档（44 vs 36）。
除此之外任何一处单独写尺寸/圆角都会让同一个窗口看起来像几个工具拼起来的 —— 这正是重构前的状态
（36/32/44px 三种方框、12/8/14px 三种圆角、两套悬停）。

**选中态只有一种写法**：`[aria-pressed="true"]` 配皮肤渐变。
新增可切换按钮时别再自己写一套，否则会出现「有的按钮点了有反馈、有的没有」。

### 一个字形只表达一个概念

图标词汇表在 `shared/icons.tsx`，**同一个形状绝不能表示两个意思**，
相邻的两个概念也不能长得像。踩过的坑：

- `Minimize2` 曾同时是「迷你模式」和「还原窗口」，而真正的「最小化」是 `Minimize` ——
  三者挨在一起，前两个几乎分不出来。现在迷你模式用 `RectangleHorizontal`（横向短条，正对迷你窗形状）。
- 歌词面板用 `Type`（字母 T）、桌面歌词浮窗用 `ListMusic`，同一个「歌词」概念两个无关字形。
  现在分别是 `AlignLeft`（文字行）与 `PictureInPicture2`（浮层窗口）。
- `AudioLines` 曾同时是「可视化」和「顺序播放」。现在可视化用 `AudioWaveform`，顺序播放用 `ListOrdered`。

`shared/icons.test.tsx` 会渲染每个图标并比对标记，**任何两个条目共用一个字形都会失败**。

### 一个控件只在一个地方

顶栏只放**窗口级**操作，并按用途分组（应用操作 ｜ 分隔线 ｜ 窗口控制）。
面板里不要再放同一功能的入口：皮肤/设置、以及「打开桌面歌词」都因为重复出现过两次而被移除。
歌词面板保留桌面歌词的**设置**（主题/字号/锁定/穿透），但不再提供打开浮窗的按钮。

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
