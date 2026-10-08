import path from 'path';

// Since Electron 43 file dialogs open in Downloads unless they are told where to start.
// Before, Windows opened them where you were the last time: keep that by remembering
// the last folder a dialog was used in (while SSGL runs).
let last = '';

// where a dialog should start: suggested = a file name, a full path or nothing
export const startIn = suggested => {
  if (suggested && path.isAbsolute(suggested)) return suggested;
  if (!last) return suggested || undefined;
  return suggested ? path.join(last, suggested) : last;
};

// remember the folder of what was chosen (a chosen folder is remembered itself)
export const remember = (chosen, isFolder = false) => {
  if (!chosen) return;
  last = isFolder ? chosen : path.dirname(chosen);
};
