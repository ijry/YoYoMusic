import {
  AppTitle,
  ControlsBlock,
  FeatureSidebar,
  HeroVisualization,
  LayoutErrorBanner,
  PlaylistBlock,
  TitleActions,
} from "./layoutShared";
import { DragRegion } from "../shell/WindowChrome";
import type { PlayerLayoutProps } from "./layoutTypes";

/*
 * One modern shell, four palettes.
 *
 * The old build shipped five completely different "hardware" layouts, which
 * meant five sets of framing rules and five ways for content to overflow. The
 * modern player keeps a single, well-tested grid — library / stage / inspector
 * over a full-width transport — and varies the skin through colour tokens
 * only. That is how current music players ship themes, and it keeps the
 * responsive behaviour identical across skins.
 */
const skinSubtitles: Record<string, string> = {
  "aurora-glass": "极光玻璃",
  "midnight-neon": "午夜霓虹",
  "sunset-blaze": "落日熔金",
  "mint-studio": "薄荷录音室",
};

function ModernPlayerLayout({ skinId, ...props }: PlayerLayoutProps & { skinId: string }) {
  const inspectorOpen = props.activePanel !== null;

  return (
    <main className={`app-shell skin-layout skin-layout--${skinId}`}>
      <section className="chrome modern-frame" aria-labelledby="app-title">
        <div className="modern-aurora" aria-hidden="true">
          <span className="modern-aurora__blob modern-aurora__blob--one" />
          <span className="modern-aurora__blob modern-aurora__blob--two" />
          <span className="modern-aurora__blob modern-aurora__blob--three" />
        </div>

        {/* The OS title bar is off, so the top bar doubles as the drag handle. */}
        <DragRegion className="modern-topbar">
          <AppTitle model={skinSubtitles[skinId] ?? "现代玻璃拟态"} />
          <TitleActions {...props} />
        </DragRegion>

        <LayoutErrorBanner error={props.error} />

        {/*
         * The library column is dropped from the DOM when hidden, so the
         * column template below switches in lockstep with it — otherwise the
         * remaining panels would shift one column to the left.
         */}
        <div
          className="modern-grid"
          data-library={props.libraryOpen ? "open" : "closed"}
          data-inspector={inspectorOpen ? "open" : "closed"}
        >
          {props.libraryOpen ? <PlaylistBlock {...props} /> : null}
          <HeroVisualization {...props} />
          <FeatureSidebar {...props} />
        </div>

        <ControlsBlock {...props} />
      </section>
    </main>
  );
}

export function AuroraGlassLayout(props: PlayerLayoutProps) {
  return <ModernPlayerLayout skinId="aurora-glass" {...props} />;
}

export function MidnightNeonLayout(props: PlayerLayoutProps) {
  return <ModernPlayerLayout skinId="midnight-neon" {...props} />;
}

export function SunsetBlazeLayout(props: PlayerLayoutProps) {
  return <ModernPlayerLayout skinId="sunset-blaze" {...props} />;
}

export function MintStudioLayout(props: PlayerLayoutProps) {
  return <ModernPlayerLayout skinId="mint-studio" {...props} />;
}
