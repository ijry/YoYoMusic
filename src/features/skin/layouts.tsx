import {
  AppTitle,
  ControlsBlock,
  FeatureContent,
  FeatureSidebar,
  FeatureTabs,
  HeroVisualization,
  LayoutErrorBanner,
  NowPlayingBlock,
  PlaylistBlock,
  TitleActions,
} from "./layoutShared";
import type { PlayerLayoutProps } from "./layoutTypes";

export function ClassicBlueSilverLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--classic-blue-silver">
      <section className="chrome skin-chrome skin-chrome--classic" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--classic">
          <AppTitle eyebrow="Classic Blue Silver Player" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--classic">
          <PlaylistBlock {...props} />
          <div className="classic-center-deck">
            <NowPlayingBlock {...props} variant="classic" />
            <HeroVisualization {...props} />
          </div>
          <FeatureSidebar {...props} />
        </div>
        <ControlsBlock {...props} />
      </section>
    </main>
  );
}

export function DarkVinylLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--dark-vinyl">
      <section className="chrome skin-chrome skin-chrome--vinyl" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--vinyl">
          <AppTitle eyebrow="Night Vinyl Chamber" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--vinyl">
          <div className="vinyl-stage">
            <NowPlayingBlock {...props} variant="vinyl" />
            <HeroVisualization {...props} />
            <ControlsBlock {...props} />
          </div>
          <div className="vinyl-side-rail">
            <PlaylistBlock {...props} />
            <FeatureSidebar {...props} />
          </div>
        </div>
      </section>
    </main>
  );
}

export function TransparentCrystalLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--transparent-crystal">
      <section className="chrome skin-chrome skin-chrome--crystal" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--crystal">
          <AppTitle eyebrow="Crystal Floating Console" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--crystal">
          <div className="crystal-now-panel">
            <NowPlayingBlock {...props} variant="crystal" />
            <HeroVisualization {...props} />
          </div>
          <div className="crystal-playlist-drawer">
            <PlaylistBlock {...props} />
          </div>
          <aside className="feature-sidebar crystal-feature-float" role="complementary" aria-label="功能面板">
            <FeatureTabs {...props} />
            <FeatureContent {...props} />
          </aside>
        </div>
        <ControlsBlock {...props} />
      </section>
    </main>
  );
}

export function MetalRackLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--metal-rack">
      <section className="chrome skin-chrome skin-chrome--rack" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--rack">
          <AppTitle eyebrow="Metal Rack Equalizer" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--rack">
          <div className="rack-meter-bridge">
            <HeroVisualization {...props} />
            <FeatureSidebar {...props} />
          </div>
          <div className="rack-lower-console">
            <PlaylistBlock {...props} />
            <NowPlayingBlock {...props} variant="rack" />
          </div>
        </div>
        <ControlsBlock {...props} />
      </section>
    </main>
  );
}

export function WarmWoodLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--warm-wood">
      <section className="chrome skin-chrome skin-chrome--wood" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--wood">
          <AppTitle eyebrow="Warm Wood Turntable" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--wood">
          <div className="wood-album-sleeve">
            <NowPlayingBlock {...props} variant="wood" />
            <HeroVisualization {...props} />
          </div>
          <div className="wood-liner-notes">
            <PlaylistBlock {...props} />
            <FeatureSidebar {...props} />
          </div>
        </div>
        <ControlsBlock {...props} />
      </section>
    </main>
  );
}
