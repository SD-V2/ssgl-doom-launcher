import { ipcRenderer, webUtils } from 'electron';

// What the screens ask the main part of the program to do: open links and files, the
// Recycle Bin, the file picker, right-click menus (electron/handlers/native.js).
// Electron removed the "remote" module the screens used for this before.

const invoke = (channel, data) =>
  ipcRenderer && ipcRenderer.invoke ? ipcRenderer.invoke(channel, data) : Promise.resolve(null);

export const openExternal = url => invoke('native/openExternal', url);
export const showItemInFolder = file => invoke('native/showItemInFolder', file);
export const openPath = file => invoke('native/openPath', file);
// true when the file went to the Recycle Bin
export const trashItem = file => invoke('native/trashItem', file);
// the answer: { canceled, filePaths }
export const showOpenDialog = options => invoke('native/showOpenDialog', options);

// where a file dragged in from Explorer lives on the disk (Electron 32 removed File.path;
// webUtils.getPathForFile is the replacement)
export const pathOfFile = file => {
  if (!file) return '';
  if (webUtils && webUtils.getPathForFile) {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch (e) {
      return '';
    }
  }
  return file.path || '';
};

let version = null;
export const appVersion = () => {
  if (version === null) {
    version = ipcRenderer && ipcRenderer.sendSync ? ipcRenderer.sendSync('native/appVersion') || '' : '';
  }
  return version;
};

// A right-click menu, written like Electron's Menu templates ({ label, type, checked,
// enabled, click, submenu }). The click functions stay here; the main part shows the menu
// and answers which item was clicked.
export const popupMenu = async template => {
  const clicks = [];
  const prepare = items =>
    items.map(({ click, submenu, ...item }) => {
      const out = { ...item };
      if (submenu) out.submenu = prepare(submenu);
      if (click) {
        out.clickId = clicks.length;
        clicks.push(click);
      }
      return out;
    });
  const chosen = await invoke('native/popupMenu', prepare(template));
  if (chosen !== null && chosen !== undefined && clicks[chosen]) clicks[chosen]();
  return chosen;
};
