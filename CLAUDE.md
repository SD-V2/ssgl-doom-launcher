# SSGL fork - notes for Claude Code

## Working rules (newest, they win over everything else in this file)

1. **English only for now.** New or changed texts go only into `app/client/locales/en.js` (the app shows English where a
   translation is missing). Do not write or test Turkish / Arabic / Russian texts, do not take pictures in other languages,
   do not write new tests that loop over languages, and do not talk about languages in pull requests.
   (This replaces rule 1 of "Texts and languages" below; the rest of that rule - Arabic layout, `dir="auto"` - still describes
   how the app works.)
2. **Translations later, in one job.** `cd tests && node missing-translations.js` writes `docs/TODO-TRANSLATIONS.md`
   (key, English text, which languages lack it). Run it only when the owner asks for the translation job.
   `i18ncheck` only *reports* untranslated texts ("12 texts not translated yet"); it still fails on English texts the code
   uses but `en.js` lacks, keys that exist in another language but not in English, and broken `{{placeholders}}`
   in existing translations.
3. **Save tokens.**
   - Tests: run only the check files of your change (`node run-all.js <part of name>`); run the whole suite **once**,
     before you open the pull request.
   - Pictures only for visual changes: English, Classic plus the one style you changed, one color theme (hell), a few key
     screens; look at each picture once. (This replaces "check it with every color theme" below.)
   - Do not re-read big files, do not paste long logs.
   - Pull request text short: what is new, how to try it, what is not done.

Read this first. It was written at the end of a long working session in the Claude chat app
(which is where this fork was built, with zip files, before moving to Claude Code).

## Who you work for

- The owner is **not a programmer**. They know what they want to see, not how it is built.
  Explain in **short, plain words**. Say what changed, how to see it, what to try. No jargon, no long diffs in the explanation.
