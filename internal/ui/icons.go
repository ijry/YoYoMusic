package ui

import (
	myui "github.com/egoist/mygo/ui"
)

// Icon set, drawn as SVG rather than emoji.
//
// Emoji render differently on every platform — the OS substitutes its own
// font, so the same glyph can be full colour on one machine and a monochrome
// outline on another, and it never matches the app's palette. These are
// single-colour line icons on a 24x24 grid that mygo draws with the current
// text colour (Icon takes its colour from TextColor), so they follow the
// skin's ink automatically.
//
// mygo's SVG support covers paths, basic shapes, groups, transforms,
// gradients and strokes; it has no text, so every icon is pure geometry.

// iconGlyphs maps a logical name to its SVG source.
var iconGlyphs = map[string]string{
	// --- transport ---
	"play":  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`,
	"pause": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>`,
	"prev":  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm12 0v12l-9-6z" fill="currentColor"/></svg>`,
	"next":  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 6l9 6-9 6z" fill="currentColor"/></svg>`,

	// --- volume ---
	"volume-high": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`,
	"volume-mid":  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>`,
	"volume-low":  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`,
	"volume-mute": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>`,

	// --- panels ---
	"eq":     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M4 14h0M12 12h0M20 16h0"/></svg>`,
	"lyrics": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><ellipse cx="7" cy="7" rx="4" ry="3" transform="rotate(-20 7 7)"/><ellipse cx="17" cy="17" rx="4" ry="3" transform="rotate(-20 17 17)"/></svg>`,
	"skins":  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="9.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/></svg>`,
	"about":  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,

	// --- playlist / layout ---
	"playlist": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h11M4 12h11M4 18h7"/><circle cx="19" cy="17" r="2.6"/><path d="M21.6 17V9l-2.6.6"/></svg>`,
	"pin":      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 6 4 3H6l4-3z"/><path d="M12 13v7"/></svg>`,
	"close":    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,

	// --- misc ---
	"music": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>`,
	"check": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>`,
}

// icons caches the parsed SVGs. Parsing is cheap but the icons are drawn every
// frame, so it is done once.
var icons = map[string]*myui.SVG{}

// icon returns the named SVG, parsing it on first use. An unknown name
// yields nil, which mygo renders as nothing — safer than panicking on a
// typo in the middle of a frame.
func icon(name string) *myui.SVG {
	if s, ok := icons[name]; ok {
		return s
	}
	src, ok := iconGlyphs[name]
	if !ok {
		return nil
	}
	s := myui.MustParseSVG([]byte(src))
	icons[name] = s
	return s
}

// iconButton is a button whose label is an SVG icon rather than text. The
// tooltip carries the accessible name, since an icon alone says nothing to a
// screen reader.
func iconButton(c *myui.Context, key, name, tip string) myui.Element {
	b := myui.Button(c.Key(key), "").Tooltip(tip)
	if svg := icon(name); svg != nil {
		// Icon takes its colour from the surrounding TextColor, so it
		// follows the theme without being told.
		b.Children(func() { myui.Icon(c, svg) })
	}
	return b
}
