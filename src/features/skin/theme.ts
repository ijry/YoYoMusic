export interface SkinThemeTokens {
  colors?: {
    primary?: string;
    surface?: string;
    text?: string;
    accent?: string;
    muted?: string;
  };
  radius?: {
    panel?: string;
  };
}

export function applyThemeTokens(tokens: SkinThemeTokens, root: HTMLElement = document.documentElement) {
  if (tokens.colors?.primary) root.style.setProperty("--color-primary", tokens.colors.primary);
  if (tokens.colors?.surface) root.style.setProperty("--color-surface", tokens.colors.surface);
  if (tokens.colors?.text) root.style.setProperty("--color-text", tokens.colors.text);
  if (tokens.colors?.accent) root.style.setProperty("--color-accent", tokens.colors.accent);
  if (tokens.colors?.muted) root.style.setProperty("--color-muted", tokens.colors.muted);
  if (tokens.radius?.panel) root.style.setProperty("--radius-panel", tokens.radius.panel);
}
