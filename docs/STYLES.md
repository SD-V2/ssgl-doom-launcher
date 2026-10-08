# Interface styles

A **style** changes shapes, fonts and effects. The **color theme** changes colors. Every style must work with every color theme.
The code is in `app/client/Theme/styles.jsx`:

- `applyStyle(theme, style)` - small theme changes (fonts, square corners).
- One `createGlobalStyle` per style. It restyles parts of the app that carry a **hook class**:
  `ssgl-panel`, `ssgl-item`, `ssgl-folder`, `ssgl-section`, `ssgl-button`, `ssgl-input`, `ssgl-tabs`, `ssgl-modal`, `ssgl-nav`, `ssgl-tag`
  (set with `.attrs({ className })` on the styled components). Rules start with `html body .ssgl-x` so they win over the component styles.
- Colors come from the theme: `theme.color.active` (main), `theme.color.second` (second accent, falls back to `glow`), `theme.color.glow`.

## Safety rules (checked by tests/style.js - see CLAUDE.md for the reasons)
No `clip-path` on panel / input / modal. No `position` on modal. No width/height/top/left/margin/display on the main rules.
Data URLs only through `dataUrl()`. Fonts with exact weights. Pointers: SVG 32 x 32 with hotspot.

## Cyberpunk
HUD frames with corner brackets, tick rulers, red hazard stripes and dot patches (drawn with gradients), titles as `[ TITLE ]`,
cut corners on rows / buttons / tabs / sections, scanlines + dark edge, fonts CyberText (Chakra Petch) and CyberHead (Orbitron),
neon pointers (arrow + hand, `cyberCursors`), keyboard frame (neon ring), sparkle trail (`trail.js`, `CursorTrail.jsx`),
sound set `cyberpunk-*.ogg`, marker designs Target / Chip / Bolt. Made for the color theme "Night City".

## Gothic
Double golden frames with corner ornaments (SVG data URLs), diamonds on the edges and before titles, pointed-arch tabs, serif letters
(GothText = EB Garamond, GothHead = Cinzel Decorative), a faint stone grain and a warm dark edge, dagger pointers, keyboard frame
(double golden line), sound set `gothic-*.ogg`, marker designs Cross / Rose / Arch. Made for the color theme "Blood Moon".

## Futuristic (not built yet)
Wish of the owner: a third style, next to Cyberpunk and Gothic. Suggest a direction first (clean white/blue glass? holographic?
sci-fi cockpit?) with a picture, wait for the answer, then build the same way: fonts, shapes, effects, pointer, sounds, markers.

## Adding a style - checklist
1. `STYLES` list + `applyStyle` branch + a `createGlobalStyle` + `StyleLayer` branch.  2. Settings dropdown option + texts in 4 languages.
3. Fonts with Latin-ext, Cyrillic and Arabic faces (+ FONTS-LICENSE.txt).  4. Pointers + keyboard frame (`cursorRules`, `focusRules`).
5. Sounds in `Audio/index.jsx` (`SOUND_PACKS`).  6. Marker designs in `Checkmarks/Collection.jsx` (+ `MARKER_GROUPS`).
7. A matching color theme (optional).  8. Checks in `tests/style.js`; run `node run.js hit`, `geom`, `shot` for every color theme.
