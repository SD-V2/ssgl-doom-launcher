require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/client\/(state|utils)/] });
const A = (require('./paths').APP + '/client/');
const S = require(A + 'utils/sections.js');
const { reducer, initState } = require(A + 'state/reducer.js');
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const DEF = S.SECTION_ORDER;

t('default order, no saved order -> the usual order', S.normalizeOrder([]).join() === DEF.join() && S.normalizeOrder(undefined).join() === DEF.join() && S.normalizeOrder('x').join() === DEF.join());
const moved = ['main', 'libraries', 'weapons', 'monsters', 'glory', 'gameplay', 'sounds', 'music', 'textures', 'visual', 'other', 'patches', 'maps'];
t('a saved order is kept as it is', S.normalizeOrder(moved).join() === moved.join());
t('maps are always last, even if the saved order says otherwise', S.normalizeOrder(['maps', 'main', 'libraries']).slice(-1)[0] === 'maps' && S.normalizeOrder(['maps', 'main']).filter(x => x === 'maps').length === 1);
t('unknown / double entries are dropped', S.normalizeOrder(['main', 'main', 'banana', 'libraries']).filter(x => x === 'main').length === 1 && S.normalizeOrder(['banana']).indexOf('banana') < 0);
t('every section is always there once (13)', S.normalizeOrder(['monsters', 'main']).length === 13 && new Set(S.normalizeOrder(['monsters', 'main'])).size === 13);
const partial = S.normalizeOrder(['monsters', 'main']);
t('a section missing in a saved order keeps its usual place (libraries stays in front of "main"? it is placed first)', partial.indexOf('libraries') === 0 && partial.indexOf('glory') === partial.indexOf('monsters') + 1);
t('numbers follow the place; "other" has none; maps get the last number', JSON.stringify(S.sectionNumbers(DEF)) === JSON.stringify({ libraries: 0, main: 1, monsters: 2, glory: 3, weapons: 4, gameplay: 5, sounds: 6, music: 7, textures: 8, visual: 9, patches: 10, maps: 11 }));
const n2 = S.sectionNumbers(moved);
t('after moving: main is 0, libraries 1, weapons 2, monsters 3', n2.main === 0 && n2.libraries === 1 && n2.weapons === 2 && n2.monsters === 3 && n2.maps === 11 && n2.other === undefined);
t('moving "other" does not change any number', (() => { const o = [...DEF]; const i = o.indexOf('other'); [o[i], o[i - 1]] = [o[i - 1], o[i]]; const m = S.sectionNumbers(o); return m.visual === 9 && m.patches === 10 && m.other === undefined; })());

// ---- moveSection
t('monsters one place up -> swaps with main', S.moveSection(DEF, 'monsters', 'up').slice(0, 3).join() === 'libraries,monsters,main');
t('monsters one place down -> swaps with glory', S.moveSection(DEF, 'monsters', 'down').slice(0, 4).join() === 'libraries,main,glory,monsters');
t('the first section cannot go up', S.moveSection(DEF, 'libraries', 'up') === DEF);
t('nothing can go behind the maps (the section before maps cannot go down)', S.moveSection(DEF, 'patches', 'down') === DEF);
t('maps cannot be moved', S.moveSection(DEF, 'maps', 'up') === DEF && S.moveSection(DEF, 'maps', 'down') === DEF);
t('unknown id changes nothing', S.moveSection(DEF, 'banana', 'up') === DEF);
t('moving does not change the original list', (() => { const copy = [...DEF]; S.moveSection(DEF, 'monsters', 'up'); return DEF.join() === copy.join(); })());

// ---- sorting follows the order
const mod = (id, folder, extra = {}) => ({ id, name: id, kind: 'PK3', folders: [folder], folder, active: false, ...extra });
const mods = [mod('lib', '0_LIBS'), mod('bp', '1_BP'), mod('mon', '3_MONSTERS'), mod('wep', '5_WEAPONS'), mod('map:m', 'Ep', { isMap: true })];
const sel = ['lib', 'bp', 'mon', 'wep', 'map:m'];
t('default order sorts as before', S.sortBySections(['wep', 'mon', 'bp', 'lib', 'map:m'], mods, {}).join() === sel.join());
t('with a moved order the sorting follows it (weapons before monsters)', S.sortBySections(sel, mods, { order: moved }).join() === 'bp,lib,wep,mon,map:m');
t('...maps stay last', S.sortBySections(sel, mods, { order: ['maps', 'main', 'libraries'] }).slice(-1)[0] === 'map:m');

// ---- reducer
const base = (selected, extra = {}) => ({ ...initState, mods: mods.map(m => ({ ...m })), package: { ...initState.package, selected }, sectionMode: true, ...extra });
let s = reducer(base(sel), { type: 'sections/move', id: 'monsters', direction: 'up' });
t('move "monsters" up: the order of the sections changes', s.sectionRules.order.slice(0, 3).join() === 'libraries,monsters,main');
t('...and the MODS follow their section in the load order at once', s.package.selected.join() === 'lib,mon,bp,wep,map:m');
s = reducer(s, { type: 'sections/move', id: 'monsters', direction: 'up' });
t('...again: monsters is the first section now, its mod is first in the load order', s.sectionRules.order[0] === 'monsters' && s.package.selected.join() === 'mon,lib,bp,wep,map:m');
t('a move that is not possible returns the same state (nothing saved, nothing re-rendered)', reducer(s, { type: 'sections/move', id: 'monsters', direction: 'up' }) === s);
s = reducer(s, { type: 'sections/resetOrder' });
t('"default section order" puts everything back', s.sectionRules.order.join() === DEF.join() && s.package.selected.join() === sel.join());
const saved = reducer(base([]), { type: 'sections/load', mode: true, rules: { folders: {}, mods: {}, order: moved } });
t('the saved order is loaded at the start', saved.sectionRules.order.join() === moved.join());
t('an old save without an order still loads (default order)', reducer(base([]), { type: 'sections/load', mode: true, rules: { folders: { a: 'main' }, mods: {} } }).sectionRules.order.join() === DEF.join());
t('moving works while the list view is on, too (rules only; nothing is re-sorted)', (() => { const l = reducer(base(['wep', 'lib'], { sectionMode: false }), { type: 'sections/move', id: 'weapons', direction: 'up' }); return l.sectionRules.order.indexOf('weapons') === DEF.indexOf('weapons') - 1 && l.package.selected.join() === 'wep,lib'; })());
t('the order rides along with the other rules (folders, mods) when saved', JSON.stringify(Object.keys(reducer(base([]), { type: 'sections/move', id: 'main', direction: 'down' }).sectionRules).sort()) === '["custom","folders","hidden","mods","names","notes","order","words"]');
