const { app, BrowserWindow } = require('electron');
const { OUT, APP, SHOTS, page } = require('../lib');
app.on('window-all-closed', () => {});
app.on('ready', async () => {
  const scene = process.argv[process.argv.length - 1];
  const w = new BrowserWindow({ width: 1275, height: 900, show: false, webPreferences: { nodeIntegration: true, webSecurity: false }, useContentSize: true });
  await w.loadURL(page(scene));
  await new Promise(r => setTimeout(r, 2500));
  const js = c => w.webContents.executeJavaScript(c);
  // open each dropdown of the page and test: is the first and the LAST option visible and is it what a click would hit?
  const names = JSON.parse(await js(`JSON.stringify(Array.from(document.querySelectorAll('input[type=hidden]')).filter(i => i.name && i.parentElement.querySelector('input[type=text][readonly]')).map(i => i.name))`));
  console.log('dropdowns on this screen:', names.join(', '));
  for (const name of names) {
    const res = await js(`(async () => {
      const hid = document.querySelector('input[type=hidden][name="${name}"]');
      const vis = hid.parentElement.querySelector('input[type=text]');
      vis.focus(); vis.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
      await new Promise(r => setTimeout(r, 200));
      const items = Array.from(hid.parentElement.querySelectorAll('li'));
      if (!items.length) return 'NO LIST OPENED';
      const probe = el => { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); return { inside: y < window.innerHeight, ok: !!hit && (hit === el || el.contains(hit) || hit.contains(el)) }; };
      const first = probe(items[0]), last = probe(items[items.length - 1]);
      vis.blur(); await new Promise(r => setTimeout(r, 250));
      return 'options=' + items.length + ' first clickable=' + first.ok + ' last clickable=' + (last.inside ? last.ok : 'below the window (n/a)');
    })()`);
    console.log('  ' + name.padEnd(18) + res);
  }
  app.quit();
});
