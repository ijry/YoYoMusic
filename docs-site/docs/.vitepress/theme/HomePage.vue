<script setup lang="ts">
import { withBase } from "vitepress";

const REPO = "https://github.com/ijry/YoYoMusic";
const RELEASES = `${REPO}/releases/latest`;
const ISSUES = `${REPO}/issues`;

const stats = [
  { value: "8", label: "种实时可视化" },
  { value: "4", label: "套玻璃拟态皮肤" },
  { value: "10", label: "段均衡器" },
  { value: "3", label: "个桌面平台" },
];

const features = [
  {
    icon: "wave",
    title: "八种音频可视化",
    body: "频谱柱、示波波形、环形律动、音浪绸带、粒子星尘、镜像瀑布，外加实时生成的「生成动画」与「万花筒」。Canvas 逐帧绘制，频谱来自真实音频分析。",
  },
  {
    icon: "palette",
    title: "四套玻璃拟态皮肤",
    body: "极光玻璃、午夜霓虹、落日熔金、薄荷录音室。同一套布局，配色整体切换。",
  },
  {
    icon: "slider",
    title: "十段均衡器",
    body: "内置平直、摇滚、流行、人声四组预设，也可逐段手动微调。",
  },
  {
    icon: "text",
    title: "歌词与桌面歌词",
    body: "主窗口滚动歌词，另有一个可穿透点击的桌面歌词浮窗。",
  },
  {
    icon: "list",
    title: "本地曲库",
    body: "文件或文件夹导入、标签读写、封面引用、播放模式与自动连播。",
  },
  {
    icon: "lock",
    title: "本地优先，无广告",
    body: "所有解析与播放都在本机完成，不联网、不上传，也不需要登录账号。",
  },
];

const modes = [
  { id: "spectrum", name: "频谱柱", note: "镜像频谱与峰值保持" },
  { id: "waveform", name: "示波波形", note: "发光示波曲线" },
  { id: "radial", name: "环形律动", note: "环形放射律动" },
  { id: "aurora", name: "音浪绸带", note: "流动音浪绸带" },
  { id: "particles", name: "粒子星尘", note: "节拍粒子星尘" },
  { id: "waterfall", name: "镜像瀑布", note: "滚动频谱瀑布" },
  { id: "generative", name: "生成动画", note: "每次都不一样的星轨网络" },
  { id: "kaleidoscope", name: "万花筒", note: "镜像花瓣" },
];

const skins = [
  { id: "aurora-glass", name: "极光玻璃", colors: ["#a78bfa", "#22d3ee"] },
  { id: "midnight-neon", name: "午夜霓虹", colors: ["#ff5fb0", "#8b6cff"] },
  { id: "sunset-blaze", name: "落日熔金", colors: ["#ff9457", "#ffd166"] },
  { id: "mint-studio", name: "薄荷录音室", colors: ["#34e5b5", "#4fb4ff"] },
];
</script>

<template>
  <div class="ys-home">
    <!-- Hero screenshot ------------------------------------------------- -->
    <section class="ys-hero-shot">
      <div class="ys-hero-shot__glow" aria-hidden="true"></div>
      <figure class="ys-glass ys-hero-shot__frame">
        <img :src="withBase('/screenshot-hero.webp')" alt="悠悠乐听主界面：左侧播放列表、中间频谱可视化、底部播放控制条" loading="eager" />
      </figure>
    </section>

    <!-- Stats ------------------------------------------------------------ -->
    <section class="ys-stats">
      <div v-for="item in stats" :key="item.label" class="ys-stat">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
    </section>

    <!-- Features --------------------------------------------------------- -->
    <section class="ys-section">
      <header class="ys-section__head">
        <h2>一个够看的本地播放器</h2>
        <p>不做在线曲库，不做社交，不做广告。只把「把本地音乐放好」这件事做扎实。</p>
      </header>

      <div class="ys-grid">
        <article v-for="feature in features" :key="feature.title" class="ys-glass ys-card">
          <span class="ys-card__icon" :data-icon="feature.icon" aria-hidden="true"></span>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.body }}</p>
        </article>
      </div>
    </section>

    <!-- Visualiser ------------------------------------------------------- -->
    <section class="ys-section">
      <header class="ys-section__head">
        <h2>八种可视化，一键切换</h2>
        <p>舞台右上角的图标栏可以直接换，右侧面板里也有完整列表。每个可视化都由曲目 id 生成专属信号，同一首歌每次都是一样的舞步。</p>
      </header>

      <div class="ys-modes">
        <figure v-for="mode in modes" :key="mode.id" class="ys-glass ys-mode">
          <img :src="withBase(`/modes/${mode.id}.webp`)" :alt="`${mode.name}可视化`" loading="lazy" />
          <figcaption>
            <strong>{{ mode.name }}</strong>
            <span>{{ mode.note }}</span>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- Skins ------------------------------------------------------------ -->
    <section class="ys-section">
      <header class="ys-section__head">
        <h2>四套皮肤，换一种心情</h2>
        <p>四套皮肤共用同一套现代布局，只切换配色 token，所以切换不会打乱你的使用习惯。</p>
      </header>

      <div class="ys-skins">
        <article v-for="skin in skins" :key="skin.id" class="ys-glass ys-skin">
          <span
            class="ys-skin__swatch"
            :style="{ background: `linear-gradient(140deg, ${skin.colors[0]}, ${skin.colors[1]})` }"
            aria-hidden="true"
          ></span>
          <strong>{{ skin.name }}</strong>
        </article>
      </div>
    </section>

    <!-- Closing ---------------------------------------------------------- -->
    <section class="ys-closing">
      <div class="ys-glass ys-closing__card">
        <h2>下载体验</h2>
        <p>
          支持 Windows、macOS 与 Linux。全部代码以
          <strong>AGPL-3.0-or-later</strong> 许可开源，欢迎提 Issue 与 PR。
        </p>
        <div class="ys-closing__actions">
          <a class="ys-btn ys-btn--primary" :href="RELEASES">下载最新版</a>
          <a class="ys-btn" :href="withBase('/guide/quick-start.html')">快速开始</a>
          <a class="ys-btn ys-btn--ghost" :href="ISSUES">问题反馈</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ys-home {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 24px 96px;
}

