# Tools > Upscaler

Makes the pictures of a mod bigger with an AI program (the **engine**) on the graphics card and saves them as a
**new mod** (PK3) in the WAD folder. The source mod is never changed. Everything runs on the PC; nothing is uploaded.

**Step 1 (this version):** mods whose pictures are PNG or JPG files - PK3 / ZIP files and mod folders.
Mods that keep their pictures in Doom's own picture format inside a WAD are listed as "Not supported yet - coming next"
(step 2). See the plan at the end.

## Where the code is

| part | file |
|---|---|
| the screen | `client/views/Tools/index.jsx` (cards), `client/components/Upscaler/` (`index.jsx` screen, `Compare.jsx` before/after slider, `Watcher.jsx` end-of-job message on every screen, `parts.jsx` looks), `client/utils/upscale.js` (helpers) |
| messages screen <-> main part | `electron/handlers/upscaler.js` (channels `upscaler/...`) |
| the work | `electron/utils/upscaler.js`: source readers, collect, models, command line, progress parser, PK3 plan + TEXTURES, job (batches, pause, cancel, out of memory), preview, test run |
| PNG | `electron/utils/png.js`: chunks, `grAb` read/write, decode (all PNG kinds) / encode, edge clean-up (`bleed`), `halve`, `hardenAlpha` |
| zip | `electron/utils/archive.js` (reading, also used by the conflict and broken-file checkers), `electron/utils/zipwrite.js` (writing, with zip64) |
| download | `electron/utils/engineDownload.js` |
| "a game started" | `electron/utils/games.js` (called from `utils/play.js`) |
| checks | `tests/upscaler.js` (the whole pipeline with `tests/fixtures/fake-esrgan.js`), `tests/tools.js` (screens) |
| pictures | `tools/screenshots`: scenes `tools`, `up-none`, `up-dlg`, `up-download`, `up-ready`, `up-wad`, `up-preview`, `up-running`, `up-paused`, `up-done`, `up-error` |

