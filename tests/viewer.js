// Tools > Graphics viewer: the screen (jsdom) talking to the real main part
// (electron/handlers/viewer.js) with made-up WADs: the list, kinds and search, only the rows on
// screen drawn and their thumbnails asked for, the big view, Save as PNG (with offsets), the
// game for the palette, "Open in SLADE" (hidden until the program is set).
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/#/tools', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage; global.HTMLElement = dom.window.HTMLElement; ['Element', 'Node', 'SVGElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver'].forEach(k => { if (dom.window[k] !== undefined && global[k] === undefined) global[k] = dom.window[k]; });
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const APP = require('./paths').APP + '';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl-viewer-'));
const W = require('./fixtures/wadmaker.js');

// the main part: real handlers, Electron faked around them
const H = {};
const calls = [];
let saveTo = '';
const electron = {
  app: { getPath: () => TMP },
  ipcMain: { handle: (ch, f) => { H[ch] = f; }, on() {} },
  BrowserWindow: { fromWebContents: () => null, getAllWindows: () => [] },
  dialog: { showSaveDialog: async () => (saveTo ? { canceled: false, filePath: saveTo } : { canceled: true }) },
  ipcRenderer: {
    send() {},
    sendSync: require('./native-mock').sendSync,
    invoke: require('./native-mock').wrap(async (ch, d) => {
      calls.push([ch, d]);
      if (H[ch]) return H[ch]({ sender: {} }, d);
      if (ch === 'upscaler/state') return { data: null, error: null };
      return { data: null, error: null };
    }),
    on() {},
    removeListener() {}
  }
};
const origReq = Module.prototype.require;
Module.prototype.require = function (req) {
  if (req === 'electron') return electron;
  if (req.startsWith('#/')) req = path.join(APP, 'client', req.slice(2));
  return origReq.call(this, req);
};
['.svg', '.png', '.jpg', '.mp3', '.gif', '.css', '.ogg', '.wav', '.woff', '.woff2', '.ttf', '.eot'].forEach(ext => { require.extensions[ext] = m => { m.exports = 'stub' + ext; }; });
require('@babel/register')({
  presets: [APP + '/node_modules/@babel/preset-env', APP + '/node_modules/@babel/preset-react'],
  plugins: [APP + '/node_modules/@babel/plugin-transform-runtime', APP + '/node_modules/babel-plugin-styled-components'],
  babelrc: false, configFile: false, cache: false, extensions: ['.js', '.jsx'],
  only: [new RegExp(APP.replace(/\//g, '\\/') + '\\/(client|electron)')]
});
const React = require(APP + '/node_modules/react');
const ReactDOM = require(APP + '/node_modules/react-dom');
const { Simulate } = require(APP + '/node_modules/react-dom/test-utils');
const { ThemeProvider } = require(APP + '/node_modules/styled-components');
const themes = require(APP + '/client/Theme/index.jsx').default;
const { StoreContext, initState } = require(APP + '/client/state');
const Tools = require(APP + '/client/views/Tools/index.jsx').default;
const viewer = require(APP + '/electron/handlers/viewer.js');
const png = require(APP + '/electron/utils/png.js');
const pic = require(APP + '/electron/utils/doom/picture.js');
const V = require(APP + '/client/components/Viewer/index.jsx');
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // ---- made-up files: a big mod without a palette, a game with one ------------------------------
  const lumps = [{ name: 'S_START' }];
  for (let i = 0; i < 480; i++) lumps.push({ name: 'SP' + String(i).padStart(3, '0') + 'A0', data: W.picture([[i & 255, -1], [7, 8]], { left: i === 0 ? 3 : 0, top: i === 0 ? -2 : 0 }) });
  lumps.push({ name: 'S_END' }, { name: 'F_START' }, { name: 'FLAT1', data: W.flat(64) }, { name: 'FLAT2', data: W.flat(64) }, { name: 'F_END' }, { name: 'TITLEPIC', data: W.picture([[1, 2, 3]]) });
  const modFile = path.join(TMP, 'bigmod.wad');
  fs.writeFileSync(modFile, W.wad(lumps));
  const game = path.join(TMP, 'DOOM2.WAD');
  fs.writeFileSync(game, W.wad([{ name: 'PLAYPAL', data: W.palette() }], 'IWAD'));

  // ---- the main part on its own ------------------------------------------------------------------
  const opened = (await H['viewer/open']({}, modFile)).data;
  check('main: open lists every picture with kind, type, size and offsets', opened.entries.length === 483 && opened.entries[0].kind === 'sprite' && opened.entries[0].type === 'picture' && opened.entries[0].left === 3 && opened.entries.find(e => e.name === 'FLAT1').type === 'flat' && opened.palette === '');
  const noPal = (await H['viewer/thumbs']({}, { source: modFile, ids: [0] })).data[0];
  check('main: without a palette a thumbnail says why (no crash)', noPal.error === 'noPalette');
  await H['viewer/settings']({}, { palette: game });
  const th = (await H['viewer/thumbs']({}, { source: modFile, ids: [0, 481], size: 96 })).data;
  const t0 = png.decode(Buffer.from(th[0].url.split(',')[1], 'base64'));
  check('main: thumbnails made bigger with whole pixels (2x2 sprite -> 96x96), a flat made to fit', th.length === 2 && t0.width === 96 && t0.height === 96 && png.decode(Buffer.from(th[1].url.split(',')[1], 'base64')).width === 96);
  const small = viewer.fit({ width: 4, height: 2, data: Buffer.from([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0]) }, 2);
  check('main: made smaller by averaging, see-through stays see-through', small.width === 2 && small.height === 1 && small.data[0] === 255 && small.data[3] === 255 && small.data[7] === 0);
  const asked = Array.from({ length: 300 }, (_, i) => i);
  check('main: at most 200 thumbnails per request', (await H['viewer/thumbs']({}, { source: modFile, ids: asked })).data.length === 200);
  saveTo = path.join(TMP, 'saved.png');
  const sv = (await H['viewer/save']({ sender: {} }, { source: modFile, id: 0 })).data;
  check('main: Save as PNG writes the picture with its offsets (grAb)', sv.file === saveTo && JSON.stringify(pic.pngOffsets(fs.readFileSync(saveTo))) === '{"left":3,"top":-2}');
  check('main: "Open in SLADE" without a SLADE program: a clear answer', (await H['viewer/slade']({}, modFile)).error === 'noSlade');
  const fakeSlade = path.join(TMP, 'slade.sh');
  const mark = path.join(TMP, 'slade-was-here.txt');
  fs.writeFileSync(fakeSlade, '#!/bin/sh\necho "$1" > ' + JSON.stringify(mark) + '\n');
  fs.chmodSync(fakeSlade, 0o755);
  check('main: SLADE is started as its own program with the file', JSON.stringify(viewer.sladeCommand('C:\\SLADE\\SLADE.exe', 'C:\\Doom\\x.wad').args) === '["C:\\\\Doom\\\\x.wad"]');
  await H['viewer/settings']({}, { palette: '' });

  // ---- the screen ---------------------------------------------------------------------------------
  const host = document.createElement('div'); document.body.appendChild(host);
  const st = { ...initState, iwads: [{ id: 'd2', name: 'DOOM2', kind: 'WAD', path: game }], mods: [{ id: 'm', name: 'bigmod', kind: 'WAD', path: modFile, folders: [], folder: '', tags: [] }], settings: { ...initState.settings, modpath: TMP } };
  ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: st, dispatch() {} } }, React.createElement(Tools))), host);
  await wait(150);
  const q = sel => Array.from(host.querySelectorAll(sel));
  const text = () => host.textContent;
  const btn = label => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === label);
  const openDrop = name => Simulate.focus(q('input').find(i => i.name === name).parentElement.querySelector('input[type=text]'));
  const pick = async (name, label) => { openDrop(name); await wait(50); const box = q('input').find(i => i.name === name).parentElement; Simulate.click(Array.from(box.querySelectorAll('li')).find(li => li.textContent.trim() === label)); await wait(250); };

  check('Tools: the "Graphics viewer" card', !!host.querySelector('[data-tool="viewer"]') && /Graphics viewer/.test(text()));
  Simulate.click(host.querySelector('[data-tool="viewer"] button')); await wait(150);
  check('...opens the viewer; SLADE button hidden (no program set), "SLADE program..." offered', host.querySelector('[data-viewer]').getAttribute('data-viewer') === 'start' && !host.querySelector('[data-slade]') && !!host.querySelector('[data-slade-set]'));
  openDrop('viewerSource'); await wait(50);
  check('...the games (IWADs) and mods SSGL knows are offered', q('li').map(l => l.textContent.trim()).join('|') === 'DOOM2 (WAD)|bigmod (WAD)');
  await pick('viewerSource', 'bigmod (WAD)');
  check('a file without a palette: listed, "choose the game for the colors"', host.querySelector('[data-viewer]').getAttribute('data-viewer') === 'list' && /483 pictures \(483 shown\)/.test(text()) && host.querySelector('[data-viewer-palette]').getAttribute('data-viewer-palette') === 'need');
  const cells = q('[data-entry]');
  check(`only the rows on screen are drawn (${cells.length} of 483)`, cells.length > 10 && cells.length < 80);
  await wait(150);
  const thumbCalls = calls.filter(c => c[0] === 'viewer/thumbs');
  check('thumbnails are asked for the drawn cells only, in one batch', thumbCalls.length === 1 && thumbCalls[0][1].ids.length === cells.length);
  check('...without a palette the cells say "cannot be shown"', /cannot be shown/.test(q('[data-entry]')[1].textContent));
  check('a cell: name, type, size, offset', /SP000A0/.test(cells[0].textContent) && /Doom graphic - 2x2/.test(cells[0].textContent) && /offset 3, -2/.test(cells[0].textContent));

  // the grid gets its real size right after opening (the window lays out): the thumbnails must
  // still come (a bug: the first request was cancelled and never sent again)
  const gridEl = host.querySelector('[data-viewer-grid]');
  const thumbsBefore = calls.filter(c => c[0] === 'viewer/thumbs').length;
  await pick('viewerSource', 'DOOM2 (WAD)');
  openDrop('viewerSource'); await wait(50);
  Simulate.click(Array.from(q('input').find(i => i.name === 'viewerSource').parentElement.querySelectorAll('li')).find(li => li.textContent.trim() === 'bigmod (WAD)'));
  for (let k = 0; k < 2000 && !host.querySelector('[data-entry="SP000A0"]'); k++) await wait(1);
  // the list is there and its first thumbnail request is waiting: now the window lays out
  Object.defineProperty(gridEl, 'clientWidth', { configurable: true, get: () => 600 });
  window.dispatchEvent(new window.Event('resize')); await wait(300);
  const drawn = q('[data-entry]');
  check('the grid gets smaller right after opening: every drawn cell still gets its thumbnail (or says why not)', drawn.length > 5 && drawn.every(c => !!c.querySelector('.pic img') || !!c.querySelector('.pic .meta')) && calls.filter(c => c[0] === 'viewer/thumbs').length > thumbsBefore);
  Object.defineProperty(gridEl, 'clientWidth', { configurable: true, get: () => 0 });
  window.dispatchEvent(new window.Event('resize')); await wait(100);
  await pick('viewerPalette', 'DOOM2 (WAD)');
  check('choosing the game: saved, the file read again with its colours', calls.some(c => c[0] === 'viewer/settings' && c[1] && c[1].palette === game) && host.querySelector('[data-viewer-palette]').getAttribute('data-viewer-palette') === 'iwad');
  await wait(150);
  const firstImg = host.querySelector('[data-entry="SP000A0"] img');
  check('...now the thumbnails are pictures', !!firstImg && /^data:image\/png;base64,/.test(firstImg.getAttribute('src')));

  const grid = host.querySelector('[data-viewer-grid]');
  const before = calls.filter(c => c[0] === 'viewer/thumbs').length;
  grid.scrollTop = 168 * 40; Simulate.scroll(grid); await wait(200);
  check('scrolling down: other rows drawn, their thumbnails asked for', !!host.querySelector('[data-entry="SP300A0"]') || !!host.querySelector('[data-entry="SP290A0"]') ? calls.filter(c => c[0] === 'viewer/thumbs').length === before + 1 && !host.querySelector('[data-entry="SP000A0"]') : false);

  await pick('viewerKind', 'Flats (2)');
  check('filter by kind: only the flats', q('[data-entry]').length === 2 && q('[data-entry]').every(c => c.getAttribute('data-kind') === 'flat') && /483 pictures \(2 shown\)/.test(text()));
  await pick('viewerKind', 'Everything (483)');
  const search = q('input').find(i => i.name === 'viewerSearch');
  Simulate.change(search, { target: { value: 'title' } }); await wait(100);
  check('search by name', q('[data-entry]').length === 1 && q('[data-entry]')[0].getAttribute('data-entry') === 'TITLEPIC');
  Simulate.change(search, { target: { value: '' } }); await wait(50);

  grid.scrollTop = 0; Simulate.scroll(grid); await wait(100);
  Simulate.click(host.querySelector('[data-entry="SP000A0"]')); await wait(200);
  const bigView = document.querySelector('[data-viewer-big]');
  const bigImg = bigView && bigView.querySelector('img');
  check('click: the big view - the picture made bigger with whole pixels, name, kind, offset', !!bigImg && bigImg.style.width === (2 * V.zoomFor(2, 2)) + 'px' && V.zoomFor(2, 2) === 8 && /SP000A0 - Sprites - Doom graphic - 2x2 - offset 3, -2/.test(bigView.textContent));
  check('...the zoom fits big pictures (whole times, at least 1x)', V.zoomFor(320, 200) === 3 && V.zoomFor(2048, 2048) === 1);
  saveTo = path.join(TMP, 'saved2.png');
  Simulate.click(btn('Save as PNG')); await wait(150);
  check('...Save as PNG: written, and the screen says where', fs.existsSync(saveTo) && /Saved: /.test(document.querySelector('[data-viewer-big]').textContent));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })); window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })); await wait(50);
  check('...Escape closes it', !document.querySelector('[data-viewer-big]'));

  await H['viewer/settings']({}, { slade: fakeSlade });
  ReactDOM.unmountComponentAtNode(host);
  ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: st, dispatch() {} } }, React.createElement(Tools))), host);
  await wait(200);
  await pick('viewerSource', 'bigmod (WAD)');
  check('with a SLADE program set: "Open in SLADE" is shown', !!host.querySelector('[data-slade]'));
  Simulate.click(host.querySelector('[data-slade]')); await wait(400);
  check('...and starts SLADE with the file', fs.existsSync(mark) && fs.readFileSync(mark, 'utf8').trim() === modFile);
  check('the viewer opened last stays open when coming back to Tools', host.querySelector('[data-viewer]') !== null);

  ReactDOM.unmountComponentAtNode(host);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
