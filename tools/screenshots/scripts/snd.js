const { app, BrowserWindow } = require('electron');
const { OUT, APP, SHOTS, page } = require('../lib');
const fs = require('fs');
app.on('window-all-closed', () => {});
app.on('ready', async () => {
  const dir = APP + '/client/assets/sounds/';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ogg'));
  const w = new BrowserWindow({ width: 400, height: 300, show: false, webPreferences: { nodeIntegration: true, webSecurity: false, autoplayPolicy: 'no-user-gesture-required' } });
  await w.loadURL(page('settings'));
  await new Promise(r => setTimeout(r, 1500));
  const code = '(async () => { const out = []; for (const f of ' + JSON.stringify(files) + ') { const a = new Audio("file://' + dir + '" + f); const r = await new Promise(res => { a.addEventListener("loadedmetadata", () => res("ok " + a.duration.toFixed(2) + "s")); a.addEventListener("error", () => res("ERROR " + (a.error && a.error.code))); setTimeout(() => res("timeout"), 4000); }); out.push(f.padEnd(26) + " " + r); } return JSON.stringify(out); })()';
  const res = JSON.parse(await w.webContents.executeJavaScript(code));
  console.log('sound files the browser can decode:', res.filter(x => / ok /.test(x)).length, 'of', res.length);
  res.forEach(x => console.log('  ' + x));
  app.quit();
});
