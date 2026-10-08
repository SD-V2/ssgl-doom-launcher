const { app, BrowserWindow } = require('electron');
const { OUT, APP, SHOTS, page } = require('../lib');
const fs = require('fs');
const scenes = process.argv.slice(2).filter(a => !a.startsWith('--') && !a.endsWith('shot.js'));
const size = (process.env.SIZE || '1075x610').split('x').map(Number);
app.on('window-all-closed', () => {});
app.on('ready', async () => {
  for (const scene of scenes) {
    const w = new BrowserWindow({ width: size[0], height: size[1], show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }, useContentSize: true });
    w.webContents.on('console-message', (e, level, msg, line, src) => { if (level >= 2) console.log('  [browser ' + (level === 2 ? 'warning' : 'error') + '] ' + String(msg).slice(0, 300)); });
    await w.loadURL(page(scene));
    // the page counts as focused, as in the real (visible) program: newer Chromium shows
    // :focus styles only in a focused page, and a hidden test window is not focused by itself
    w.webContents.focus();
    for (let i = 0; i < 40; i++) { if (await w.webContents.executeJavaScript('window.__ready === true')) break; await new Promise(r => setTimeout(r, 100)); }
    for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 500)); await w.webContents.capturePage(); }   // frames are only drawn on demand: let the animations run
    const img = await w.webContents.capturePage();
    const name = scene.replace(/[^a-z0-9]+/gi, '_');
    fs.writeFileSync(SHOTS + '/' + name + '.png', img.toPNG());
    console.log('shot', name, img.getSize().width + 'x' + img.getSize().height);
    w.destroy();
  }
  app.quit();
});
