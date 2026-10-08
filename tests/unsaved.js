const Module = require('module'); const orig = Module.prototype.require;
let boxCalls = [], boxAnswer = 0;
Module.prototype.require = function (r) {
  if (r === 'electron') return { remote: { dialog: { showMessageBox: async o => { boxCalls.push(o); return { response: boxAnswer }; } } }, dialog: { showMessageBoxSync() {} }, ipcMain: { on() {} } };
  return orig.apply(this, arguments);
};
require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/(client\/(utils|state)|electron\/utils)/] });
const A = (require('./paths').APP + '/');
const { isUnsaved } = require(A + 'client/utils/unsaved.js');
const { reducer, initState } = require(A + 'client/state/reducer.js');
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);

const packages = [{ id: 'p1', name: 'A', selected: ['x', 'y', 'z'] }, { id: 'p2', name: 'B', selected: [] }];
t('nothing selected, no package -> not unsaved', !isUnsaved({ id: null, selected: [] }, packages));
t('mods in the load order but no package -> unsaved', isUnsaved({ id: null, selected: ['x'] }, packages));
t('package untouched -> not unsaved', !isUnsaved({ id: 'p1', selected: ['x', 'y', 'z'] }, packages));
t('mod removed -> unsaved', isUnsaved({ id: 'p1', selected: ['x', 'y'] }, packages));
t('mod added -> unsaved', isUnsaved({ id: 'p1', selected: ['x', 'y', 'z', 'w'] }, packages));
t('only the order changed -> unsaved', isUnsaved({ id: 'p1', selected: ['y', 'x', 'z'] }, packages));
t('everything removed from a package with mods -> unsaved', isUnsaved({ id: 'p1', selected: [] }, packages));
t('empty package left empty -> not unsaved', !isUnsaved({ id: 'p2', selected: [] }, packages));
t('package id that no longer exists, with mods -> unsaved', isUnsaved({ id: 'gone', selected: ['x'] }, packages));

(async () => {
  // the load order survives a data reload (e.g. after saving the settings)
  let st = { ...initState, mods: [{ id: 'a', active: true }, { id: 'b', active: false }], package: { ...initState.package, id: 'p1', selected: ['a'] }, packages };
  st = reducer(st, { type: 'main/init', data: { mods: [{ id: 'a', active: false }, { id: 'b', active: false }, { id: 'c', active: false }], packages, sourceports: [], iwads: [], settings: { language: 'tr' }, recovered: [] } });
  t('main/init keeps the package and its load order', st.package.id === 'p1' && st.package.selected.join() === 'a');
  t('main/init marks the mods of the load order active again', st.mods.filter(m => m.active).map(m => m.id).join() === 'a' && st.mods.length === 3);
  t('main/init still applies the new settings', st.settings.language === 'tr');
  const fresh = reducer({ ...initState }, { type: 'main/init', data: { mods: [{ id: 'a', active: false }], packages: [], sourceports: [], iwads: [], settings: {}, recovered: ['packages'] } });
  t('start-up: empty load order, restored-file notice stored', fresh.package.selected.length === 0 && fresh.recovered.join() === 'packages');
  t('notice can be cleared', reducer(fresh, { type: 'recovered/clear' }).recovered.length === 0);
  process.exit(0);
})();
