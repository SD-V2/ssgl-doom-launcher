// A screen coming in after a tab switch: records every frame of the first 600 ms (where
// the screen is, how visible it is) and saves a few pictures along the way.
//   node run.js tab "settings,en,nightcity,cyberpunk"
// Pictures: out/shots/tab_<scene>_<ms>.png   (NAME=old node run.js tab ... adds "old" to the names)
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { SHOTS, page } = require('../lib');
app.on('window-all-closed', () => {});
app.on('ready', async () => {
  const scene = process.argv[process.argv.length - 1];
  const [w0, h0] = (process.env.SIZE || '1075x610').split('x').map(Number);
  // shown (on the virtual screen), so the page draws every frame like the real app
  const w = new BrowserWindow({ width: w0, height: h0, show: true, webPreferences: { nodeIntegration: true, webSecurity: false, backgroundThrottling: false }, useContentSize: true });
  await w.loadURL(page(scene));
  await new Promise(r => setTimeout(r, 1500));
  const tag = (process.env.NAME ? process.env.NAME + '_' : '') + scene.replace(/[^a-z0-9]+/gi, '_');
  // the page writes down every frame itself
  await w.webContents.executeJavaScript(`(() => {
    window.__log = []; const t0 = performance.now();
    const rec = () => { const v = document.querySelector('.ssgl-view'); const s = v && getComputedStyle(v);
      const m = s && s.transform !== 'none' ? new DOMMatrix(s.transform).m41 : 0;
      window.__log.push([Math.round(performance.now() - t0), Math.round(m * 10) / 10, s ? Math.round(s.opacity * 100) / 100 : '-']);
      if (performance.now() - t0 < 600) requestAnimationFrame(rec); };
    window.__remount(); requestAnimationFrame(rec); return 0; })()`);
  const t0 = Date.now();
  for (const at of [30, 80, 140, 220, 400]) {
    await new Promise(r => setTimeout(r, Math.max(0, at - (Date.now() - t0))));
    const img = await w.webContents.capturePage();
    fs.writeFileSync(path.join(SHOTS, 'tab_' + tag + '_' + at + '.png'), img.toPNG());
  }
  await new Promise(r => setTimeout(r, 700));
  const log = JSON.parse(await w.webContents.executeJavaScript('JSON.stringify(window.__log)'));
  const moving = log.filter(([, x, o]) => x !== 0 || o !== 1);
  const done = moving.length ? moving[moving.length - 1][0] : 0;
  log.forEach(([t, x, o]) => console.log(String(t).padStart(4) + ' ms   x ' + String(x).padStart(6) + ' px   opacity ' + o));
  console.log('frames: ' + log.length + ', settled after about ' + done + ' ms');
  app.quit();
});
