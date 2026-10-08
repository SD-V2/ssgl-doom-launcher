const fs = require('fs'); const path = require('path'); const os = require('os');
const Module = require('module'); const orig = Module.prototype.require; let dir = '';
Module.prototype.require = function (r) { if (r === 'electron') return { app: { getPath: () => dir }, ipcMain: { handle() {} } }; return orig.apply(this, arguments); };
require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/electron\/utils/] });
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const common = require((require('./paths').APP + '/electron/utils/common.js'));
dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl3-'));
const { getJSON, setJSON, takeRecovered } = require((require('./paths').APP + '/electron/utils/json.js'));
const f = n => common.getDataFile(n) + '.json';
(async () => {
  // basics: write / read / return value, nothing left behind
  const back = await setJSON('packages', [{ id: 'a' }]);
  t('setJSON returns the data (as before)', JSON.stringify(back) === '[{"id":"a"}]');
  t('read gives it back', (await getJSON('packages'))[0].id === 'a');
  t('first save: no copy yet, no temp files left', !fs.existsSync(f('packages') + '.bak') && fs.readdirSync(dir).every(x => !x.endsWith('.tmp')));
  await setJSON('packages', [{ id: 'b' }]);
  t('second save: the copy holds the version before', JSON.parse(fs.readFileSync(f('packages') + '.bak', 'utf8'))[0].id === 'a' && (await getJSON('packages'))[0].id === 'b');
  t('missing file still gives [] (as before)', JSON.stringify(await getJSON('nothing')) === '[]');

  // many saves at the same moment: the last one wins, file always valid
  const writes = []; for (let i = 0; i < 60; i++) writes.push(setJSON('settings', { n: i, big: 'x'.repeat(2000) }));
  await Promise.all(writes);
  t('60 overlapping saves -> last one wins, file is valid JSON', (await getJSON('settings')).n === 59);
  t('no temp files left after the burst', fs.readdirSync(dir).every(x => !x.endsWith('.tmp')));
  // a read started right after a save sees the new content
  const p = setJSON('settings', { n: 'fresh' }); const r = await getJSON('settings'); await p;
  t('a read right after a save waits and sees the new data', r.n === 'fresh');

  // power cut simulation 1: main file cut in half -> copy comes back
  await setJSON('packages', [{ id: 'good1' }]); await setJSON('packages', [{ id: 'good2' }]);   // bak = good1, main = good2
  const full = fs.readFileSync(f('packages'), 'utf8'); fs.writeFileSync(f('packages'), full.slice(0, Math.floor(full.length / 2)));
  const got = await getJSON('packages');
  t('half-written file -> last good copy is used', got[0].id === 'good1');
  t('window is told which file was restored', JSON.stringify(takeRecovered()) === '["packages"]' && takeRecovered().length === 0);
  t('real file is whole again', JSON.parse(fs.readFileSync(f('packages'), 'utf8'))[0].id === 'good1');
  t('damaged file kept for a look', fs.readdirSync(dir).some(x => x.startsWith('packages.json.damaged-')));
  // power cut simulation 2: empty file (0 bytes)
  fs.writeFileSync(f('packages'), '');
  t('empty file -> copy is used', (await getJSON('packages'))[0].id === 'good1' && takeRecovered().length === 1);
  // both bad
  fs.writeFileSync(f('packages'), '{oops'); fs.writeFileSync(f('packages') + '.bak', '{oops');
  let msg = ''; try { await getJSON('packages'); } catch (e) { msg = e.message; }
  t('main and copy both damaged -> clear error, nothing invented', /damaged/.test(msg));
  // a damaged main file never overwrites the good copy on the next save
  await setJSON('sourceports', [{ id: 's1' }]); await setJSON('sourceports', [{ id: 's2' }]);
  fs.writeFileSync(f('sourceports'), '{broken');
  await setJSON('sourceports', [{ id: 's3' }]);
  t('saving over a damaged file does not destroy the good copy', JSON.parse(fs.readFileSync(f('sourceports') + '.bak', 'utf8'))[0].id === 's1' && (await getJSON('sourceports'))[0].id === 's3');
  // unserializable data is refused, file untouched
  const cyc = {}; cyc.self = cyc; let refused = false; try { await setJSON('sourceports', cyc); } catch (e) { refused = true; }
  t('unsaveable data is refused and the file stays intact', refused && (await getJSON('sourceports'))[0].id === 's3');
  process.exit(0);
})();
