# Skin Manager Usability Design

## Goal

Make the skin manager feel like an obvious built-in skin switcher for YoYoMusic instead of a technical card list, so users can confidently preview and apply the five built-in skins.

## Scope

This pass changes only the skin manager panel, its tests, and skin-manager-specific styling. It does not change playback behavior, audio state, the five layout skin structures, installer metadata, or app versioning.

## Current Problems

- Each skin card has two long buttons, so the primary action is visually diluted.
- Preview state is small and easy to miss.
- The card itself does not behave like an interactive preview target.
- The copy still reads like machine metadata instead of a user-facing skin library.
- The active skin does not strongly communicate that applying it again is unnecessary.

## User-Facing Design

- The panel heading changes from an engineering-style manager to a concise skin library: `皮肤库`.
- The status copy summarizes available built-in skins, such as `5 套内置皮肤`.
- Each skin appears as a larger visual card with the thumbnail as the dominant element.
- Each card shows the skin name, a short tone label, and a concise description.
- The active skin shows a clear `使用中` state and has its apply button disabled.
- Non-active skins show one primary `应用` button.
- Clicking the main body of a skin card previews that skin.
- Previewed cards show a visible `预览中` state and a stronger border/background treatment.

## Interaction Rules

- Card preview must be available by mouse click and keyboard activation.
- The preview control must expose an accessible name such as `预览 暗夜黑胶舱`.
- The apply button must expose an accessible name such as `应用 暗夜黑胶舱`.
- The active skin apply control must be disabled and visibly labeled as `使用中`.
- Import behavior remains wired through the existing optional `onImport` callback.
- Error messages continue to render with `role="alert"`.

## Visual Direction

The panel should follow the cleaned-up default player direction:

- fewer nested boxes and smaller metadata chips;
- larger thumbnails;
- clear selected, previewed, hover, active, and focus-visible states;
- a single primary action per non-active card;
- no emoji icons or decorative pointer-blocking pseudo-elements.

## Component Design

`SkinManager` keeps the existing `SkinSummary` props and `previewSkinId` state. The card preview target becomes a `button` or button-like semantic element inside each card so keyboard users can activate preview without relying on hover.

The action area becomes:

- active skin: disabled button text `使用中`;
- inactive skin: primary button text `应用`;
- preview status text rendered separately from the action button.

The implementation should avoid changing the shape of `SkinSummary` unless a test proves the current fields are insufficient. Current fields are sufficient.

## CSS Design

Skin-manager CSS should add or update hooks for:

- compact heading/status text;
- a responsive grid of visual cards;
- large thumbnail frame;
- `.skin-card.is-active`;
- `.skin-card.is-previewing`;
- `.skin-card__preview-button`;
- `.skin-card__apply-button`;
- disabled active apply button;
- hover and focus-visible states.

The existing fixed shell behavior remains unchanged. If skin cards overflow the right feature panel, the existing feature content scroll area handles scrolling internally.

## Testing Requirements

- Update `SkinManager.test.tsx` to verify card-body preview activation.
- Verify clicking the inactive `应用` button calls `onApply` with the selected skin id.
- Verify the active skin renders `使用中` and its apply control is disabled.
- Verify preview state text appears after previewing a non-active skin.
- Verify error text still renders for invalid imported packages.
- Add or update CSS tests for skin-manager-specific hooks if the existing CSS test suite covers those selectors.

## Packaging Requirements

After implementation:

- Run targeted tests for `SkinManager` and skin layout CSS.
- Run the full test suite.
- Build the web bundle.
- Build the Tauri package.
- Install the new MSI cleanly if same-version behavior prevents overwrite.
- Verify the installed shortcut points to the installed `yoyomusic.exe`.

## Out Of Scope

- Creating new skins.
- Changing the five layout skin implementations.
- Adding drag-and-drop skin import.
- Changing playback controls or playlist behavior.
- Changing Tauri commands or Rust playback internals.
