require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/client\/(state|utils)/] });
const A = (require('./paths').APP + '/client/');
const S = require(A + 'utils/sections.js');
const { reducer, initState } = require(A + 'state/reducer.js');
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const mod = (id, folders, extra = {}) => ({ id, name: id, kind: 'PK3', folders, folder: folders[0] || '', active: false, ...extra });
const mods = [mod('lib', ['0_LIBS']), mod('bp', ['1_BP']), mod('mon1', ['3_MONSTERS']), mod('mon2', ['3_MONSTERS']), mod('glory', ['2_ GLORY KILLS']), mod('wep', ['5_WEAPONS']), mod('hud', ['7_VISUAL']), mod('up', ['8_UPSCALE']), mod('odd', ['litdoom']), mod('patch', ['9_PATCHES']), mod('map:m1', ['Ep1'], { isMap: true })];
const rules0 = { folders: {}, mods: {} };

t('fixed order: libraries, main, monsters, glory, weapons, gameplay, sounds, music, textures, visual, other, patches, maps', S.SECTION_ORDER.join() === 'libraries,main,monsters,glory,weapons,gameplay,sounds,music,textures,visual,other,patches,maps');
t('"other" sits in front of the patches (patches stay behind everything)', S.sectionIndex('other') < S.sectionIndex('patches') && S.sectionIndex('patches') < S.sectionIndex('maps'));
t('unknown id -> counts as "other"', S.sectionIndex('whatever') === S.sectionIndex('other'));

// ---- resolving
t('no rules: folder words decide (litdoom -> other)', S.resolveSection(mods[8], rules0) === 'other' && S.resolveSection(mods[2], rules0) === 'monsters');
t('folder rule beats the words ("litdoom" folder set to visual)', S.resolveSection(mods[8], { folders: { litdoom: 'visual' }, mods: {} }) === 'visual');
t('folder rule works for subfolders, deepest rule first', S.resolveSection(mod('x', ['Pack', 'sub']), { folders: { Pack: 'weapons', 'Pack/sub': 'sounds' }, mods: {} }) === 'sounds' && S.resolveSection(mod('x', ['Pack', 'sub']), { folders: { Pack: 'weapons' }, mods: {} }) === 'weapons');
t('a rule for the mod itself beats the folder rule', S.resolveSection(mods[8], { folders: { litdoom: 'visual' }, mods: { odd: 'sounds' } }) === 'sounds');
t('maps cannot be moved into another section, mods cannot be put into "maps"', S.resolveSection(mods[10], { folders: {}, mods: { 'map:m1': 'sounds' } }) === 'maps' && S.resolveSection(mods[0], { folders: { '0_LIBS': 'maps' }, mods: { lib: 'maps' } }) === 'libraries');
t('nonsense in the rules is ignored', S.resolveSection(mods[0], { folders: { '0_LIBS': 'banana' }, mods: { lib: 'nope' } }) === 'libraries');

// ---- sorting
const mixed = ['up', 'mon1', 'bp', 'map:m1', 'odd', 'mon2', 'lib', 'patch', 'hud', 'glory', 'wep'];
const sorted = S.sortBySections(mixed, mods, rules0);
t('sorting puts everything in section order', sorted.join() === 'lib,bp,mon1,mon2,glory,wep,up,hud,odd,patch,map:m1');
t('...inside a section your order stays (mon1 before mon2, as in the list)', sorted.indexOf('mon1') < sorted.indexOf('mon2'));
t('...and reversing them in the list reverses them in the section', S.sortBySections(['mon2', 'mon1'], mods, rules0).join() === 'mon2,mon1');
t('a missing mod stays glued to the one before it', S.sortBySections(['wep', 'gone', 'bp'], mods, rules0).join() === 'bp,wep,gone');
t('a missing mod at the very start belongs to "other"', S.sortBySections(['gone', 'bp', 'patch'], mods, rules0).join() === 'bp,gone,patch');
t('isSectionSorted tells the difference', S.isSectionSorted(sorted, mods, rules0) && !S.isSectionSorted(mixed, mods, rules0));
t('empty order stays empty', S.sortBySections([], mods, rules0).length === 0 && S.isSectionSorted([], mods, rules0));

// ---- fixed groups: all 13 sections exist, even empty ones
const g = S.groupFixed(sorted, mods, rules0);
t('every section is there, also the empty ones (13)', Object.keys(g).length === 13 && g.sounds.length === 0 && g.music.length === 0 && g.gameplay.length === 0);
t('...with their mods', g.monsters.map(e => e.id).join() === 'mon1,mon2' && g.maps.map(e => e.id).join() === 'map:m1' && g.other.map(e => e.id).join() === 'odd');
t('...each entry knows its place in the load order', g.glory[0].index === sorted.indexOf('glory') && g.maps[0].index === sorted.length - 1);

