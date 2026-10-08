// Builds the test page (harness) with the app's own webpack settings.
//   node build.js          (run it again after you changed the app code)
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const here = __dirname;
const app = path.resolve(here, '..', '..', 'app');
const tmp = path.join(app, '.harness');
const out = path.join(here, 'out');

if (!fs.existsSync(path.join(app, 'node_modules', 'webpack'))) {
  console.log('Please run "yarn install" in the app folder first.');
  process.exit(2);
}

fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
['entry.jsx', 'webpack.config.js'].forEach(f =>
  fs.copyFileSync(path.join(here, 'harness', f), path.join(tmp, f))
);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, 'harness.html'),
  '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body><div id="root"></div><script src="build/harness-bundle.js"></script></body></html>'
);

const r = spawnSync('npx', ['webpack', '--config', '.harness/webpack.config.js'], {
  cwd: app,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NODE_OPTIONS: '--openssl-legacy-provider' }
});
fs.rmSync(tmp, { recursive: true, force: true }); // the app folder stays clean
console.log(r.status === 0 ? 'harness built: ' + out : 'BUILD FAILED');
process.exit(r.status || 0);
