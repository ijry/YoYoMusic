# 悠悠乐听布局级皮肤系统设计

**日期:** 2026-07-05
**项目:** 悠悠乐听音乐播放器
**主题:** 参考千千静听内置多套不同风格皮肤，升级为真正改变 UI 结构的布局级皮肤系统

## 1. 背景

当前应用已经有皮肤管理入口和基础主题 token，但实际能力偏“颜色变量切换”：

- `settings.defaultSkin` 只记录当前皮肤 id。
- `SkinManager` 只展示皮肤列表、预览状态和应用按钮。
- `theme.css` 只定义颜色、圆角、阴影等 CSS 变量。
- 主窗口 DOM 只有一套固定工作台布局。

用户明确要求：皮肤不能只是颜色变化，而应该像千千静听时代的桌面播放器一样，切换后整个 UI 布局、面板比例、控制条位置和视觉结构都不同。

## 2. 目标

本轮目标：

- 内置 5 套布局级皮肤。
- `经典蓝银分体机` 作为默认主打皮肤。
- 每套皮肤拥有不同主窗口骨架，而不是共享同一个 `.workspace` 再换色。
- 播放列表、播放控制、当前播放、可视化、歌词/功能面板等业务能力继续复用。
- 保持固定桌面播放器工作台体验，禁止回到整窗滚动。
- 保留现有导入皮肤包能力，但本轮不让第三方皮肤包控制布局。

## 3. 非目标

本轮不做：

- 不复制千千静听、Winamp 或其他软件的旧素材、图标、贴图。
- 不实现第三方布局 DSL。
- 不允许导入皮肤包执行脚本或注入任意 JSX/CSS。
- 不重写 Rust 播放逻辑、Tauri 命令或自动连播事件模型。
- 不改变迷你播放器和桌面歌词窗口。
- 不引入新的 UI 库、图标库、字体下载依赖。
- 不做像素级老软件复刻。

## 4. 设计方向

采用 **内置 React Layout 组件 + 共享播放器上下文**。

每套内置皮肤对应一个主窗口 Layout 组件：

- `ClassicBlueSilverLayout`
- `DarkVinylLayout`
- `TransparentCrystalLayout`
- `MetalRackLayout`
- `WarmWoodLayout`

这些组件只负责主窗口结构和视觉组织。播放状态、播放命令、播放列表、歌词、可视化数据、设置更新等仍由 `App.tsx` 或抽出的共享上下文统一提供。

选择这个方案的原因：

- 能做到真正改变 UI 结构。
- 比纯 CSS 变体更可靠，不受单一 DOM 顺序限制。
- 比第三方布局 DSL 更可控，能快速交付内置皮肤。
- 测试边界清晰：每个 layout 可以独立断言关键 landmark 和控件可访问。

## 5. 内置 5 套皮肤

### 5.1 经典蓝银分体机

默认主打皮肤。

布局特征：

- 顶部是蓝银金属主控舱，包含应用名、播放状态、主导航和皮肤入口。
- 左侧是抽屉式播放列表，像老式播放器的可展开列表窗口。
- 中央是当前播放区，封面唱片和曲目信息占主位。
- 右侧是歌词/标签/均衡器/皮肤/设置功能面板。
- 底部是机械式控制条，始终固定可见。

视觉关键词：

- 蓝银金属、细边框、高光条、硬件按钮、老式桌面播放器。

### 5.2 暗夜黑胶舱

布局特征：

- 黑胶唱片/封面区域占据中心最大面积。
- 播放控制围绕唱片视觉组织，形成沉浸播放舱。
- 播放列表和歌词压缩到右侧窄栏。
- 可视化以唱片外圈或底部频谱条形式呈现。

视觉关键词：

- 黑胶、暗色舞台、圆形中心构图、沉浸感。

### 5.3 透明水晶浮窗

布局特征：

