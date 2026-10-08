# Screenshot tool

Draws screens of the app in the **same Electron (7)** the app uses, with fake data, and saves PNG pictures. Used to look at
visual changes, and to test things a fake browser cannot (clicking dropdown lists, where a window opens, mouse pointers, sounds).

```
cd app && yarn install                 # once (also installs Electron)
cd tools/screenshots && node build.js  # builds the test page (again after every code change)
node run.js shot "settings,en,hell,classic"                 # a picture -> out/shots/settings_en_hell_classic.png
node run.js shot "wads-sections-few,en,nightcity,mods,new,cyberpunk" "settings,en,bloodmoon,gothic"
SIZE=1275x700 node run.js shot "markers,en,hell,classic"   # picture size (default 1075x610)
node run.js hit  "settings,en,hell,cyberpunk"    # every dropdown: can the first and last choice be clicked?
node run.js geom "dlg-discard,en,hell,cyberpunk" # where a window opens, after the opening animation
node run.js cur  "settings,en,nightcity,cyberpunk"   # the mouse pointers of a style (+ an enlarged picture)
node run.js trail "wads-sections-few,en,nightcity,mods,new,cyberpunk"   # the sparkle trail: moves, click, fade
node run.js snd                                   # can the browser play every sound file?
```

On Linux without a screen, `run.js` uses `xvfb-run` (install `xvfb`). Set `ELECTRON=/path/to/electron` to use another Electron.

## Scene text

`scene,language,color-theme,extra,...` - for example `settings,en,hell,classic`:

- scene: `settings`, `wads`, `wads-sections`, `wads-sections-few`, `markers`, `dlg-discard` (and the other `dlg-...` windows), ...
  (see `harness/entry.jsx`).
- language: `en`, `tr`, `ar`, `ru`.
- color theme: `hell`, `uac`, `bfg`, `slayer`, `pinkie`, `berserk`, `steel`, `neon`, `nightcity`, `bloodmoon`, ...
- extras (any order): `classic` / `cyberpunk` / `gothic` (interface style), `marker:uac`, `fit:contain`, `bg:/path/to/picture.png`,
  `mods` / `maps`, `new` / ... (sort).

The screens use fake mods; the fake data is in `harness/entry.jsx`. Add a scene there when you build a new screen.

## Good to know
- A hidden Electron window only draws a frame when asked. The scripts call `capturePage()` repeatedly; do the same in new scripts.
- `build.js` copies the harness to `app/.harness` for the build and removes it again - nothing is left in `app/`.