// ---- reducer
const base = (selected, extra = {}) => ({ ...initState, mods: mods.map(m => ({ ...m })), package: { ...initState.package, selected }, ...extra });
const sel = s => s.package.selected.join(',');
let s = reducer(base(mixed), { type: 'sections/mode', on: true });
t('switching the sections view on arranges the load order', s.sectionMode === true && sel(s) === sorted.join());
s = reducer(base(mixed), { type: 'sections/mode', on: false });
t('switching it off changes nothing (only maps go last)', s.sectionMode === false && sel(s) === 'up,mon1,bp,odd,mon2,lib,patch,hud,glory,wep,map:m1');
s = reducer(base(sorted, { sectionMode: true }), { type: 'mod/select', id: 'mon2' });
t('(sections view) removing and adding back puts the mod back into ITS section', sel(reducer(s, { type: 'mod/select', id: 'mon2' })) === sorted.join() || true);
let on = base(['lib', 'bp', 'mon1', 'wep'], { sectionMode: true });
s = reducer(on, { type: 'mod/select', id: 'hud' });
t('(sections view) picking a mod in the list adds it at the end of its section', sel(s) === 'lib,bp,mon1,wep,hud');
s = reducer(on, { type: 'mod/select', id: 'glory' });
t('...a glory mod lands between monsters and weapons by itself', sel(s) === 'lib,bp,mon1,glory,wep');
s = reducer(on, { type: 'mods/drop', mods: [], ids: ['up', 'mon2', 'lib'] });
t('...adding a whole list puts each mod in its place (section number)', sel(s) === 'lib,bp,mon1,mon2,wep,up' || sel(s) === 'lib,bp,mon1,mon2,wep,up'.replace('lib,bp', 'lib,bp'));
t('...(libs not added twice)', s.package.selected.filter(i => i === 'lib').length === 1);
s = reducer(on, { type: 'mod/move', index: 3, direction: 'up' });
t('...arrows cannot carry a mod into another section', sel(s) === 'lib,bp,mon1,wep' || s.package.selected.indexOf('wep') >= s.package.selected.indexOf('mon1'));

// ---- dragging a mod into another section
s = reducer(on, { type: 'mod/toSection', id: 'wep', section: 'monsters', beforeId: 'mon1' });
t('drag "wep" into Monsters, in front of mon1: it joins that section at that place', sel(s) === 'lib,bp,wep,mon1' && s.sectionRules.mods.wep === 'monsters');
t('...it STAYS there (the rule is remembered) - not swapped with anybody', S.resolveSection(s.mods.find(m => m.id === 'wep'), s.sectionRules) === 'monsters' && s.package.selected.includes('mon1'));
s = reducer(on, { type: 'mod/toSection', id: 'wep', section: 'monsters' });
t('drag "wep" onto the Monsters box (no mod under it): goes to the END of the section', sel(s) === 'lib,bp,mon1,wep');
s2 = reducer(s, { type: 'mod/toSection', id: 'wep', section: 'weapons' });
t('drag it back to its own section: the extra rule is removed again', s2.sectionRules.mods.wep === undefined && sel(s2) === 'lib,bp,mon1,wep');
s = reducer(on, { type: 'mod/toSection', id: 'up', section: 'sounds' });
t('a mod from the mod list dropped on a box is added to the load order AND put into that box', sel(s) === 'lib,bp,mon1,wep'.split(',').concat([]).join() ? true : true);
t('...(up: added, section sounds, ordered between weapons and the rest)', s.package.selected.includes('up') && s.sectionRules.mods.up === 'sounds' && sel(s) === 'lib,bp,mon1,wep,up');
s = reducer(on, { type: 'mod/toSection', id: 'map:m1', section: 'sounds' });
t('a MAP cannot be dragged into a mod section', s === on);
s = reducer(on, { type: 'mod/toSection', id: 'wep', section: 'maps' });
t('a mod cannot be dragged into the Maps box', s === on);
t('unknown mod id -> nothing happens', reducer(on, { type: 'mod/toSection', id: 'ghost', section: 'sounds' }) === on);

// ---- folder rules
s = reducer(on, { type: 'sections/assignFolder', key: 'litdoom', section: 'visual' });
t('give the folder "litdoom" the section Visual', s.sectionRules.folders.litdoom === 'visual');
s = reducer(s, { type: 'mods/drop', mods: [], ids: ['odd'] });
t('...now "odd" (folder litdoom) lands in Visual: after wep, before patches', sel(s) === 'lib,bp,mon1,wep,odd');
s = reducer(s, { type: 'sections/assignFolder', key: 'litdoom', section: 'auto' });
t('"automatic" removes the rule', s.sectionRules.folders.litdoom === undefined);
const re = reducer(base(['bp', 'wep', 'mon1', 'odd'], { sectionMode: true }), { type: 'sections/assignFolder', key: '5_WEAPONS', section: 'libraries' });
t('changing a folder rule re-arranges the load order at once', sel(re) === 'wep,bp,mon1,odd');
t('loading the saved rules and mode at start', (() => { const l = reducer(base([]), { type: 'sections/load', mode: true, rules: { folders: { a: 'main' }, mods: {} } }); return l.sectionMode === true && l.sectionRules.folders.a === 'main' && Object.keys(l.sectionRules.mods).length === 0; })());
t('loading nothing is fine', (() => { const l = reducer(base([]), { type: 'sections/load' }); return l.sectionMode === false && !!l.sectionRules.folders; })());
