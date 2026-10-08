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
| `i18ncheck` | every text exists in all four languages |

When you add a feature: add checks for it in the file that fits (or a new file, and add its name to
`SUITES` in `run-all.js`).

Tip: a failing check prints `MISS <what was expected>`. Run the one file with `node <file>.js`.
