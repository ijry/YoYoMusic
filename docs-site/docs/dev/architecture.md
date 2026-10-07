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

### 压在皮肤色上的文字必须用 `--skin-ink`

四套皮肤的强调色都偏亮（`#22d3ee` / `#ffc857` / `#14e0a8`），
**白字压上去对比度最低只有 1.54 : 1**，几乎看不清。`--skin-ink` 是每套皮肤各自调过的深墨色
（`#07070f` / `#0a0616` / `#150a06` / `#04100e`），对各自的两个强调色都 ≥ 4.5 : 1（WCAG AA），
最差 4.60。

所以任何「用皮肤渐变作背景、且自己带文字」的规则，`color` 一律用 `var(--skin-ink)`：

```css
.track-flag--current {
  color: var(--skin-ink);                                   /* 不是 #fff */
  background: linear-gradient(135deg, var(--skin-primary), var(--skin-accent));
}
```

注意 **`--color-text`（`#f5f6fc`）同样不合格**——它接近白色，失败方式一模一样，
最初的修复就漏掉了顶栏、右侧图标栏、静音按钮与桌面歌词开关的选中态。
`src/styles/skin-contrast.test.ts` 会扫描 `app.css` 拦住这两类写法。

**半透明淡染不受此约束**：`color-mix(... var(--skin-primary) 18%, transparent)`
是压在深色面板上的浅色薄雾，底色仍然是深的，那里就该用浅色文字。
测试按背景里有没有 `color-mix` / `transparent` 区分这两种情况。

## 可视化引擎

后端在 Rust 侧解码，webview 拿不到 PCM 数据，也没有 `AnalyserNode`。因此可视化使用一套模拟信号引擎：

- `signal.ts` 里的 `SignalEngine` 合成频谱、波形与节拍包络。每帧推进：频段做平滑游走（快起慢落），周期性 kick 提升低频，暂停时收敛到低幅度呼吸线。以曲目 id 播种，保证同一首歌形态稳定。
- `drawModes.ts` 集中全部绘制逻辑，`drawModeMap` 是模式注册表。
- `AudioVisualizer.tsx` 自己跑 `requestAnimationFrame` 循环，负责画布尺寸（含 devicePixelRatio）、`ResizeObserver`、`prefers-reduced-motion` 降级，并从 CSS 变量读取调色板。

::: warning 不要把可视化接到播放状态轮询上
主窗口的播放状态每 500ms 轮询一次，这个频率远不足以驱动动画。可视化的动画必须由自己的 RAF 循环驱动，只把「是否在播放」和「曲目 id」当作输入。
:::

新增一种可视化模式需要同时改四处：`shared/types.ts` 的 `VisualizationMode`、`modes.ts` 的模式目录、`drawModes.ts` 的绘制函数与注册表。Rust 侧的 `visualization_mode` 是无校验字符串，不需要改动后端。

### 信号：真实频谱 + 合成回退

解码与播放都在 Rust（rodio），webview 拿不到采样、也没有 `AnalyserNode`。
所以由 Rust 侧主动把采样送过来，**FFT 放在前端算**：

```
rodio Decoder
  └─ TappedSource（Source 装饰器，转发每个采样，顺路写一份单声道降混）
       └─ SampleTap（环形缓冲，最近 1024 个单声道采样）
            └─ spectrum 线程（~30fps，取窗口 → 发 spectrum_frame 事件）
                 └─ liveSpectrum.ts（订阅、分析、存到模块级变量）
                      └─ SignalEngine.update(dt, playing, realFrame)
```

**为什么 FFT 在前端**：这台机器编不了 Rust crate，写在 Rust 里的变换一行都测不到；
放在 `fft.ts` / `spectrum.ts` 就能用已知信号严格验证（纯正弦必须落在对应频点）。
Rust 只做「转发采样」，改动小、风险低。

关键细节：

- **频段按 Hz 划分，不按 bin**（`logBandEdges` 收 `binHz`）。bin 依赖窗口长度，
  按 bin 划分会让换设备后同一个音高跳到别的频段。
- **频段边界只保证非递减**。短窗口分辨不了低频（1024 点 @44.1kHz 一个 bin 就是 43 Hz），
  前二十几个频段会共用同一个 bin。若强行把它们撑开，就会**偷走高频的 bin**，
  把 440 Hz 挤到 9/56 而不是 22/56，整个显示压到左侧三分之一。让它们共享 bin 才是对的。
- 无数据时回退到 `SignalEngine` 的合成信号（暂停、未载入、浏览器预览）。
  `readLiveSpectrum()` 超过 250ms 没收到新帧就返回 `null`，界面因此会回到呼吸态而不是冻在最后一帧。
- `SampleTap` 会丢弃非有限值（NaN/Inf）——一个 NaN 会让整帧 FFT 全变 NaN，整个可视化直接空白。
- `AppState.spectrum` 与 `PlaybackService` 共享同一个 `Arc<SampleTap>`，
  emitter 线程跨曲目持续读取同一个环。

### 合成回退（`signal.ts`）

`SignalEngine` 仍保留合成路径：粉噪式倾斜 + 每频段正弦游走 + 周期 kick 包络，
BPM 92–138 随机，以 trackId 播种。它现在只在**没有真实数据时**生效。

### 生成动画是一组会轮换的场景