- 主窗口由多个玻璃浮层叠在同一画布上。
- 播放列表像半透明抽屉，可视觉上贴在左侧或底部。
- 功能标签变成悬浮胶囊，不再固定成传统右栏。
- 当前播放和可视化通过透明层叠形成空间感。

视觉关键词：

- 透明玻璃、浅蓝水晶、高亮边缘、悬浮面板。

### 5.4 金属机架均衡器

布局特征：

- 频谱和均衡器成为主视觉。
- 播放状态像机架设备显示屏。
- 播放列表退到底部或侧下方 LED 信息窗。
- 控制条像硬件旋钮/按钮区。

视觉关键词：

- 金属机架、VU 表、LED 指示、发烧设备。

### 5.5 暖木复古唱机

布局特征：

- 主窗口像木质唱机台面。
- 封面像唱片套，放在左侧或中心偏左。
- 播放列表像专辑内页说明，放在右侧。
- 控制区像复古收音机/唱机按钮。

视觉关键词：

- 暖木、复古唱机、唱片套、柔和灯光。

## 6. 架构

### 6.1 Skin Layout Registry

新增一个内置皮肤注册表，记录每套皮肤的元信息和 Layout 组件：

- `id`
- `name`
- `author`
- `version`
- `description`
- `tone`
- `layout`

`settings.defaultSkin` 决定当前 Layout。未知 id 回退到 `classic-blue-silver`。

### 6.2 Shared Layout Props

新增统一 `PlayerLayoutProps`，让每套 Layout 复用同一数据和命令：

- `playlist`
- `playback`
- `currentTrack`
- `lyricsDocument`
- `settings`
- `skins`
- `activePanel`
- `skinError`
- `settingsErrorCode`
- `visualizationFrame`
- `onActivePanelChange`
- `onPlayerCommand`
- `onAddFiles`
- `onAddFolder`
- `onClearPlaylist`
- `onSaveTags`
- `onApplySkin`
- `onImportSkin`
- `onShortcutChange`
- `onVisualizationModeChange`
- `onSettingsChange`

Layout 组件不能直接调用 Tauri 命令，只能通过 props 调用已有回调。

### 6.3 Shared Feature Renderers

保留并抽出共享渲染能力：

- `PlaylistPanel`
- `PlayerControls`
- `LyricsPanel`
- `VisualizationPanel`
- `TagEditor`
- `EqualizerPanel`
- `SkinManager`
- `SettingsPanel`

不同 Layout 可以选择放置这些组件的位置，也可以用更小的 wrapper 改变视觉容器，但不复制业务逻辑。

### 6.4 SkinManager 升级

`SkinManager` 需要从普通列表升级为皮肤选择器：

- 展示 5 套内置皮肤。
- 每张卡片展示布局缩略图、风格说明、当前状态。
- 支持预览状态，但预览不改变实际应用设置。
- 应用后更新 `settings.defaultSkin`。
- 保留导入皮肤包按钮和错误提示。

本轮导入皮肤包仍按现有格式处理主题 token，不支持第三方布局组件。

## 7. 数据流

1. `App.tsx` 读取或初始化 `settings.defaultSkin`。
2. `App.tsx` 根据皮肤注册表选择当前 Layout。
3. `App.tsx` 组装 `PlayerLayoutProps`。
4. 当前 Layout 渲染自己的主窗口结构。
5. 用户在 `SkinManager` 点击应用皮肤。
6. 非 Tauri 环境直接更新 `settings.defaultSkin`。
7. Tauri 环境先调用 `apply_skin`，成功后更新 `settings.defaultSkin`。
8. React 重新选择 Layout 并渲染新结构。

错误处理：

- 未知皮肤 id：回退到默认皮肤，不崩溃。
- 应用皮肤失败：保留当前 Layout，显示 `skinError`。
- 导入皮肤失败：保留当前 Layout，显示当前错误提示。

## 8. CSS 策略

CSS 分层：

