# What this fork added (SD-V2/ssgl-doom-launcher)

Everything below exists in `app/`. "(Settings)" = can be changed in the Settings screen.

## Mods and packages
- Drag mods from Explorer into SSGL; drag to reorder the load order; add all / remove all of a folder.
- Sort by folder (nested, collapsible); folders can be created, renamed and deleted; "Add all" on a folder.
- Favorites, "NEW" badge, compact list (Settings), auto-refresh when files change (Settings), package notes,
  package export / import (with a report window), duplicate finder, "twin" detection (same mod twice), disk usage view.
- Conflict checker (which mods change the same files), broken-file checker, "fix packages" after a mod was replaced.
- Safe saving (temp file + `.bak`, crash recovery), unsaved-changes dot on the package name, question windows before
  switching / closing with unsaved changes (SSGL-style windows, also when minimized).
- Minimize SSGL while the game runs (Settings).
- **Maps** live in their own folder (Settings: maps directory) with a MAPS | MODS switch; maps always load last.

## Sections of the load order (LIST | SECTIONS switch)
- Fixed boxes 0..N (Libraries, Main mod, Monsters, Glory kills, Weapons, Small gameplay changes, Sounds, Music,
  Textures and upscales, Visual, Other, Patches, Maps). The load order is always arranged by section.
- A mod's section comes from the **closest folder name** with a word of a section, or by hand (right-click a folder > Section, drag a mod
  into a box, or the "-> section" tag in the mod list). Dragging a whole folder puts every mod in its place.
- Sections can be moved up/down (numbers follow the place), renamed, given other words / explanations, removed, and you can add
  your own (Edit sections window). Settings > Sections > reset to default.
- In the sections view the mod list shows a "-> section" tag on every mod and a "Section: ..." filter.

## Looks (Settings)
- Color themes: the originals + Berserk, Steel, Neon, Night City (cyan + red), Blood Moon (gold + crimson), custom accent.
- **Interface style**: Classic, Cyberpunk, Gothic (Futuristic is planned) - see `docs/STYLES.md`.
- Wallpaper image with **fit** (fill / fit whole picture / stretch), darkening and blur sliders (live preview).
- **Active mod marker**: 11 designs (Pentagram, UAC, BFG, Pinkie, Slayer, Target, Chip, Bolt, Cross, Rose window, Arch);
  "Automatic" = the design of the color theme in Classic, the target in Cyberpunk, the cross in Gothic.
- **Sounds** (Settings > Sounds, off by default): volume and "sounds match the interface style" (Cyberpunk = digital beeps,
  Gothic = stone and bells; Classic = the click). Files: `client/assets/sounds`.
- Cyberpunk: neon mouse pointers (arrow, hand), a live sparkle trail behind the pointer, click burst. Settings > "Cursor effects" (only shown for Cyberpunk): trail on/off, trail size and length (50-200 %), click effect on/off - all shown at once (live preview).
- Languages: English, Turkish, Arabic (right to left), Russian (Settings > Language).

## Updates
- Update notice for newer releases and for **new uploads to the fork** (compares the commit the program was built from with the
  newest commit). Settings > Update notifier: Beta and Stable / Stable only / Off. Checks at start and when the window gets focus
  again (at most every 10 minutes). The source is fixed to the fork.
- `tools/windows-build/Build-SSGL.cmd` builds the Windows program from the fork and stamps the commit into it.

## Ideas that were discussed but not built yet
Futuristic interface style; "Section: ..." per package; look per package / saved looks; demo (.lmp) recording and a demo list;
mod info card (readme, author); play history and statistics; crash finder (turn off half the mods); download center;
move old map files out of the mods folder; start-at-map dropdown; desktop shortcut per package; package that builds on another;
compare two packages; find unused mods; update check per mod; campaign list; controller mode; quick search (Ctrl+K).
