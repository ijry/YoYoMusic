# Default Classic Usability Design

## Goal

Make the installed first-run UI of YoYoMusic feel like a usable music player instead of a decorative machine panel, while keeping the existing fixed-shell layout and all current playback, playlist, visualization, and skin-switching behavior.

## Scope

This pass only changes the default `classic-blue-silver` skin and shared text/hooks that directly affect that skin's first screen. The other four built-in skins keep their existing layout identities unless a shared accessibility or click-feedback rule already applies to them.

## User-Facing Changes

- The default title area uses Chinese music-player copy: `经典蓝银分体机`, `本地音乐播放器`, and a plain skin name instead of English model/serial language.
- The title action buttons show direct labels: `皮肤`, `设置`, `迷你`, `桌面歌词`. Engineering codes such as `SKN`, `CFG`, `MINI`, and `LRC` are removed from the visible default UI.
- The classic skin keeps the same major regions: playlist on the left, now playing and visualization in the center, feature panel on the right, playback controls at the bottom.
- The classic skin removes or suppresses heavy visual noise: prominent hardware rails, rivets, dense trim bars, excessive glow, and deep inset shadows.
- Clickable controls remain visually clickable through cursor, hover, active, and focus-visible states.
- The app window remains fixed. Playlist, lyrics, feature content, and similar long content scroll internally only.

## Layout Rules

- `skin-chrome` remains `height: calc(100vh - 24px)` with `overflow: hidden`.
- The classic grid remains a three-column desktop layout to minimize regression risk.
- The top title bar becomes more compact and readable, with the title and primary actions aligned for first-screen use.
- The right feature area remains a single-row tab strip with internal horizontal overflow if needed.
- The bottom playback controls stay visible at all times in desktop-size windows.

## Visual Direction

The revised classic skin should read as clean blue-silver desktop audio software:

- dark blue base surfaces with restrained silver highlights;
- fewer borders and ornamental pseudo-elements;
- softer panels with smaller radii and reduced shadow depth;
- Chinese labels prioritized over machine-style abbreviations;
- stronger button affordance through simple contrast changes, not extra decoration.

## Interaction Requirements

- Clicking the top `皮肤` button opens the skin manager.
- Applying a built-in skin still changes the layout class.
- Feature tabs remain reachable and visibly selected.
- Hover, active, and keyboard focus states must be visible on title action buttons, feature tabs, playlist actions, and skin-card actions.
- Decorative pseudo-elements must not intercept pointer events.

## Testing Requirements

- Add or update React tests that verify the default classic first screen uses the new Chinese title/action copy.
- Preserve the existing browser-mode test that clicks the top `皮肤` button and applies a built-in skin.
- Add or update CSS tests that verify the classic skin suppresses heavy hardware and uses compact title/button/tab rules.
- Run targeted tests first, then the full suite.
- Build the web bundle and Tauri installer after tests pass.

## Packaging Requirements

- Use Node `22.22.2` for all test and build commands.
- Build with `npm run build` and `npm run tauri build`.
- Install the new package cleanly if same-version MSI behavior prevents overwrite.
- Verify the installed Start Menu shortcut target after installation.

## Out Of Scope

- Rebuilding all five skins.
- Changing audio playback internals.
- Adding new dependencies.
- Redesigning mini-player or desktop lyrics behavior.
- Reintroducing full-window scrolling.