/* Hero screenshot ------------------------------------------------------- */

.ys-hero-shot {
  position: relative;
  margin: 8px 0 56px;
}

.ys-hero-shot__glow {
  position: absolute;
  inset: 8% 6% -6%;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(34, 211, 238, 0.42));
  filter: blur(72px);
  opacity: 0.7;
  z-index: 0;
}

.ys-hero-shot__frame {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 10px;
  overflow: hidden;
}

.ys-hero-shot__frame img {
  display: block;
  width: 100%;
  border-radius: 12px;
}

/* Stats ----------------------------------------------------------------- */

.ys-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 72px;
}

.ys-stat {
  display: grid;
  gap: 2px;
  justify-items: center;
  padding: 18px 8px;
  border-radius: 16px;
  background: var(--vp-c-bg-soft);
}

.ys-stat strong {
  font-size: 1.8rem;
  font-weight: 700;
  background: linear-gradient(110deg, #c4b5fd, #22d3ee);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.ys-stat span {
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
}

/* Sections -------------------------------------------------------------- */

.ys-section {
  margin-bottom: 80px;
}

.ys-section__head {
  max-width: 640px;
  margin: 0 auto 32px;
  text-align: center;
}

.ys-section__head h2 {
  margin: 0 0 10px;
  border: 0;
  font-size: 1.9rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.ys-section__head p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.95rem;
  line-height: 1.7;
}

/* Feature cards --------------------------------------------------------- */

.ys-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.ys-card {
  padding: 22px 20px;
  transition: transform 220ms ease, border-color 220ms ease;
}

.ys-card:hover {
  transform: translateY(-3px);
  border-color: var(--vp-c-brand-2);
}

.ys-card h3 {
  margin: 14px 0 8px;
  font-size: 1rem;
  font-weight: 600;
}

.ys-card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  line-height: 1.7;
}

.ys-card__icon {
  display: block;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(140deg, #8b5cf6, #22d3ee);
  opacity: 0.9;
}

.ys-card__icon[data-icon="wave"] {
  clip-path: polygon(0 45%, 18% 45%, 18% 10%, 34% 10%, 34% 78%, 50% 78%, 50% 30%, 66% 30%, 66% 92%, 82% 92%, 82% 55%, 100% 55%, 100% 100%, 0 100%);
}

.ys-card__icon[data-icon="palette"],
.ys-card__icon[data-icon="slider"],
.ys-card__icon[data-icon="text"],
.ys-card__icon[data-icon="list"],
.ys-card__icon[data-icon="lock"] {
  border-radius: 50% 12px 50% 12px;
}

/* Visualiser modes ------------------------------------------------------ */

.ys-modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.ys-mode {
  margin: 0;
  overflow: hidden;
  transition: transform 220ms ease, border-color 220ms ease;
}

.ys-mode:hover {
  transform: translateY(-3px);
  border-color: var(--vp-c-brand-2);
}

.ys-mode img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 11;
  object-fit: cover;
  background: #0b0b16;
}

.ys-mode figcaption {
  display: grid;
  gap: 2px;
  padding: 12px 14px 14px;
}

.ys-mode figcaption strong {
  font-size: 0.92rem;
}

.ys-mode figcaption span {
  color: var(--vp-c-text-2);
  font-size: 0.78rem;
}

/* Skins ----------------------------------------------------------------- */

.ys-skins {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.ys-skin {
  display: grid;
  gap: 12px;
  justify-items: center;
  padding: 18px 12px;
}

.ys-skin__swatch {
  width: 100%;
  height: 62px;
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.ys-skin strong {
  font-size: 0.9rem;
}

/* Closing --------------------------------------------------------------- */

.ys-closing__card {
  padding: 40px 32px;
  text-align: center;
}

.ys-closing__card h2 {
  margin: 0 0 12px;
  border: 0;
  font-size: 1.7rem;
}

.ys-closing__card p {
  max-width: 560px;
  margin: 0 auto 24px;
  color: var(--vp-c-text-2);
  line-height: 1.7;
}

.ys-closing__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.ys-btn {
  padding: 10px 22px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.ys-btn:hover {
  border-color: var(--vp-c-brand-2);
  transform: translateY(-1px);
}

.ys-btn--primary {
  border-color: transparent;
  color: #fff;
  background: linear-gradient(120deg, #8b5cf6, #22d3ee);
}

.ys-btn--ghost {
  color: var(--vp-c-text-2);
}

/* Responsive ------------------------------------------------------------ */

@media (max-width: 960px) {
  .ys-grid,
  .ys-modes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ys-skins {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .ys-home {
    padding: 0 16px 72px;
  }

  .ys-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-bottom: 56px;
  }

  .ys-grid,
  .ys-modes {
    grid-template-columns: minmax(0, 1fr);
  }

  .ys-section {
    margin-bottom: 60px;
  }

  .ys-section__head h2 {
    font-size: 1.5rem;
  }
}
</style>
