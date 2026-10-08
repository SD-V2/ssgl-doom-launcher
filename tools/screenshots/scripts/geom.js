const { app, BrowserWindow } = require('electron');
const { OUT, APP, SHOTS, page } = require('../lib');
app.on('window-all-closed', () => {});
app.on('ready', async () => {
  const scene = process.argv[process.argv.length - 1];
  const w = new BrowserWindow({ width: 1075, height: 610, show: false, webPreferences: { nodeIntegration: true, webSecurity: false }, useContentSize: true });
  await w.loadURL(page(scene));
  for (const wait of [1500, 2000, 3000, 5000]) {
    await new Promise(r => setTimeout(r, wait));
    const img = await w.webContents.capturePage();   // forces frames (the hidden test window only draws on demand)
    const g = await w.webContents.executeJavaScript(`(() => { const m = document.querySelector('.ssgl-modal'); const r = m.getBoundingClientRect(); return JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), transform: getComputedStyle(m).transform, opacity: getComputedStyle(m).opacity }); })()`);
    console.log(String(wait).padStart(5), 'ms later:', g);
  }
  app.quit();
});
