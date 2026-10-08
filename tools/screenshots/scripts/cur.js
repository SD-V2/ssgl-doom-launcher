const { app, BrowserWindow } = require('electron');
const { OUT, APP, SHOTS, page } = require('../lib');
const fs = require('fs');
app.on('window-all-closed', () => {});
app.on('ready', async () => {
  const items = [];
  for (const scene of process.argv.slice(2).filter(a => /,/.test(a))) {
    const w = new BrowserWindow({ width: 900, height: 420, show: false, webPreferences: { nodeIntegration: true, webSecurity: false }, useContentSize: true });
    await w.loadURL(page(scene));
    for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 500)); await w.webContents.capturePage(); }
    const info = JSON.parse(await w.webContents.executeJavaScript(`(() => {
      const body = getComputedStyle(document.body).cursor;
      const btn = document.querySelector('button') ? getComputedStyle(document.querySelector('button')).cursor : '(no button)';
      const txt = document.querySelector('input[type=text]:not([readonly])') ? getComputedStyle(document.querySelector('input[type=text]:not([readonly])')).cursor : '(none)';
      const ro = document.querySelector('.ssgl-input input[readonly]') ? getComputedStyle(document.querySelector('.ssgl-input input[readonly]')).cursor : '(none)';
      const panel = document.querySelector('.ssgl-panel'); const panelOutline = panel ? getComputedStyle(panel).outlineStyle : 'no panel';
      return JSON.stringify({ body, btn, txt, ro, panelOutline });
    })()`));
    const short = c => /url\(/.test(c) ? 'custom picture' + (c.match(/\)\s+(\d+ \d+)/) ? ', hotspot ' + c.match(/\)\s+(\d+ \d+)/)[1] : '') : c;
    console.log(scene.padEnd(34), 'body:', short(info.body).padEnd(34), '| button:', short(info.btn).padEnd(34), '| text box:', info.txt, '| dropdown box:', short(info.ro), '| panel styled:', info.panelOutline);
    items.push({ scene, body: info.body, btn: info.btn });
    w.destroy();
  }
  // a picture of the pointers, enlarged
  const w2 = new BrowserWindow({ width: 900, height: 330, show: false, webPreferences: { nodeIntegration: true } });
  const cards = items.filter(i => /url\(/.test(i.body)).map(i => ['arrow', 'hand'].map((k, n) => { const c = n === 0 ? i.body : i.btn; const url = (c.match(/url\("([^"]+)"\)/) || [])[1]; return `<div style="display:inline-block;width:200px;margin:10px;text-align:center"><div style="background:#111 url(${url ? '' : ''});padding:10px"><img src="${url}" width="128" height="128" style="image-rendering:pixelated;background:repeating-conic-gradient(#222 0 25%, #1a1a1a 0 50%) 0 0/16px 16px"></div><div style="color:#ccc;font:14px sans-serif">${i.scene.split(',')[3]} ${k}</div></div>`; }).join('')).join('');
  await w2.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<body style="margin:0;background:#080808">' + cards + '</body>'));
  await new Promise(r => setTimeout(r, 600)); await w2.webContents.capturePage();
  fs.writeFileSync(SHOTS + '/cursors.png', (await w2.webContents.capturePage()).toPNG());
  app.quit();
});
