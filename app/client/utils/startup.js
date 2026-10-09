import { ipcRenderer } from 'electron';

// The screens' part of the startup timer (electron/utils/startup.js): every moment is
// sent once to the main part, which writes startup-log.txt.
const sent = {};

export const startupMark = (name, extra) => {
  if (sent[name]) return;
  sent[name] = true;
  try {
    ipcRenderer.send('startup/mark', { name, at: Date.now(), extra });
  } catch (e) {
    // no timer (tests)
  }
};

// after the next frame is really on the screen
export const afterPaint = fn => {
  if (typeof requestAnimationFrame !== 'function') return fn();
  requestAnimationFrame(() => setTimeout(fn, 0));
};
