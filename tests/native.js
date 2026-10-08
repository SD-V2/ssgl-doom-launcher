// The requests the screens send to the main part of the program (they replaced the old
// "remote" module, which Electron 14 removed): app/client/utils/native.js and
// app/electron/handlers/native.js
const fs = require('fs');
const path = require('path');
const Module = require('module');
const APP = require('./paths').APP + '';
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const wait = ms => new Promise(r => setTimeout(r, ms));

require('@babel/register')({
  presets: [[APP + '/node_modules/@babel/preset-env', { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'],
  only: [/app\/(client\/utils\/native|electron\/handlers\/native)/]
});

// a fake Electron: records what the two sides do
const sent = [];
const handlers = {};
let lastMenu = null;
let trashWorks = true;
const fake = {
  ipcRenderer: {
    invoke: async (ch, d) => { sent.push([ch, d]); return handlers[ch] ? handlers[ch]({ sender: {} }, d) : null; },
    sendSync: ch => (ch === 'native/appVersion' ? '9.9.9' : undefined)
  },
  ipcMain: { handle: (ch, f) => { handlers[ch] = f; }, on: (ch, f) => { handlers['sync:' + ch] = f; } },
  shell: {
    openExternal: async u => sent.push(['shell.openExternal', u]),
    showItemInFolder: f => sent.push(['shell.showItemInFolder', f]),
    openPath: async f => { sent.push(['shell.openPath', f]); return ''; },
    trashItem: async f => { sent.push(['shell.trashItem', f]); if (!trashWorks) throw new Error('no'); }
  },
  dialog: { showOpenDialog: async o => ({ canceled: false, filePaths: ['C:\\picked.png'], o }) },
  app: { getVersion: () => '9.9.9' },
  BrowserWindow: { fromWebContents: () => null },
  Menu: { buildFromTemplate: t => ({ popup: opts => { lastMenu = { template: t, opts }; } }) }
};
const origReq = Module.prototype.require;
Module.prototype.require = function (r) { return r === 'electron' ? fake : origReq.apply(this, arguments); };

(async () => {
  require(APP + '/electron/handlers/native.js');
  const native = require(APP + '/client/utils/native.js');

  check('the main part answers every request the screens send', ['native/openExternal', 'native/showItemInFolder', 'native/openPath', 'native/trashItem', 'native/showOpenDialog', 'native/popupMenu', 'sync:native/appVersion'].every(c => typeof handlers[c] === 'function'));

  await native.openExternal('https://github.com/SD-V2/ssgl-doom-launcher');
  await native.showItemInFolder('C:\\m\\a.pk3');
  await native.openPath('C:\\m');
  check('links, "show in folder" and "open" reach the shell of the main part', JSON.stringify(sent.filter(s => s[0].startsWith('shell.'))) === JSON.stringify([['shell.openExternal', 'https://github.com/SD-V2/ssgl-doom-launcher'], ['shell.showItemInFolder', 'C:\\m\\a.pk3'], ['shell.openPath', 'C:\\m']]));

  check('to the Recycle Bin: true when it worked', (await native.trashItem('C:\\m\\a.pk3')) === true);
  trashWorks = false;
  check('...false when it did not (the screen shows an error)', (await native.trashItem('C:\\m\\b.pk3')) === false);

  const picked = await native.showOpenDialog({ properties: ['openFile'] });
  check('the file picker answers { canceled, filePaths }', picked.canceled === false && picked.filePaths[0] === 'C:\\picked.png');

  check('the program version comes from the main part (About)', native.appVersion() === '9.9.9');

  // a right-click menu with a submenu, a separator, a disabled item
  const clicked = [];
  const p = native.popupMenu([
    { label: 'Section', submenu: [
      { label: 'Automatic', type: 'radio', checked: true, click: () => clicked.push('auto') },
      { type: 'separator' },
      { label: '1 · Monsters', type: 'radio', checked: false, click: () => clicked.push('monsters') }
    ] },
    { type: 'separator' },
    { label: 'Open', click: () => clicked.push('open') },
    { label: 'Delete folder', enabled: false, click: () => clicked.push('delete') }
  ]);
  await wait(20);
  const sentMenu = sent.filter(s => s[0] === 'native/popupMenu').pop()[1];
  check('the menu is sent without functions (they cannot be sent), with a number for each clickable item', JSON.stringify(sentMenu).indexOf('function') === -1 && sentMenu[0].submenu[2].clickId !== undefined && sentMenu[3].enabled === false);
  const t = lastMenu && lastMenu.template;
  check('the main part shows a real menu: same labels, ticks, separators, disabled item, submenu', t && t[0].label === 'Section' && t[0].submenu[0].checked === true && t[0].submenu[1].type === 'separator' && t[1].type === 'separator' && t[3].enabled === false && typeof t[2].click === 'function');
  t[0].submenu[2].click();
  await p;
  check('clicking "1 · Monsters" runs exactly that action on the screen side', clicked.join() === 'monsters');

  const p2 = native.popupMenu([{ label: 'Open', click: () => clicked.push('open') }]);
  await wait(20);
  lastMenu.opts.callback();          // the menu closes without a choice
  check('closing a menu without a choice runs nothing', (await p2) === null && clicked.join() === 'monsters');

  // files dragged in from Explorer: where they are on the disk
  check('a dropped file without Electron\'s webUtils (old way): its .path', native.pathOfFile({ path: 'C:\\m\\new.pk3' }) === 'C:\\m\\new.pk3' && native.pathOfFile(null) === '');
  fake.webUtils = { getPathForFile: f => (f.name === 'boom' ? (() => { throw new Error('x'); })() : 'D:\\Doom\\' + f.name) };
  check('...with webUtils (Electron 29 and newer, File.path is gone in 32): asks webUtils', native.pathOfFile({ name: 'maps.wad' }) === 'D:\\Doom\\maps.wad');
  check('...a file webUtils cannot place gives "" (it is left out, no crash)', native.pathOfFile({ name: 'boom' }) === '');
  const wads = fs.readFileSync(path.join(APP, 'client/views/Wads.jsx'), 'utf8');
  check('the Mods screen gets the paths of dropped files through pathOfFile (no f.path)', (wads.match(/\.map\(pathOfFile\)/g) || []).length === 2 && !/f => f\.path/.test(wads));

  // nothing in the screens uses the removed "remote" module any more
  const files = [];
  const walk = d => fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.jsx?$/.test(f)) files.push(p); });
  walk(path.join(APP, 'client'));
  const users = files.filter(f => /\bremote\s*\}\s*from\s*'electron'|\bremote\.(shell|dialog|Menu|app|getCurrentWindow)/.test(fs.readFileSync(f, 'utf8')));
  check('no screen uses the old "remote" module (' + (users.map(f => path.basename(f)).join(', ') || 'none') + ')', users.length === 0);
  const main = fs.readFileSync(path.join(APP, 'electron/main.js'), 'utf8');
  check('the window keeps nodeIntegration on and contextIsolation off, as the screens expect', /nodeIntegration: true/.test(main) && /contextIsolation: false/.test(main) && !/enableRemoteModule/.test(main));
  process.exit(0);
})();
