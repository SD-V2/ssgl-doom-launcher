const { app, BrowserWindow } = require('electron');
const { OUT, APP, SHOTS, page } = require('../lib');
const fs = require('fs');
app.on('window-all-closed', () => {});
app.on('ready', async () => {
  const w = new BrowserWindow({ width: 1000, height: 560, show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }, useContentSize: true });
  await w.loadURL(page(process.argv[process.argv.length - 1]));
    w.webContents.focus(); // counts as focused, like the visible program (see shot.js)
  for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 400)); await w.webContents.capturePage(); }
  const js = c => w.webContents.executeJavaScript(c);
  console.log('canvas:', await js(`(() => { const c = Array.from(document.querySelectorAll('canvas')).find(x => getComputedStyle(x).position === 'fixed'); if (!c) return 'NONE'; const s = getComputedStyle(c); return JSON.stringify({ size: c.width + 'x' + c.height, pointerEvents: s.pointerEvents, zIndex: s.zIndex, ariaHidden: c.getAttribute('aria-hidden') }); })()`));
  const lit = `(() => { const c = Array.from(document.querySelectorAll('canvas')).find(x => getComputedStyle(x).position === 'fixed'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n; })()`;
  console.log('lit pixels before moving:', await js(lit));
  // move the mouse along a curve
  await js(`(() => { window.__path = []; for (let i = 0; i <= 40; i++) { const t = i / 40; window.__path.push([120 + t * 700, 300 + Math.sin(t * 6) * 90]); } })()`);
  await js(`(async () => { for (const [x, y] of window.__path) { window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true })); await new Promise(r => setTimeout(r, 12)); } })()`);
  await w.webContents.capturePage();
  console.log('lit pixels right after a mouse move:', await js(lit));
  fs.writeFileSync(SHOTS + '/trail_move.png', (await w.webContents.capturePage()).toPNG());
  // a click
  await js(`window.dispatchEvent(new MouseEvent('mousedown', { clientX: 500, clientY: 200, bubbles: true }))`);
  await new Promise(r => setTimeout(r, 90)); await w.webContents.capturePage(); await new Promise(r => setTimeout(r, 60));
  fs.writeFileSync(SHOTS + '/trail_click.png', (await w.webContents.capturePage()).toPNG());
  console.log('lit pixels during a click:', await js(lit));
  // everything fades out
  for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 300)); await w.webContents.capturePage(); }
  console.log('lit pixels 2 seconds later:', await js(lit));
  console.log('pointer events pass through the canvas (the thing under the mouse is not the canvas):', await js(`document.elementFromPoint(500, 300).tagName !== 'CANVAS'`));
  app.quit();
});
