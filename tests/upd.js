const fs = require('fs'); const path = require('path'); const os = require('os');
const Module = require('module'); const orig = Module.prototype.require;
let handler, userData = '', calls = [], answers = {};
global.__BUILD_TIME__ = '2026-10-07T10:00:00Z'; global.__BUILD_COMMIT__ = 'aaaaaaa1111111111111111111111111111111aa';
Module.prototype.require = function (r) {
  if (r === 'electron') return { ipcMain: { handle: (n, f) => { if (n === 'main/checkupdate') handler = f; } }, app: { getPath: () => userData, getVersion: () => '2.0.0-devpreview.24' }, BrowserWindow: { getAllWindows: () => [] } };
  if (r === 'got') return url => { calls.push(url); return { json: async () => { const hit = Object.keys(answers).find(k => url.indexOf(k) > -1); if (!hit) throw new Error('no answer for ' + url); if (answers[hit] instanceof Error) throw answers[hit]; return answers[hit]; } }; };
  return orig.apply(this, arguments);
};
require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/electron/] });
const E = (require('./paths').APP + '/electron/');
require(E + 'handlers/main.js');
const { findNewerCommit } = require(E + 'utils/versions.js');
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl4-'));
const setSettings = o => fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(o));
const commit = (sha, msg = 'Add folder view', date = '2026-10-08T08:00:00Z') => ({ sha, html_url: 'x', commit: { message: msg, committer: { date } } });
const run = async () => { calls = []; return (await handler({})); };

// pure part
const mine = global.__BUILD_COMMIT__;
t('same commit -> nothing new', findNewerCommit([commit(mine)], mine) === null);
t('short hash of the same commit -> nothing new', findNewerCommit([commit(mine)], mine.slice(0, 7)) === null);
t('different commit -> newer upload found', findNewerCommit([commit('bbbbbbb2222')], mine).sha === 'bbbbbbb2222');
t('program built without a commit mark -> cannot tell, nothing announced', findNewerCommit([commit('bbbbbbb2222')], '') === null);
t('no commits / odd answer -> nothing', findNewerCommit([], mine) === null && findNewerCommit(null, mine) === null && findNewerCommit([{}], mine) === null);

(async () => {
  // handler
  setSettings({});   // nothing set: the fork is asked
  answers = { '/releases': [], '/commits?': [commit('bbbbbbb2222222222222222222222222222222bb', 'Add Russian\n\nmore text')] };
  let r = await run();
  t('the fork (SD-V2/ssgl-doom-launcher) is asked, no setting needed', calls[0] === 'https://api.github.com/repos/SD-V2/ssgl-doom-launcher/releases');
  t('no release, newer upload -> "files" notice', r.data.available === true && r.data.kind === 'files');
  t('notice has short version, link to the upload, message, date', r.data.version === 'bbbbbbb' && r.data.download.endsWith('/commit/bbbbbbb2222222222222222222222222222222bb') && /Add Russian/.test(r.data.changelog) && r.data.date === '2026-10-08T08:00:00Z' && r.data.repo === 'SD-V2/ssgl-doom-launcher');

  answers['/commits?'] = [commit(mine)];
  r = await run(); t('the repository has nothing newer than this program -> no notice', r.data.available === false);

  setSettings({ notifyRelease: 'beta', updateRepo: 'someone-else/other-repo' }); answers['/commits?'] = [commit('ccccccc3333')];
  r = await run(); t('an old saved "updateRepo" of another repository is ignored: still the fork', calls[0].includes('/repos/SD-V2/ssgl-doom-launcher/') && r.data.kind === 'files');
  setSettings({ updateRepo: '' }); r = await run();
  t('an old EMPTY "updateRepo" does not switch the notifier off any more', calls.length > 0 && r.data.kind === 'files');

  answers = { '/releases': [{ tag_name: 'v2.0.0-devpreview.25', html_url: 'rel', published_at: '2026-11-01T00:00:00Z', target_commitish: 'x', draft: false, prerelease: true, body: 'notes' }], '/commits?': [commit('ddddddd')] };
  setSettings({});
  r = await run(); t('newer release -> "release" notice (no second request needed)', r.data.kind === 'release' && r.data.version === 'v2.0.0-devpreview.25' && calls.length === 1);

  global.__BUILD_COMMIT__ = '';
  answers = { '/releases': [], '/commits?': [commit('eeeeeee')] };
  r = await run(); t('program without commit mark -> no commit request, no notice', r.data.available === false && calls.length === 1);
  global.__BUILD_COMMIT__ = mine;

  setSettings({ notifyRelease: 'off' }); answers = { '/releases': [], '/commits?': [commit('fffffff')] };
  r = await run(); t('Update notifier "Off" -> nothing is requested at all', r.data.available === false && calls.length === 0);
  setSettings({ notifyRelease: 'stable' }); r = await run();
  t('"Stable only" still asks (the window decides what to show)', calls.length > 0);

  setSettings({ notifyRelease: 'beta' }); answers = { '/releases': new Error('403 rate limit exceeded') };
  r = await run(); t('GitHub refuses (rate limit) -> an error comes back, the window ignores it', r.data === null && /403/.test(r.error));
  process.exit(0);
})();