`generative.ts` 里不是一段绘制函数，而是五套场景 + 交叉淡入：

- 场景各自 `(ctx) => void`，接收 `alpha`（当前可见度），**所有 `globalAlpha` 都要乘它**。
- 每个场景持续 16–27 秒（进入时随机），淡入淡出 1.4 秒。
- 两套场景都是**加色混合画在透明画布上**，所以「一个淡出一个淡入」本身就是真正的交叉淡入，
  不需要离屏画布——那样每帧要多一张全尺寸 canvas。
- 切换时**不会选到当前场景**，否则会闪一下。
- 当前场景写在 `canvas.dataset.vizScene` 上，方便从外部观察（20 秒才换一次，否则无从判断）。

::: warning 细线场景的密度要用真实画布量
流场最初只有 340 个粒子，在 1560×1046 的 backing store 上**几乎是一片空白**
（实测 alpha 质量 0.31，其他场景在 3–19），但「至少画了东西」的单测完全测不出来。
细线需要的数量远多于填充图形。

判断标准：在浏览器里对画布 `getImageData` 求 **alpha 均值**，
比「alpha 大于阈值的像素占比」更接近观感——光晕核心亮、外围 alpha 衰减很快，
按阈值计数会严重低估。最终五个场景落在 3–22 之间。
:::

### 可视化最大化

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

## 自动更新

前端用 `@tauri-apps/plugin-updater` 的 `check()` / `downloadAndInstall()`，
每 30 分钟一次；Rust 侧只注册插件，端点与公钥写在 `tauri.conf.json` 的 `plugins.updater`。

代码分三层，**所有插件调用都集中在 `updater.ts`**：

| 文件 | 职责 |
| --- | --- |
| `updater.ts` | 唯一接触插件的地方；`isTauriRuntime()` 短路，浏览器预览下不碰插件 |
| `useUpdateChecker.ts` | 轮询、状态机（idle / checking / up-to-date / available / downloading / ready / error） |
| `UpdatePrompt.tsx` | 对话框 + 设置面板里的一行状态 |

几个刻意的决定：

- **待安装的更新句柄放在模块变量里，不放 React state。** 它持有已下载的字节，
  重建就等于把下载丢掉。
- **自动检查失败保持沉默，手动检查才报错。** 自动那次用户没要求，网络抖一下不该弹错误条。
- **「稍后」会一直记住**（`dismissed` ref），同一个版本不再弹；手动检查会清掉这个标记。
- **下载中不能关闭**对话框，否则字节已提交却无从继续。
- 对话框 **portal 到 `body` 且 `position: fixed`**：每个 `.modern-panel` 都有 `overflow: hidden`，
  直接渲染会被裁掉且按钮点不到（和音量浮层同一个坑）。
- 卡片背景用 `--color-surface-strong`（不透明）而不是 `--color-surface`。
  后者本身就是 `rgba(22,23,38,0.66)`，在它上面做 `color-mix` 不改变不透明度，
  弹窗会透出背后的可视化，更新说明看不清。

### 发布侧：签名与 `latest.json`

```
tauri build（带 TAURI_SIGNING_PRIVATE_KEY）
  └─ 每个 bundle 旁生成 .sig
       └─ normalise-asset-names.mjs   改名为 ASCII 资产名
            └─ create-updater-manifest.mjs   生成 latest.json（签名内联）
                 └─ 上传到 Release
```

**`normalise-asset-names` 必须在 `create-updater-manifest` 之前跑**：
manifest 里的 URL 是按磁盘上的名字拼的，先改名才能对上最终资产名。
改名不影响签名——minisign 签的是文件内容，不是文件名。

踩过的坑：

- **`sed 's/^[^A-Za-z0-9]*//'` 会把 `.` 也吃掉**，于是 `悠悠乐听.app.tar.gz` 变成
  `YoYoMusic_app.tar.gz`，`.app` 这个「这是 macOS 更新包」的语义就没了。
  字符类要写成 `[^A-Za-z0-9.]`。这段逻辑现在在 `scripts/normalise-asset-names.mjs` 里，
  **有测试**，不再是一段没测过的 shell。
- **Windows 上 NSIS 与 MSI 都有 `.sig`，但更新包只有 NSIS**（`-setup.exe`）。
  manifest 选错会让 Windows 更新静默失效。选择顺序写在 `PAYLOAD_PREFERENCE`。
- **Linux 的更新包就是 `.AppImage` 本身，不打包成 tar.gz**；只有 macOS 是 `.app.tar.gz`。
- **`.sig` 的内容要内联进 manifest**，不能写成路径或 URL。
- `release.yml` 的 verify 任务会**先检查签名密钥存在**，
  否则要等三个平台都构建完才发现没签上。

两个脚本都在 `scripts/` 下用 `node:test` 测试（`npm run test:scripts`），
`vitest` 通过 `exclude: ["scripts/**"]` 跳过它们——否则 vitest 会去打包 `node:test` 这个内置模块而报错。

## 测试与校验

```bash
npm test                          # 前端单元测试
npm run build                     # 类型检查 + 生产构建
npx oxlint src                    # 静态检查
cargo test --manifest-path src-tauri/Cargo.toml
```

另有若干测试直接读取 `src/styles/*.css` 断言关键布局钩子，用来防止样式重构时无意破坏固定分区。
