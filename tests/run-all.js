// Runs every check file and prints one line per file. Exit code 1 if anything failed.
//   node run-all.js            all files
//   node run-all.js style      only files whose name contains "style"
//
// Needs:  yarn install  (in ../app)   and   npm install  (in this folder)
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SUITES = ['ssr', 'lang', 'lang2', 'lang3', 'lang4', 'lang5', 'lang6', 'lang7', 'lang8', 'lang9', 'lang10', 'lang12', 'lang13', 'lang14', 'dialog', 'style', 'marker', 'feel', 'trailui', 'cursorfx', 'tabs', 'arabic', 'upd', 'notice', 'unsaved', 'json', 'hide', 'twins', 'order', 'maps', 'closeguard', 'sections', 'fixed', 'secorder', 'custom', 'trail', 'native', 'upscaler', 'sprites', 'tools', 'i18ncheck'];

if (!fs.existsSync(path.join(__dirname, 'node_modules', 'jsdom'))) {
  console.log('Please run "npm install" in the tests folder first.');
  process.exit(2);
}
if (!fs.existsSync(path.join(__dirname, '..', 'app', 'node_modules', 'react'))) {
  console.log('Please run "yarn install" in the app folder first.');
  process.exit(2);
}

const only = process.argv[2];
let failed = 0;
let total = 0;
console.log('file          ok   miss  result');
SUITES.filter(s => !only || s.indexOf(only) > -1).forEach(name => {
  const r = spawnSync(process.execPath, [path.join(__dirname, name + '.js')], {
    cwd: __dirname,
    encoding: 'utf8',
    timeout: 240000,
    maxBuffer: 50 * 1024 * 1024
  });
  const out = (r.stdout || '') + (r.stderr || '');
  let ok = (out.match(/^OK\s/gm) || []).length;
  const miss = (out.match(/^MISS\s/gm) || []).length;
  let problem = '';
  if (name === 'i18ncheck') {
    // this one prints texts, not OK lines
    const bad = out.split('\n').filter(l => /(missing|extra|problems): (?!none)/.test(l));
    ok = bad.length ? 0 : 1;
    if (bad.length) problem = bad[0];
  }
  const crashed = r.status !== 0 && !(name === 'i18ncheck' && r.status === 0);
  const result = miss === 0 && ok > 0 && !crashed && !problem ? 'ok' : 'FAILED';
  if (result !== 'ok') {
    failed++;
    console.log(out.split('\n').filter(l => /^MISS|Error|error:/.test(l)).slice(0, 8).join('\n'));
  }
  total += ok;
  console.log(
    name.padEnd(12) + String(ok).padStart(4) + String(miss).padStart(7) + '  ' + result +
      (r.error ? ' (' + r.error.message + ')' : '') + (problem ? ' ' + problem : '')
  );
});
console.log('\n' + total + ' checks passed, ' + failed + ' file(s) failed');
process.exit(failed ? 1 : 0);
