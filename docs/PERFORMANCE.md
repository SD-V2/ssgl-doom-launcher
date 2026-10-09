# How fast SSGL starts

SSGL writes down how long every start takes. **About** shows the last one
("Start: window after 0.5 s, usable after 0.8 s") and a link to `startup-log.txt` in the data
folder (`%APPDATA%\ssgl-doom-launcher` on Windows). That file keeps the last 10 starts, one line each:

```
2026-10-09T09:05:56Z  window 0.5 s  usable 0.8 s  {"marks":{...},"extra":{...}}
```

- **window**: the SSGL window is on screen with its first picture (logo + thin line).
- **usable**: the mod list is drawn and can be clicked.
- The marks (milliseconds since the double-click reached the program): `mainStart`, `appReady`, `windowCreated`,
  `firstPaint`, `windowShown`, `htmlLoaded`, `scriptRun`, `initSent`, `cacheUsed` (list from the cache),
  `scanStart` / `scanDone` (+ `scanMs`, `mods` in extra), `initAnswered`, `firstRender`, `usable`, `fontsLoaded`,
  `wallpaperDecoded` (+ `wallpaperCopy`), `updateCheck`.

Code: `electron/utils/startup.js` (marks + log), `client/utils/startup.js` (`startupMark`).

## Where the time goes (measured)

Measured with the real built program (Electron 44) on Linux in a virtual screen, software drawing (no graphics card),
fake libraries made by a script: 600 small pk3/zip/wad files in about 40 nested folders + 30 maps; 5000 files; a slow
folder; 600 mods plus 50,000 loose files (an unpacked mod); an 8K wallpaper (7680 x 4320 JPG).
Several starts each; the ranges are what was seen.

| moment (600 mods, 8K wallpaper) | before | after |
|---|---|---|
| program started | 0.11 s | 0.11 s |
| window created | 0.26 - 0.30 s (**white** until 0.63 - 0.73 s) | hidden until its first dark frame |
| window on screen, with something in it | 0.63 - 0.73 s | **0.5 - 0.6 s** (at most 1.1 s), dark from the first frame, logo + line |
| program code read (bundle) | 0.10 - 0.14 s (2.97 MB) | 0.08 - 0.10 s (0.93 MB) |
| library scan | 0.14 - 0.24 s, before anything is shown | 45 ms, in the background (the list comes from the cache) |
| list usable | **1.9 - 2.1 s** | **0.7 - 0.9 s** |
| wallpaper on screen | 4.1 - 4.8 s | 0.75 - 1.1 s (screen-sized copy), fades in |

| other libraries | before (usable) | after (usable) |
|---|---|---|
| 5000 mods | 2.7 - 3.2 s | 0.7 - 1.1 s |
| slow folder | - | 0.7 - 1.3 s |
| 600 mods + 50,000 loose files | **15.4 s** (scan 12.6 s) | 1.1 s first start, 0.8 s with the cache (scan 0.4 - 0.5 s in the background) |

Targets were: window under 1.5 s, list usable under 3 s with 600 mods. Both are reached here, with room to spare.
**This is not the owner's PC**: see "What could not be measured".

## What was slow, and what was changed

1. **The window waited for everything.** The list was only shown after the full scan, and the code waited one more
   second on purpose (`delayLoad(1000)`). Now the window shows a loading screen at once (logo, thin moving line,
   "Scanning 560 mods..."), the list comes from a **cache** of the last scan (`library-cache.json`, saved with the safe
   saving helper), and the folders are checked in the background (thin line at the top). If anything changed while
   SSGL was closed (files added, removed, renamed, another mods folder, another maps folder), the list is replaced
   with the new one. A broken cache is ignored and the folders are simply read. The 1 s wait is gone.
2. **White flash.** The window was white until its first picture. Now it has the loading screen's dark colour, stays
   hidden until its first frame is ready (at most 0.8 s after it is made), and the page shows the logo before the
   program code has even run (`production.html`).
3. **The scan.** It looked at every file twice and looked into every folder, also `.git`, `node_modules`, the
   Recycle Bin and other hidden folders. Now: one look per folder, only mod files are measured (in parallel),
   those folders are skipped, a broken link or unreadable folder is skipped instead of stopping the whole scan.
   Same result as before, checked file by file on all fake libraries. 600 mods: 109 -> 45 ms; 5000: 379 -> 156 ms;
   50,000 loose files: 10.7 s -> 0.44 s. The folder watcher starts 1.5 s after the list is shown.
4. **The wallpaper.** An 8K picture takes seconds to decode at every start. SSGL now makes a copy in the size of the
   screen once (in the background, `wallpaper-cache` in the data folder, the last 3 are kept) and shows that one; it
   fades in when it is ready. **Your own picture is never changed.** GIFs (moving) and small pictures are used as they are.
5. **Program size.** The IWAD cover pictures were built into the program code as text (2 MB). Now they are normal
   files: the code is 0.93 MB instead of 2.97 MB.
6. The update check starts 2.5 s after the list is usable, not during the start.

## Looked at, not changed (the numbers did not justify it)

- **Loading screens later (lazy screens)**: reading the code of all screens takes under 0.1 s in total; splitting it
  would win at most 0.03 s.
- **Fonts**: they are small files on the disk and are loaded by the browser part only when a text needs them (about
  0.6 s, after the window is shown). Nothing to win.
- **Sounds**: already separate files, loaded only when played (and sounds are off by default).
- **Snapshot / compile cache / special start flags**: no measured gain worth the risk.
- **Remembering first-seen dates (NEW badges), name learning**: cheap (a few ms), kept as they are.
- Production build: webpack `production` mode, no source maps, the program is packed in `app.asar`.

## What could not be measured here

- **Windows itself**, the owner's disk, the graphics card (RTX 5060) and its driver. Here everything ran on Linux
  without a graphics card. Windows usually starts Electron programs a bit slower.
- **Antivirus** (see below).
- The owner's real library (560 mods, 30 maps) and wallpaper. The startup log on the owner's PC will show these.

If the owner's start is still slow after this change, `startup-log.txt` will show which mark is late:
- late `appReady` (before the window exists): Windows / antivirus checking the program files;
- big `scanMs`: the mods folder (very many files, a network drive, a slow USB disk);
- late `wallpaperDecoded` on the first start only: the screen-sized copy is being made (next starts are fast).

## Antivirus (in plain words)

Windows Defender (and other antivirus programs) check every program file the first time it is opened, and again after
an update. SSGL is not "signed" (it has no paid certificate), so Windows looks at it more carefully. This can add
several seconds **before SSGL's own code even starts** - SSGL cannot make that part faster. It is usually only slow on
the first start after building a new version. If it is always slow, you can add the SSGL folder to Defender's
exclusions (Windows Security > Virus & threat protection > Manage settings > Exclusions) - only do this if you trust the
program you built yourself.

## How it was measured (for the next person)

- The startup log is written by the program itself on every start (`startup-log.txt`).
- `tests/startup.js` and `tests/loading.js` check the cache (added / removed / renamed files, broken cache, other
  folders), the scanner, the log and the loading screens (3 styles x 4 languages).
- White flash: the start was filmed (30 pictures per second) in a virtual screen. Before: about 6 white frames.
  After: none from SSGL; one bare window frame can still appear on Linux without a window manager (the empty
  system window before it is drawn), not on Windows where the window colour is used from the start.
