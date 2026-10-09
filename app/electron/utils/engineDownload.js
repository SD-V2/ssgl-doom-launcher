import fs from 'fs';
import got from 'got';
import path from 'path';

import { listZipEntries, readZipEntry } from './archive';
import { isInside } from './safepath';
import { EXE, findEngine, removeDir } from './upscaler';

// "Download the engine" (Tools > Upscaler). Only after a click, and only from the
// official releases of the Real-ESRGAN project on github.com. The newest release
// that has the program for this system is used (no version is written in here).

export const PROJECT = 'https://github.com/xinntao/Real-ESRGAN';
export const RELEASES_API = 'https://api.github.com/repos/xinntao/Real-ESRGAN/releases?per_page=30';
export const OFFICIAL = 'https://github.com/xinntao/Real-ESRGAN/releases/download/';
const WORD = { win32: 'windows', darwin: 'macos', linux: 'ubuntu' };

// the release list from GitHub -> the newest zip for this system, or null
export const pickAsset = (releases, platform = process.platform) => {
  const word = WORD[platform] || 'windows';
  const re = new RegExp(`^realesrgan-ncnn-vulkan-[\\w.-]*${word}\\.zip$`, 'i');
  const list = (Array.isArray(releases) ? releases : [])
    .filter(r => r && !r.draft && !r.prerelease)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  for (const r of list) {
    const a = (r.assets || []).find(
      x => x && re.test(x.name) && String(x.browser_download_url).indexOf(OFFICIAL) === 0
    );
    if (a) {
      return {
        tag: r.tag_name,
        date: r.published_at,
        name: a.name,
        size: a.size,
        url: a.browser_download_url,
        page: r.html_url
      };
    }
  }
  return null;
};

export const findRelease = async () => {
  const releases = await got(RELEASES_API, {
    headers: { 'user-agent': 'SSGL', accept: 'application/vnd.github+json' },
    timeout: 20000
  }).json();
  return pickAsset(releases);
};

// download to a file; hold.stop() stops it
const download = (asset, file, onProgress, hold) =>
  new Promise((resolve, reject) => {
    if (String(asset.url).indexOf(OFFICIAL) !== 0) {
      reject(new Error('not the official address'));
      return;
    }
    const stream = got.stream(asset.url, { headers: { 'user-agent': 'SSGL' }, timeout: 60000 });
    const out = fs.createWriteStream(file);
    let failed = false;
    hold.stop = () => {
      failed = true;
      stream.destroy();
      out.destroy();
      reject(new Error('stopped'));
    };
    stream.on('downloadProgress', p => onProgress(p.transferred, p.total || asset.size));
    stream.on('error', e => {
      if (failed) return;
      failed = true;
      out.destroy();
      reject(e);
    });
    out.on('error', e => {
      if (failed) return;
      failed = true;
      stream.destroy();
      reject(e);
    });
    out.on('finish', () => {
      if (failed) return;
      const size = fs.statSync(file).size;
      if (asset.size && size !== asset.size) reject(new Error('download incomplete'));
      else resolve(size);
    });
    stream.pipe(out);
  });

// every file of the zip into a folder (nothing outside it)
export const unpack = async (zipFile, dir) => {
  const fd = fs.openSync(zipFile, 'r');
  try {
    const entries = listZipEntries(fd, fs.fstatSync(fd).size);
    for (const e of entries) {
      const target = path.join(dir, ...e.name.split(/[\\/]+/).filter(Boolean));
      if (!isInside(dir, target)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await readZipEntry(fd, e));
    }
  } finally {
    fs.closeSync(fd);
  }
};

// download + unpack + check; the old engine folder is only replaced when the new
// one is complete. -> findEngine() of the folder
export const install = async (asset, folder, onProgress = () => {}, hold = {}) => {
  const fresh = folder + '.new';
  const zip = folder + '.download.zip';
  fs.mkdirSync(path.dirname(folder), { recursive: true });
  removeDir(fresh);
  try {
    await download(asset, zip, onProgress, hold);
    await unpack(zip, fresh);
    const found = findEngine(fresh);
    if (!found.ok) {
      const err = new Error('the download has no ' + (found.problem === 'noExe' ? EXE : 'models folder'));
      err.code = found.problem;
      throw err;
    }
    if (process.platform !== 'win32') fs.chmodSync(found.exe, 0o755);
    const old = folder + '.old';
    removeDir(old);
    if (fs.existsSync(folder)) fs.renameSync(folder, old);
    fs.renameSync(fresh, folder);
    removeDir(old);
    return findEngine(folder);
  } finally {
    try {
      fs.unlinkSync(zip);
    } catch (e) {
      // not there
    }
    removeDir(fresh);
  }
};
