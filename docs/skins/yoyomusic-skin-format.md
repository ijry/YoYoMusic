# 悠悠乐听皮肤包格式

悠悠乐听首版使用自定义皮肤包格式，不兼容千千静听或其它旧播放器皮肤格式。皮肤包可以改变颜色、背景、字体、圆角、面板风格、按钮材质、歌词窗默认样式和可视化配色，但不能改变播放逻辑、窗口权限、数据结构或任意重排业务组件。

## 目录结构

```text
classic-blue/
  manifest.json
  theme.json
  assets/
    background.png
    button-play.png
    visualization-dot.png
  layouts/
    optional.json
```

## manifest.json

```json
{
  "name": "Classic Blue",
  "version": "1.0.0",
  "author": "YoYoMusic",
  "supports": ["main", "mini", "desktopLyrics"],
  "assets": [
    "assets/background.png",
    "assets/button-play.png",
    "assets/visualization-dot.png"
  ]
}
```

Required fields:

- `name`: skin display name.
- `version`: skin version.
- `author`: skin author.
- `supports`: supported window surfaces, such as `main`, `mini`, and `desktopLyrics`.
- `assets`: relative asset paths under the skin directory.

Asset paths must be relative and must not contain `..`, absolute Unix paths, or absolute Windows paths.

## theme.json

```json
{
  "colors": {
    "primary": "#31d6a3",
    "surface": "#151c2d",
    "text": "#f8fafc",
    "accent": "#8fd3ff",
    "muted": "#9fb0c7"
  },
  "radius": {
    "panel": "28px"
  }
}
```

Supported theme tokens:

- `colors.primary`
- `colors.surface`
- `colors.text`
- `colors.accent`
- `colors.muted`
- `radius.panel`

## layouts/optional.json

This file is optional. It can express limited layout preferences, such as cover display style or default desktop lyrics opacity. It cannot introduce new components or reorder core application regions.
