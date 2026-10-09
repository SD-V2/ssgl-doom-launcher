import { ipcRenderer } from 'electron';
import { useEffect, useState } from 'react';

import image from './image';
import { startupMark } from './startup';

// The wallpaper: decoded before it is shown (then it fades in, the first picture of the
// window never waits for it), and a picture much bigger than the screen is replaced by
// a copy in the size of the screen (made once in the background, kept in the data folder
// by electron/utils/wallpaper.js; the owner's picture is never changed).

const screenSize = () => {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const s = (typeof window !== 'undefined' && window.screen) || { width: 1920, height: 1080 };
  return { width: Math.round(s.width * dpr), height: Math.round(s.height * dpr) };
};

// the copy is made in a worker: decoding and shrinking never block the window
const WORKER = `self.onmessage = async e => {
  try {
    const { bytes, target } = e.data;
    const big = await createImageBitmap(new Blob([bytes]));
    const s = Math.min(1, target / Math.max(big.width, big.height));
    const w = Math.max(1, Math.round(big.width * s));
    const h = Math.max(1, Math.round(big.height * s));
    const small = await createImageBitmap(big, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(small, 0, 0);
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    const out = await blob.arrayBuffer();
    self.postMessage({ ok: true, bytes: out }, [out]);
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};`;

export const makeCopy = async (file, key, target) => {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return null;
  const fs = require('fs');
  const data = await fs.promises.readFile(file);
  const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
  const worker = new Worker(url);
  try {
    const res = await new Promise(resolve => {
      worker.onmessage = e => resolve(e.data);
      worker.onerror = e => resolve({ ok: false, error: e.message });
      worker.postMessage({ bytes, target }, [bytes]);
    });
    if (!res.ok) return null;
    const saved = await ipcRenderer.invoke('wallpaper/save', { key, bytes: new Uint8Array(res.bytes) });
    return saved && !saved.error ? saved.data : null;
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
};

const decoded = src =>
  new Promise(resolve => {
    if (typeof Image === 'undefined') return resolve(false);
    const img = new Image();
    img.src = src;
    if (typeof img.decode !== 'function') return resolve(true);
    img.decode().then(() => resolve(true), () => resolve(false));
  });

// file: the wallpaper setting ('' = SSGL's own picture, null = not known yet)
// late: the start is over (only then a copy is made)
// -> { src: the file to show, ready: decoded, it may fade in }
export const useWallpaper = (file, late) => {
  const [state, setState] = useState({ src: '', ready: false, make: null });
  useEffect(() => {
    if (file === null) return undefined; // the settings are not read yet
    let alive = true;
    setState({ src: '', ready: false, make: null });
    (async () => {
      let pick = { show: file || '', make: false };
      if (file) {
        try {
          const { width, height } = screenSize();
          const res = await ipcRenderer.invoke('wallpaper/choose', { file, width, height });
          if (res && res.data) pick = res.data;
        } catch (e) {
          // the original then
        }
      }
      const ok = pick.show ? await decoded(`file://${image(pick.show)}`) : true;
      if (!alive) return;
      startupMark('wallpaperDecoded', { wallpaperCopy: !!(file && pick.show !== file) });
      setState({ src: ok ? pick.show : file || '', ready: true, make: pick.make ? pick : null });
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  // the smaller copy for the next start, when the start is over
  useEffect(() => {
    if (!late || !state.make || !file) return;
    makeCopy(file, state.make.key, state.make.target).catch(() => null);
  }, [late, state.make, file]);

  return state;
};