All pure JavaScript (Node's own `zlib`), no native modules. The heavy parts run outside the screen: the engine is its
own process (at **below-normal priority**), and PNG packing/unpacking runs in zlib's worker threads.

## Source readers (the design for step 2)

Every kind of source has a small reader with the same interface:

```
reader = { id, canRead(source, type), listImages(source) -> { images, doomFormat } }
image  = { kind: 'texture' | 'flat' | 'sprite' | 'graphic' | 'other', name, path, width, height,
           format: 'png' | 'jpg', alpha, bytes, readPng() -> Buffer }
```

- `zip` (PK3, ZIP) and `folder` read PNG/JPG files. The kind comes from the top folder: `textures/` and `patches/` =
  texture, `flats/` = flat, `sprites/` = sprite, `graphics/` = graphic, everything else = other. `name` is the name
  GZDoom uses: the file name without extension, at most 8 letters, upper case.
- Files in those folders that are **not** PNG/JPG (Doom's own picture format, `.lmp`, no extension) are listed in
  `doomFormat` and shown as "coming next".
- `wad` exists already and says `supported: false`. **Step 2 only fills it in**: it reads the WAD directory
  (`archive.js` already lists lumps), finds pictures between the markers (`S_START`/`S_END`, `F_START`/`F_END`,
  `P_START`/`P_END`, `TEXTURE1/2` + `PNAMES`, and graphics by name), and its `readPng()` turns a Doom picture into a PNG
  (with the palette from `PLAYPAL` of the mod or the IWAD, and the picture's offsets as a `grAb` chunk). Nothing
  after `readPng()` needs to change.

## The engine

**realesrgan-ncnn-vulkan** (https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan): a portable program that runs on
NVIDIA, AMD and Intel graphics cards through Vulkan and comes with its models.

Command line used (from its README and `src/main.cpp`):

```
realesrgan-ncnn-vulkan -i <in folder> -o <out folder> -n <model> -s <scale> -t <tile> -m <models folder> -f png -v
```

Things learned from its source code:
- `-s` picks the **file** only for `realesr-animevideov3` (`...-x2/-x3/-x4.param`). Every other model is a fixed 4x
  network: SSGL runs it with `-s 4`, and for 2x shrinks the result with a soft [1 3 3 1] filter in premultiplied
  colours (no dark edges).
- The models folder path must contain the word `models` (otherwise "unknown model dir type").
- On Windows the paths of the model files may be at most 255 characters.
- Transparency **is kept**: the alpha channel is enlarged with a plain bicubic filter (not the AI).
- `-v` prints `<in> -> <out> done` per picture; it also prints `12.50%` lines per tile. Out of memory shows up as
  `vkAllocateMemory failed` / `vkQueueSubmit failed`; no Vulkan as `vkCreateInstance failed` / `invalid gpu device`.

SSGL runs the engine in **batches** (24 pictures or 8 megapixels). When a batch fails with "out of memory" it is tried
again with smaller tiles (auto -> 100 -> 64 -> 32) before giving up. Cancel kills the whole process tree
(`taskkill /T /F` on Windows). When a game is started from SSGL the engine is stopped and the batch is done again
after the game is closed (or when you press "Go on now").

### Download

"Download the engine" asks first (address, size, license) and then downloads **only** from
`https://github.com/xinntao/Real-ESRGAN/releases/download/...`. It looks up the release list
(`api.github.com/repos/xinntao/Real-ESRGAN/releases`) and takes the **newest release that has the program for this
system** (`realesrgan-ncnn-vulkan-*-windows.zip`). Today that is v0.2.5.0 (2022-04-24): the newer v0.3.0 has only
`.pth` models, no program. Nothing is bundled in this repository. The zip is unpacked into a new folder, checked
(program + models), and only then put in place of the old engine folder; a test run (a 16 x 16 picture) tells whether
it starts on this PC.

Default engine folder: `<SSGL data folder>\tools\realesrgan` (the "SSGL data folder" of Settings). "Choose the folder
myself" accepts any folder that has the program (also one folder down, as zips unpack) and a `models` folder.

### Models and licenses

| model (real name) | shown as | scales | license |
|---|---|---|---|
| `realesrgan-x4plus-anime` (default) | Drawn / anime - often best for sprites | 4x (2x by shrinking) | BSD-3-Clause (Real-ESRGAN) |
| `realesrgan-x4plus` | General - photos and detailed textures | 4x (2x by shrinking) | BSD-3-Clause (Real-ESRGAN) |
| `realesr-animevideov3` | Fast - 2x, 3x, 4x | 2x, 3x, 4x | BSD-3-Clause (Real-ESRGAN) |
| `realesrnet-x4plus` (if added by hand) | Smooth - less sharpening | 4x | BSD-3-Clause (Real-ESRGAN) |
| `realesr-general-x4v3` (if converted by hand) | General, small and fast | 4x | BSD-3-Clause (Real-ESRGAN) |

Any other `.param` + `.bin` pair in the models folder is listed with its real name.

- Engine program: **MIT** (Real-ESRGAN-ncnn-vulkan, Xintao Wang). It uses ncnn (Tencent, BSD-3-Clause), libwebp
  (BSD-3-Clause) and stb (public domain / MIT). The Windows zip also contains Microsoft's `vcomp140.dll` (OpenMP runtime).
- Models: **BSD-3-Clause**, Real-ESRGAN by Xintao Wang, Liangbin Xie, Chao Dong, Ying Shan (Tencent ARC Lab),
  https://github.com/xinntao/Real-ESRGAN.

The screen shows the notice "For your own use. Upscaled copies of other people's graphics should not be shared." and
the credits above.

## What goes into the new PK3, and why

Name: `<mod name> upscale 2x.pk3` (or 4x) in the WAD folder, subfolder **`8_UPSCALE`** by default (setting "Folder for
upscales"; a folder you already have with "upscale" in its name is offered first). The sections put it into
"Textures and upscales" by themselves (`tests/upscaler.js` checks this). Never over an existing file: ` (2)`, ` (3)`...
It is written as `.~<name>.upscaling` (a hidden name the mod list ignores) and renamed at the end; a crash cannot leave a
half-made mod. Temp folders (`ssgl-upscale-*` in the system temp folder) are removed after every run, cancel or error,
and left-overs of a crash at the next start.

How GZDoom replaces pictures (checked in its source: `src/common/textures/texturemanager.cpp`
`AddHiresTextures`, `multipatchtexturebuilder.cpp` (TEXTURES) and `src/common/filesystem/source/filesystem.cpp`):
- A picture in **`hires/`** replaces **every** texture with the same name (wall texture, flat, sprite, graphic...),
  shown at the size of the original; its offsets are taken from the original and scaled.
- The folder decides: a path that **starts** with `hires/` (subfolders are fine) is a hires picture; `upscaled/` is no
  special folder, its files are only used through TEXTURES. A picture's name is its file name up to the last dot, at
  most 8 letters, upper case.
- A **TEXTURES** definition (`WallTexture`, `Flat`, `Sprite`, `Graphic`) replaces only the texture of that name **and
  type**. Its size is in the new pixels; `XScale` / `YScale` bring it back to the original size; `Offset` is in the new
  pixels too.

So SSGL writes:

| picture | goes to | why |
|---|---|---|
| textures (`textures/`, `patches/`), flats, other | `hires/<same path>.png` | GZDoom scales them back to the original size by itself; folder path and file name kept |
| sprites, graphics | `upscaled/<same path>.png` + a TEXTURES entry | type-specific, the offsets are written explicitly (and `upscaled/` is no special folder, so the big picture is not loaded as a sprite itself) |
| a name used by a flat **and** a texture in the mod | `upscaled/...` + TEXTURES for **both** (`Flat` and `WallTexture`) | `hires/` would put one picture on both (the known mix-up) |
| the same name and kind twice | only the last one (in path order) | that is the one GZDoom uses |
| an "other" picture with the name of a sprite / texture | left out | GZDoom applies `hires/` **after** TEXTURES of the same file (`texturemanager.cpp`), it would cover the sprite |

Example TEXTURES entry (2x, a sprite 41 x 57 with offsets 20, 54):

```
Sprite "DEMOA1", 82, 114
{
	XScale 2
	YScale 2
	Offset 40, 108
	Patch "upscaled/sprites/DEMOA1.png", 0, 0
}
```

Walls and flats from TEXTURES also get `WorldPanning`, so scrolling and offsets in maps stay as in the original.
The file is `TEXTURES.txt`; `ssgl/upscale-info.txt` says where it came from (source, model, scale, date) and repeats the
"own use" note.

PNG details:
- **Offsets**: the `grAb` chunk of the original PNG is read and written into the new PNG multiplied by the scale (the
  engine drops all such chunks). ZDoom's `alPh` chunk is kept.
- **Transparency**: the colour hidden under see-through pixels (often black or cyan) would be smeared into the edges by
  the AI. Before the engine, SSGL spreads the edge colours into the see-through area (`bleed`); the alpha is not
  changed. After the engine, pictures that had only fully solid / fully see-through pixels (classic sprites) get hard
  edges again (`hardenAlpha`, at 50 %). Measured with the real engine on a test sprite on cyan: 34 cyan-tinted edge
  pixels without the clean-up, 0 with it.
- Fully solid pictures are sent as RGB (faster); JPG pictures become PNG.
- All output is PNG. Pictures are stored in the PK3 without extra packing (PNG is packed already).

Size estimate (shown before the start, a question above 500 MB, and a check of the free space):
`pixels x scale^2 x (3 or 4 bytes) x 0.55` - AI pictures pack about half as well as the original pixel art.

## What was tested here, and what the owner checks in GZDoom

Tested in this container: the whole pipeline with the fake engine (`tests/upscaler.js`), and the **real**
realesrgan-ncnn-vulkan (official Linux zip, installed with SSGL's own download code) on a software Vulkan driver:
download + unpack + test run, a real job with the anime and the fast model (sizes, `grAb` x2, hard edges, TEXTURES).
**Not tested:** GZDoom itself (no game here) and the Windows program on a real graphics card.

Check in GZDoom (a small mod with PNG sprites and textures, for example a weapon or monster pack):
1. Make a 2x upscale, put the new mod **after** the original in the load order (the "Textures and upscales" section is
   after Main mod, Monsters and Weapons).
2. Walls and floors: sharper, same size as before, textures line up as before.
3. Monsters, weapons, items: sharper and standing on the floor. **Floating or sunken monsters = an offset problem.**
   The weapon on screen must sit where it was.
4. Menus / status bar (graphics): same place and size.
5. Edges of monsters: no dark or coloured outline.

## Plan

**Step 2 - pictures in WAD files.** Fill in the `wad` reader: lump directory (done in `archive.js`), markers for sprites
/ flats / patches, `PNAMES` + `TEXTURE1/2` for wall textures, the Doom picture format (columns of posts) and flats
(64 x 64 raw bytes) -> PNG with the palette (`PLAYPAL` of the mod, else of the IWAD chosen in SSGL) and the offsets as
`grAb`. Patch-built textures (`TEXTURE1`) are composed from their patches first, then upscaled as one texture.
Also: PNG files inside a WAD, and Doom-format pictures inside PK3s (the "skipped for now" count).

**Step 3 - finer control.** Read the mod's own TEXTURES lumps (composite textures, sprites defined there with their own
offsets) and write matching scaled definitions; per-picture choices (skip, other model), a light "sharpen / no
sharpen" option, resume a stopped job, the result in a chosen place in the load order, a speed hint per graphics card
(tile size, threads `-j`), and "make again with another model" for single pictures.
