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
      <section className="chrome skin-chrome skin-chrome--classic device-shell device-shell--classic" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--classic device-shell__header">
          <AppTitle eyebrow="Classic Blue Silver Player" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--classic">
          <PlaylistBlock
            {...props}
            moduleLabel="曲目仓"
            eyebrow="Drawer Playlist"
            moduleClassName="device-module--classic-playlist"
          />
          <div className="classic-center-deck">
            <NowPlayingBlock
              {...props}
              variant="classic"
              moduleLabel="状态窗"
              eyebrow="Blue Backlit Display"
              moduleClassName="device-module--classic-status"
            />
            <HeroVisualization
              {...props}
              moduleLabel="主控舱"
              eyebrow="Spectrum Bridge"
              moduleClassName="device-module--classic-visualization"
            />
          </div>
          <FeatureSidebar
            {...props}
            moduleLabel="功能仓"
            eyebrow="Expansion Bay"
            moduleClassName="device-module--classic-feature"
          />
        </div>
        <ControlsBlock
          {...props}
          moduleLabel="控制台"
          eyebrow="Mechanical Transport"
          moduleClassName="device-module--classic-controls"
        />
      </section>
    </main>
  );
}

export function DarkVinylLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--dark-vinyl">
      <section className="chrome skin-chrome skin-chrome--vinyl device-shell device-shell--vinyl" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--vinyl device-shell__header">
          <AppTitle eyebrow="Night Vinyl Chamber" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--vinyl">
          <div className="vinyl-stage">
            <NowPlayingBlock
              {...props}
              variant="vinyl"
              moduleLabel="唱盘舱"
              eyebrow="Center Turntable"
              moduleClassName="device-module--vinyl-stage"
            />
            <HeroVisualization
              {...props}
              moduleLabel="舞台频谱"
              eyebrow="Stage Spectrum"
              moduleClassName="device-module--vinyl-visualization"
            />
            <ControlsBlock
              {...props}
              moduleLabel="控制台"
              eyebrow="Arc Transport"
              moduleClassName="device-module--vinyl-controls"
            />
          </div>
          <div className="vinyl-side-rail">
            <PlaylistBlock
              {...props}
              moduleLabel="曲目塔"
              eyebrow="Track Tower"
              moduleClassName="device-module--vinyl-playlist"
            />
            <FeatureSidebar
              {...props}
              moduleLabel="控制塔"
              eyebrow="Side Control Tower"
              moduleClassName="device-module--vinyl-feature"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

export function TransparentCrystalLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--transparent-crystal">
      <section className="chrome skin-chrome skin-chrome--crystal device-shell device-shell--crystal" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--crystal device-shell__header">
          <AppTitle eyebrow="Crystal Floating Console" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--crystal">
          <div className="crystal-now-panel">
            <NowPlayingBlock
              {...props}
              variant="crystal"
              moduleLabel="透明舱"
              eyebrow="HUD Display"
              moduleClassName="device-module--crystal-status"
            />
            <HeroVisualization
              {...props}
              moduleLabel="悬浮仓"
              eyebrow="Glass Spectrum"
              moduleClassName="device-module--crystal-visualization"
            />
          </div>
          <div className="crystal-playlist-drawer">
            <PlaylistBlock
              {...props}
              moduleLabel="资料匣"
              eyebrow="Slide Drawer"
              moduleClassName="device-module--crystal-playlist"
            />
          </div>
          <FeatureSidebar
            {...props}
            moduleLabel="功能胶囊"
            eyebrow="Floating Capsules"
            moduleClassName="device-module--crystal-feature crystal-feature-float"
          />
        </div>
        <ControlsBlock
          {...props}
          moduleLabel="底座控制台"
          eyebrow="Floating Base"
          moduleClassName="device-module--crystal-controls"
        />
      </section>
    </main>
  );
}

export function MetalRackLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--metal-rack">
      <section className="chrome skin-chrome skin-chrome--rack device-shell device-shell--rack" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--rack device-shell__header">
          <AppTitle eyebrow="Metal Rack Equalizer" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--rack">
          <div className="rack-meter-bridge">
            <HeroVisualization
              {...props}
              moduleLabel="频谱桥"
              eyebrow="Dual Meter Bridge"
              moduleClassName="device-module--rack-visualization"
            />
            <FeatureSidebar
              {...props}
              moduleLabel="机柜面板"
              eyebrow="Utility Rack"
              moduleClassName="device-module--rack-feature"
            />
          </div>
          <div className="rack-lower-console">
            <PlaylistBlock
              {...props}
              moduleLabel="状态机柜"
              eyebrow="Information Screen"
              moduleClassName="device-module--rack-playlist"
            />
            <NowPlayingBlock
              {...props}
              variant="rack"
              moduleLabel="播放状态窗"
              eyebrow="Playback Display"
              moduleClassName="device-module--rack-status"
            />
          </div>
        </div>
        <ControlsBlock
          {...props}
          moduleLabel="机架控制台"
          eyebrow="Rack Transport"
          moduleClassName="device-module--rack-controls"
        />
      </section>
    </main>
  );
}

export function WarmWoodLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--warm-wood">
      <section className="chrome skin-chrome skin-chrome--wood device-shell device-shell--wood" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--wood device-shell__header">
          <AppTitle eyebrow="Warm Wood Turntable" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--wood">
          <div className="wood-album-sleeve">
            <NowPlayingBlock
              {...props}
              variant="wood"
              moduleLabel="陈列窗"
              eyebrow="Album Display"
              moduleClassName="device-module--wood-status"
            />
            <HeroVisualization
              {...props}
              moduleLabel="暖光铭牌窗"
              eyebrow="Warm Spectrum"
              moduleClassName="device-module--wood-visualization"
            />
          </div>
          <div className="wood-liner-notes">
            <PlaylistBlock
              {...props}
              moduleLabel="节目单仓"
              eyebrow="Liner Notes"
              moduleClassName="device-module--wood-playlist"
            />
            <FeatureSidebar
              {...props}
              moduleLabel="黄铜功能匣"
              eyebrow="Brass Options"
              moduleClassName="device-module--wood-feature"
            />
          </div>
        </div>
        <ControlsBlock
          {...props}
          moduleLabel="黄铜控制台"
          eyebrow="Ivory Transport"
          moduleClassName="device-module--wood-controls"
        />
      </section>
    </main>
  );
}
