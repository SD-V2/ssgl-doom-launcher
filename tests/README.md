# Checks (tests)

There is no test framework here: every file in this folder is a small script that prints one line per
check, starting with `OK` or `MISS`. `run-all.js` runs them all.

```
cd app   && yarn install      # once
cd tests && npm install       # once
cd tests && node run-all.js   # all files (about 2-4 minutes)
cd tests && node run-all.js style   # only the files with "style" in the name
```

What they cover (a short map):

| file | what it checks |
|---|---|
| `ssr`, `lang`, `lang2` - `lang14` | the real screens, rendered in a fake browser (jsdom): texts, languages (English, Turkish, Arabic = right to left, Russian), mod lists, sections view, dialogs, Settings and its live preview |
| `dialog` | the SSGL-style question windows |
| `style` | the interface styles (Cyberpunk, Gothic): the generated style sheet, safety rules (see CLAUDE.md), fonts, pointers |
| `marker` | the active mod markers and the picker in Settings |
| `feel` | sounds per style, keyboard frame mark, Sounds section in Settings |
| `arabic` | Arabic: layout as in English (nothing mirrored), the text reads right to left |
| `tabs` | switching tabs: the short slide + fade of a screen, no row-by-row fades |
| `trail`, `trailui`, `cursorfx` | the Cyberpunk sparkle trail (engine and canvas) and the Cursor effects options |
| `sections`, `fixed`, `secorder`, `custom` | the sections of the load order: rules, order, own sections, drag into a section |
| `order`, `maps`, `twins`, `hide`, `closeguard`, `unsaved`, `json` | load order moves, maps folder, twin mods, minimize while playing, closing, unsaved changes, safe saving |
| `upd`, `notice` | the update notice (GitHub answers are faked) |
| `native` | the requests the screens send to the main part (links, show in folder, Recycle Bin, file picker, right-click menus) - they replaced Electron's old `remote` module |
| `upscaler` | Tools > Upscaler, main part: pictures of a mod, engine command line and messages, PNG offsets (grAb), the new PK3 (hires + TEXTURES), names, never overwrite, cancel / pause, out of memory, temp folders. The engine is faked: `fixtures/fake-esrgan.js` |
| `upscalelook` | Upscaler "Look" (Smooth / Natural / Sharp) and its command lines, the model of every kind (Compare models, remembered), the Compare models flow with the fake engine, HUD and menu pictures as graphics, sprite edges: no pixel stairs at 2x / 4x, no dark or light halos, thin details kept (made-up pictures only) |
| `wad` | Upscaler step 2, Doom's own formats with tiny made-up WADs: directory, pictures (posts, gaps, offsets, tall pictures), flats, palette of the mod or the game, namespaces, PNG in WAD, TEXTURE1 / Strife / TEXTURES, PK3 lumps without extension, broken and huge files, a 20 MB WAD |
| `upscalewad` | a WAD mod and a PK3 with Doom lumps through the whole Upscaler job (fake engine): hires/ names, sizes, a flat and a wall texture with the same name |
| `viewer` | Tools > Graphics viewer: the screen with the real main part, only visible rows drawn, thumbnails on demand (also after a resize), kinds, search, big view, Save as PNG, palette, SLADE |
| `tools` | the Tools page and every state of the Upscaler screen, the menu item, four languages |
| `startup` | faster start: the startup log, the scanner (skipped folders, broken links, speed), the library cache (added / removed / renamed files, broken cache, other folders), the wallpaper copy |
| `loading` | the loading screen in 3 styles x 4 languages, the background check line, the start with the cache, no white window, the start time in About |
| `i18ncheck` | every text the code uses exists in English; no keys only in other languages; `{{placeholders}}` kept in existing translations. Texts not translated yet are only reported ("12 texts not translated yet" on the last line) |

When you add a feature: add checks for it in the file that fits (or a new file, and add its name to
`SUITES` in `run-all.js`).

Tip: a failing check prints `MISS <what was expected>`. Run the one file with `node <file>.js`.

On GitHub, `.github/workflows/checks.yml` runs `yarn build` and `node run-all.js` for every pull request
(job "Build and checks"), with no screen (the checks use jsdom).

`node missing-translations.js` (not part of run-all) writes `docs/TODO-TRANSLATIONS.md`: every English text that Turkish, Arabic or Russian do not have yet. Run it only for the translation job.
