import "./styles/theme.css";
import "./styles/app.css";

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">YoYoMusic Desktop Player</p>
        <h1 id="app-title">悠悠乐听</h1>
        <p className="subtitle">跨平台新一代音乐播放器</p>
      </section>
    </main>
  );
}
