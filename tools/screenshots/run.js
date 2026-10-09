// Runs one of the scripts in ./scripts with Electron (inside xvfb when there is no screen).
//   node run.js shot "settings,en,hell,classic" "wads-sections-few,en,nightcity,mods,new,cyberpunk"
//   node run.js hit  "settings,en,hell,cyberpunk"        (can every dropdown list be clicked?)
//   node run.js geom "dlg-discard,en,hell,cyberpunk"     (where does a window open?)
//   node run.js cur  "settings,en,nightcity,cyberpunk"   (mouse pointers)
//   node run.js trail "wads-sections-few,en,nightcity,mods,new,cyberpunk"
//   node run.js snd                                      (can the browser play every sound file?)
//   node run.js tab "settings,en,nightcity,cyberpunk"    (a screen coming in after a tab switch, filmed)
// Pictures go to ./out/shots. Size: SIZE=1275x700 node run.js shot ...
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [name, ...rest] = process.argv.slice(2);
const script = path.join(__dirname, 'scripts', (name || '') + '.js');
if (!name || !fs.existsSync(script)) {
  console.log('Scripts: ' + fs.readdirSync(path.join(__dirname, 'scripts')).map(f => f.replace('.js', '')).join(', '));
  process.exit(2);
}
if (!fs.existsSync(path.join(__dirname, 'out', 'harness.html'))) {
  console.log('Please run "node build.js" first.');
  process.exit(2);
}

// the Electron program of the app itself (installed by yarn install), or ELECTRON=path
let electron = process.env.ELECTRON;
if (!electron) {
  try {
    electron = require(path.resolve(__dirname, '..', '..', 'app', 'node_modules', 'electron'));
  } catch (e) {
    electron = null;
  }
}
if (!electron || !fs.existsSync(electron)) {
  console.log('Electron was not found. Set ELECTRON=/path/to/electron (version 7) or run "yarn install" in app.');
  process.exit(2);
}

const args = ['--no-sandbox', '--disable-gpu', script, ...rest];
const needsScreen = !process.env.DISPLAY && process.platform === 'linux';
const cmd = needsScreen ? 'xvfb-run' : electron;
// a big virtual screen, so pictures can be as wide as the owner's 2560 px screen (SIZE=2560x1400)
const full = needsScreen ? ['-a', '-s', '-screen 0 2600x1600x24', electron, ...args] : args;
const r = spawnSync(cmd, full, { stdio: 'inherit', env: { ...process.env } });
process.exit(r.status || 0);