- Their GitHub name is **SD-V2**; the fork is `SD-V2/ssgl-doom-launcher` (original: `FreaKzero/ssgl-doom-launcher`).
  They use **Windows**. They build the program on their PC with `tools/windows-build/Build-SSGL.cmd`
  (it downloads the newest code of the fork's default branch and builds it). They never run commands themselves.
- Work on a **branch** (one branch per feature, a clear name), and tell them to press **Merge** on GitHub when happy.
  Do not push to the default branch directly. The Windows build only sees what is merged.
- Write the pull request text for a non-programmer: what is new, what to click to see it, what could look different.
- They love visual work (styles, colors, effects). **Show pictures** of visual changes when you can (see tools/screenshots).
  They test on a 2560 px wide screen, with the languages English, Turkish, Arabic (right to left) and Russian.
- Ask only when a choice really changes the result; otherwise suggest a default and say so. They often answer with
  short messages ("A3 and B2"). When they say "suggest before starting", suggest and wait.

## The project in one paragraph

SSGL ("Super Shotgun Launcher") is an Electron 44 + React 16 + styled-components 4 + webpack 4 launcher for Doom mods.
Electron 44 runs on **Windows 10 and 11, 64-bit only** (Windows 7/8/8.1 were dropped in Electron 23, 32-bit Windows in 44).
`app/electron` = main process (files, play, updates), `app/client` = the screens (React). Settings and packages are
saved as JSON in the user's data folder. See `docs/FEATURES.md` for everything the fork added and `docs/STYLES.md`
for the interface styles.

## Commands

```
cd app && yarn install                 # once (Node 22.12 or newer, Electron 44 needs it; webpack 4 needs NODE_OPTIONS=--openssl-legacy-provider)
cd app && yarn build                   # production build (must finish with 0 "ERROR in")
cd tests && npm install && node run-all.js     # all checks (see tests/README.md)
cd tools/screenshots && node build.js          # pictures of screens (see tools/screenshots/README.md)
```

**Before every pull request:** `yarn build` has no errors and `node run-all.js` is all green.
For anything visual also run the screenshot tool and **look at the pictures** (and at the dropdown / window checks).

## Where things are (app/)

```
electron/main.js, menu.js, constants.js      start, menu, DEFAULT_UPDATE_REPO = SD-V2/ssgl-doom-launcher
electron/handlers/*.js                       one file per feature area (mods, folders, packages, transfer, conflicts, health, fixes, main)
electron/utils/*.js                          startup.js (start timer + startup-log.txt), libraryCache.js (scan cache), wallpaper.js (screen-sized copy),
                                             json.js (safe saving: temp file + .bak), mods.js (scanLibrary), play.js, watcher.js,
                                             archive.js, closeGuard.js, versions.js (update compare), health.js, safepath.js
client/components/Startup.jsx, utils/useStartup.js   loading screen, start from the cache, background check (see docs/PERFORMANCE.md)
client/index.js                              App: theme + style layer, DialogProvider, persists section rules and view mode
client/state/reducer.js                      ALL state changes (initState has every setting and its default)
client/views/Wads.jsx                        the mod / maps screen (lists, load order, sections view, drag and drop, menus)
client/views/Settings.jsx                    Settings (live preview pattern, see below)
client/Theme/index.jsx                       color themes (makeTheme: active, glow, dark, second)
client/Theme/styles.jsx                      interface styles (Cyberpunk, Gothic) + mouse pointers + keyboard frame
client/Theme/trail.js, CursorTrail.jsx       the Cyberpunk sparkle trail (engine + canvas)
client/utils/sections.js                     section rules: order, own sections, resolveSection, sortBySections
client/utils/updateNotice.js                 when the update notice is shown
client/components/Dialog/index.jsx           SSGL-style question windows (never use Windows message boxes)
client/components/Audio/index.jsx            sound sets per style
client/components/Mods/*                     ModItem, ModBox, SectionFrame, SectionsEditor, TabSwitch, Checkmarks/ (the active-mod markers)
client/components/MarkerPicker.jsx           marker picture picker (Settings)
client/locales/{en,tr,ar,ru}.js              all texts; en.js is the master
client/assets/fonts, sounds                  fonts (+ FONTS-LICENSE.txt) and sound files (original, made for this fork)
```

## Rules learned the hard way (each one cost a bug - please keep them)

**Texts and languages**
1. *(Replaced by Working rule 1 at the top: new texts go only into `en.js`.)*
   Arabic: the owner wants the **English layout, not mirrored** (html stays `dir="ltr"`); only the text reads right to left.
   `utils/textDirection.js` gives every text-only block `dir="auto"` (not flex/grid boxes, texts starting with a number keep
   the English order) and global.css keeps each text on the side it has in English. Do not set `dir="rtl"` on the page again.
   Keep using `margin-inline-*` / `padding-inline-*` (they now act as in English). `tests/arabic.js` checks this.
   Brand names (UAC, BFG, Pinkie, Slayer) stay in Latin letters in Russian.
2. Never show a Windows message box. Use `useDialog()` (`dialog.confirm`, `dialog.info`).

**Settings**
3. Settings screen pattern: a setting is added to `initState.settings` (default), to the form in `Settings.jsx`, and - if it
   changes the look - to the **live preview** list (`savedLook` + the `settings/preview` effect), so it shows at once and goes
   back when leaving without saving. `tests/lang8.js`, `marker.js`, `feel.js`, `trailui.js` show the pattern.
4. An unticked checkbox is saved as `''`, not `false`. Treat falsy-but-defined as off, and "undefined" as the default.
5. The `Dropdown` component only shows its text when `value` is non-empty: an "all" choice needs a real value like `'all'`.

**Electron 44 = Chromium 152** (it was Electron 7 / Chromium 78 until the upgrade)
6. CSS: `inset:`, `:focus-visible`, `:is()` / `:where()`, `gap` for flexbox, `aspect-ratio`, `color-mix()` and native CSS nesting
   all work now (checked in Electron 44). The keyboard frame still uses `:focus` + the `html[data-keyboard]` mark - keep it, it
   works and is tested. The CSS goes through styled-components 4 first: check new CSS in the screenshot tool (same Electron).
   JavaScript: webpack 4 can only read older JavaScript, so Babel keeps translating the code (do not give Babel a modern
   `targets` setting). Write JS as before.
6a. **Electron's `remote` module is gone** (removed in Electron 14). The screens ask the main part through
   `client/utils/native.js` (links, show in folder, open, Recycle Bin, file picker, right-click menus, program version) ->
   `electron/handlers/native.js`. Right-click menus: `popupMenu(template)` with the usual Menu template; the click functions
   stay in the screen. Files dropped from Explorer: `pathOfFile(file)` (`File.path` is gone since Electron 32). File dialogs:
   use `startIn()` / `remember()` from `electron/utils/lastFolder.js` (since Electron 43 a dialog opens Downloads otherwise).
   The window keeps `nodeIntegration: true, contextIsolation: false` (the screens use `require('electron')`).

**Interface styles (client/Theme/styles.jsx)** - see also docs/STYLES.md
7. **Never `clip-path` anything that can hold a dropdown**: `.ssgl-panel`, `.ssgl-input`, `.ssgl-modal`. The list of a dropdown
   sticks out of its box; clipping hides it AND blocks the clicks. Draw corner cuts with gradients/pseudo-elements instead.
   (`tests/style.js` and `node run.js hit` check this.)
8. **Never set `position` on `.ssgl-modal`**: SSGL places windows with `position: absolute`. A style must not change sizes or
   places, only looks. (`tests/style.js` checks width/height/top/left/margin/display are not touched.)
9. **Pictures inside CSS (data URLs in createGlobalStyle) must not contain `; ' ( )` or `//`** - the CSS tool cuts there and the
   browser drops most of the sheet. Always build them with `dataUrl()` in styles.jsx.
10. **@font-face: give exact weights, never a weight range** (`font-weight: 400 600`) when the family also has other faces. The browser
    then picks only the range face and the Latin letters silently fall back to a plain font. Check: `tests/style.js` and
    measure text width after load. All custom fonts also need Cyrillic and Arabic faces (fallbacks to Play / Cairo are included).
11. Cursor pictures: SVG, 32 x 32, with a hotspot; `cursor: ... !important` must also cover `html body` itself, not only `html body *`.
12. A style that adds a full-window layer (scanlines, canvas) must use `pointer-events: none`.

**Sections / load order**
13. In the sections view the load order is always arranged by section (reducer wrapper `KEEP_ORDER`); the user is asked before it
    changes. Maps always stay last. Hand rules: `sectionRules.folders` / `.mods`; own sections and names/words in the same object.
    The closest folder to the mod decides the section ("Brutal Doom / 10_VISUAL" -> visual), not the top folder.

**Updates**
14. The update notice always asks the fork (`DEFAULT_UPDATE_REPO`), "Off" asks nobody, at most once in 10 minutes. The built program
    knows its commit from the zip comment that GitHub writes (see Build-SSGL.ps1) - do not go back to the GitHub API for that.

**Misc**
15. Saving: `electron/utils/json.js` writes a temp file and keeps a `.bak`; keep using it for anything saved.
16. Sounds are **off by default** (as in the original). The five events: soundStart, soundDrawer, soundModSelect,
    soundToastSuccess, soundToastError.
17. Hidden Electron windows only draw frames on demand: the screenshot scripts call `capturePage()` several times, and they call
    `webContents.focus()` (newer Chromium shows `:focus` styles only in a focused page); do the same
    before measuring animations.

## How to check your work

- GitHub runs the same build + checks by itself on every pull request (`.github/workflows/checks.yml`, "Build and checks")
  and builds the Windows program as a download (`windows-build.yml`, artifact `SSGL-windows-<commit>`). Keep both green.
- Logic and screens: `cd tests && node run-all.js` (jsdom, fast).
- Look of a screen: `cd tools/screenshots && node build.js && node run.js shot "settings,en,hell,classic"` then open the picture in `out/shots`.
  Scene names are in `tools/screenshots/harness/entry.jsx` (settings, wads-sections-few, dlg-discard, markers, ...).
  The last parts of the scene text choose language, color theme and style, e.g. `settings,en,nightcity,cyberpunk`.
- Dropdowns: `node run.js hit "settings,en,hell,gothic"` (every list must be clickable).
- Windows: `node run.js geom "dlg-discard,en,hell,cyberpunk"` (must open at the same place as in classic).
- After editing a style: check it with **every** color theme (hell, nightcity, bloodmoon, neon ...) and all three styles.

## Style of the work

- Small, clear changes; do not rewrite files you do not need to touch. Keep code comments short and in plain English.
- Add checks for what you build (tests folder). If a bug is found, first add the check that would have caught it, then fix.
- Keep the user's earlier features working: the tests are the safety net.
