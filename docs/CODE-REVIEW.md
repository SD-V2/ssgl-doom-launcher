# Code review (October 2026)

The whole program was read by area (main part, Upscaler and Doom readers, state and screens,
components and styles). Every finding was checked against the code before it was changed.
Each fix has a check in `tests/review.js` (it fails on the old code), or an existing check covers it.
Result: build with 0 errors, 1439 checks passed.

## Bugs fixed

**Crashes and lost work**
- A damaged `settings.json` stopped SSGL from starting (the menu read it without protection).
- Playing from Packages wiped the load order you were working on, without asking.
- A package whose sourceport was deleted made the Packages screen go blank.
- A mod that was gone from the library made Play fail silently, while SSGL said "Starting".
- Copying a config file could crash, or leave a half-written file. Now it is checked and awaited,
  and a missing "copy from" package falls back to the default config.
- A missing Oblige program crashed SSGL; the Oblige log timer could run forever.
- An unknown action reset the whole state; the "up" arrow on the first mod moved it to the end;
  ticking a mod changed the old state.
- Sourceports: saving a new one twice made two copies; deleting an unsaved one got stuck.
- A library on a drive root (D:\) got "D:" as a folder; a folder named "..name" counted as outside.

**Upscaler**
- A job that ended (done, error or cancel) while a game was running came back as "running" for good.
- An early error (a read-only folder) left the job "running" for good.
- The engine download stopped after 60 s in total (slow lines always failed).
- Cancel did not stop unpacking, and allowed a second install at the same time.
- A failed folder swap could lose the working engine.
- The engine test could hang forever; closing SSGL left the preview engine running.
- Soft see-through pictures (glass, smoke) were wrongly rejected.
- Failed pictures were counted twice after a pause.

**Screens**
- Links in the update notes opened inside SSGL (with full access). Now they open in the browser.
- Several messages in a row: only the last one showed.
- The Play drawer showed a stray "0" without IWADs, and reset the chosen sourceport.
- Package save said "saved" when it failed, and could not save when the IWAD had been moved.
- Dropdown: Enter after the list changed could crash the screen.
- Cancelling a file picker cleared the field.
- Sounds and wallpaper with # or % in the path did not load.
- The Graphics viewer could show pictures of the file opened before.
- F1-F4 opened pages that the menu hides.
- A duplicate text key made the "Background" label in Compare models show a long sentence.

## Speed
- The see-through edge fill of the Upscaler: 512 px picture 2.1 s -> 0.06 s (same result, checked).
- Listing a PK3 reads 1 KB per picture instead of 64 KB.
- Load order looks mods up in a map (was a search per entry, on every key in the filter).
- The update check has a 10 s timeout (it could hang).

## Removed
4 unused files, unused names and settings, 2 unused packages, double list entries ('DEH', 'SCRIPTS'),
a second CRC32 and a second shortName, a broken CSS line, an action nobody sent.

## Left as they are (on purpose)
- Shortcuts also work inside text fields (that is how it behaves now; changing it would feel different).
- Clicking outside the package window does not close it (protects what you typed).
- Bigger refactors (one shared frame for two windows, sharing Upscaler rules between the main part and
  the screen, re-render savings in the mod list): useful, but more risk than gain for now.