- `theme.css`：全局默认 token 和皮肤 token。
- `app.css`：通用基础样式、焦点、按钮、输入、迷你播放器、桌面歌词。
- 新增或拆分 `skin-layouts.css`：五套主窗口布局类。

每套 Layout 应使用独立根类：

- `.skin-layout--classic-blue-silver`
- `.skin-layout--dark-vinyl`
- `.skin-layout--transparent-crystal`
- `.skin-layout--metal-rack`
- `.skin-layout--warm-wood`

每套 Layout 可以定义自己的 grid/flex 结构，但必须遵守：

- 根窗口固定高度。
- 正常桌面尺寸不触发 `body` 滚动。
- 播放列表长内容内部滚动。
- 功能面板长内容内部滚动或拥有明确内部可滚动区。
- 播放控制始终可访问。

## 9. 可访问性

所有 Layout 必须保留主要 landmark：

- 应用标题 `悠悠乐听`
- 当前播放列表区域
- 当前播放区域
- 功能面板区域
- 播放控制区域

交互要求：

- 所有按钮可键盘访问。
- `:focus-visible` 明显可见。
- 皮肤切换不丢失基础控件可访问性。
- 动画遵守 `prefers-reduced-motion`。
- 不只靠颜色表达当前皮肤，必须有文本状态。

## 10. 测试策略

自动化测试：

- 皮肤注册表包含 5 套内置布局皮肤。
- `classic-blue-silver` 是默认回退皮肤。
- `SkinManager` 能显示 5 套内置皮肤并触发应用。
- 每套 Layout 都渲染关键 landmark。
- 每套 Layout 都包含可访问的播放按钮、播放进度、音量控制。
- 现有自动连播 UI 测试继续通过。
- CSS contract 测试继续证明主窗口不回到 `body` 滚动。

人工验收：

- 切换 5 套皮肤，主窗口结构能明显变化。
- 经典蓝银默认呈现最像老式桌面播放器。
- 播放列表过长时不会滚动整个窗口。
- 功能面板过长时不会滚动整个窗口。
- 切换皮肤后播放状态和当前曲目不丢失。

## 11. 影响文件

预计涉及：

- `src/App.tsx`
  - 抽出或组装 `PlayerLayoutProps`。
  - 根据当前皮肤选择 Layout。
- `src/features/skin/SkinManager.tsx`
  - 升级皮肤卡片、说明和缩略图。
- `src/features/skin/SkinManager.test.tsx`
  - 增加 5 套内置皮肤和应用测试。
- `src/features/skin/layouts.tsx`
  - 新增皮肤注册表和 5 套 Layout 组件。
- `src/features/skin/layouts.test.tsx`
  - 验证 Layout 注册、默认回退和 landmark。
- `src/styles/app.css`
  - 保留通用基础样式，减少对单一 `.workspace` 的假设。
- `src/styles/skin-layouts.css`
  - 新增五套布局级皮肤样式。
- `src/styles/app-layout.test.ts`
  - 扩展或新增布局滚动契约测试。

## 12. 风险与约束

主要风险：

- 5 套布局一次完成，CSS 复杂度会明显增加。
- `App.tsx` 当前已承担较多状态和渲染职责，需避免继续膨胀。
- 如果共享 props 设计不清晰，Layout 组件容易复制业务逻辑。
- 现有皮肤包服务只支持主题包，不支持布局包，需在 UI 文案中避免误导。

约束：

- 不新增依赖。
- 不改变 Tauri/Rust 命令。
- 不改变播放、列表、自动连播数据模型。
- 不提交视觉伴侣 `.superpowers/` 本地文件。

## 13. 验收标准

完成后应满足：

- 内置 5 套布局级皮肤。
- `经典蓝银分体机` 是默认主打皮肤。
- 5 套皮肤切换后布局结构明显不同，不只是颜色变化。
- 所有皮肤下播放列表、播放控制、功能面板和当前播放信息仍可用。
- 应用皮肤失败时不会破坏当前布局。
- `npm test` 通过。
- `npm run build` 通过。
