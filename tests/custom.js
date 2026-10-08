require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/client\/(state|utils)/] });
const A = (require('./paths').APP + '/client/');
const S = require(A + 'utils/sections.js');
const { reducer, initState } = require(A + 'state/reducer.js');
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const mod = (id, folders, extra = {}) => ({ id, name: id, kind: 'PK3', folders, folder: folders[0] || '', active: false, ...extra });
const tr = k => 'T:' + k;
const cheats = { id: 'cheats1', name: 'Cheats', note: 'Cheat mods, load them last.', words: 'cheat, god mode, qol' };

// ---------- rules are made safe
const clean = S.sanitizeRules(undefined);
t('nothing saved -> default rules (all 13 sections, usual order)', clean.order.join() === S.SECTION_ORDER.join() && clean.custom.length === 0 && clean.hidden.length === 0);
t('garbage saved (strings, numbers, wrong types) -> still safe', (() => { const r = S.sanitizeRules({ folders: 5, mods: 'x', order: 'y', custom: 'z', names: [1], hidden: 7 }); return r.order.length === 13 && Array.isArray(r.custom) && typeof r.folders === 'object'; })());
const r1 = S.sanitizeRules({ custom: [cheats] });
t('an own section comes in front of "other" in the usual order', r1.order.join() === 'libraries,main,monsters,glory,weapons,gameplay,sounds,music,textures,visual,cheats1,other,patches,maps');
t('own sections: bad entries are dropped (no id, built-in id, duplicates)', S.sanitizeRules({ custom: [{ name: 'x' }, { id: 'music', name: 'fake' }, cheats, { ...cheats, name: 'again' }] }).custom.length === 1);
t('an own section without a name gets a name', S.sanitizeRules({ custom: [{ id: 'z1', name: '   ' }] }).custom[0].name === 'Section');
t('long texts are cut (name 60, explanation 300)', (() => { const c = S.sanitizeRules({ custom: [{ id: 'z', name: 'n'.repeat(200), note: 'x'.repeat(900), words: 'w'.repeat(900) }] }).custom[0]; return c.name.length === 60 && c.note.length === 300 && c.words.length === 300; })());
const r2 = S.sanitizeRules({ hidden: ['music', 'other', 'maps', 'banana', 'music'] });
t('removing a built-in section: only real, removable ones count (not other, not maps, no doubles)', r2.hidden.join() === 'music' && !r2.order.includes('music') && r2.order.includes('other') && r2.order.slice(-1)[0] === 'maps' && r2.order.length === 12);
t('renamed texts are kept for built-in sections (also Other and Maps can get another name); words only for the others', (() => { const r = S.sanitizeRules({ names: { monsters: 'Enemies', other: 'x', banana: 'y' }, notes: { glory: 'My text' }, words: { sounds: 'noise' } }); return r.names.monsters === 'Enemies' && r.names.other === 'x' && r.names.banana === undefined && r.notes.glory === 'My text' && r.words.sounds === 'noise' && S.sanitizeRules({ words: { other: 'q', maps: 'q' } }).words.other === undefined; })());
t('a saved (full) order keeps its places; a new own section is added after the section before it in the usual order', (() => { const saved = ['main', 'libraries', 'weapons', 'monsters', 'glory', 'gameplay', 'sounds', 'music', 'textures', 'visual', 'other', 'patches', 'maps']; const r = S.sanitizeRules({ order: saved, custom: [cheats] }); return r.order.slice(0, 3).join() === 'main,libraries,weapons' && r.order.indexOf('cheats1') === r.order.indexOf('visual') + 1 && r.order.length === 14; })());
t('hand rules that point to a section that is gone are dropped', (() => { const r = S.sanitizeRules({ folders: { A: 'cheats1', B: 'music', C: 'maps' }, mods: { x: 'ghost' }, hidden: ['music'] }); return r.folders.A === undefined && r.folders.B === undefined && r.folders.C === undefined && r.mods.x === undefined; })());
t('...and rules to existing sections stay', S.sanitizeRules({ folders: { A: 'cheats1' }, custom: [cheats] }).folders.A === 'cheats1');

// ---------- finding the section with your own words
t('words: "Cheat" folder -> your section', S.sectionOfFolder('Cheat pack', r1) === 'cheats1' && S.sectionOfFolder('God Mode Tools', r1) === 'cheats1');
t('...a word matches the START of a word ("cheats" matches "cheat")', S.sectionOfFolder('cheats', r1) === 'cheats1');
t('...but not the middle ("upcheat" does not)', S.sectionOfFolder('upcheat', r1) === 'other');
t('...several words in a name, separated by comma / semicolon / new line', (() => { const r = S.sanitizeRules({ custom: [{ id: 'a', name: 'A', words: 'x1y; foo\nbar,baz ' }] }); return ['x1y', 'foo', 'bar', 'baz'].every(w => S.sectionOfFolder(w + ' stuff', r) === 'a'); })());
t('...words with special characters cannot break anything ("(", "[", "+")', (() => { const r = S.sanitizeRules({ custom: [{ id: 'a', name: 'A', words: '(((, [[, c++' }] }); return S.sectionOfFolder('hello', r) === 'other' && S.sectionOfFolder('c++ tools', r) === 'other' && S.parseWords('(((, [[, c++').length === 0; })());
t('your words win over the built-in ones ("qol" would be gameplay)', S.sectionOfFolder('qol pack', r1) === 'cheats1' && S.sectionOfFolder('qol pack') === 'gameplay');
t('built-in words still work next to your sections', S.sectionOfFolder('3_MONSTERS', r1) === 'monsters');
t('a changed word list for a built-in section replaces its words', (() => { const r = S.sanitizeRules({ words: { sounds: 'noise' } }); return S.sectionOfFolder('noise makers', r) === 'sounds' && S.sectionOfFolder('6_SOUNDS', r) === 'other'; })());
t('...an emptied word list: the section is only for what you put in by hand', S.sectionOfFolder('6_SOUNDS', S.sanitizeRules({ words: { sounds: '' } })) === 'other');
t('a removed built-in section finds nothing any more (its folders go to "other")', S.sectionOfFolder('6_SOUNDS', S.sanitizeRules({ hidden: ['sounds'] })) === 'other' && S.sectionOfFolder('soundtrack', S.sanitizeRules({ hidden: ['sounds'] })) === 'music');
t('the closest folder rule still holds with your sections', S.sectionOf(mod('m', ['Brutal Doom', 'Cheat pack']), r1) === 'cheats1' && S.sectionOf(mod('m', ['Cheat pack', '10_VISUAL']), r1) === 'visual');
t('parseWords: trims, lowercases, drops one-letter and empty words, no doubles', S.parseWords(' Foo, foo;; B ,Bar-Baz ').join('|') === 'foo|bar baz');

// ---------- hand rules for your own sections + resolving
t('a folder given to your section by hand', S.resolveSection(mod('m', ['litdoom']), { ...r1, folders: { litdoom: 'cheats1' } }) === 'cheats1');
t('a folder given to a REMOVED section is ignored (automatic again)', S.resolveSection(mod('m', ['6_SOUNDS']), { ...S.sanitizeRules({ hidden: ['sounds'] }), folders: { '6_SOUNDS': 'sounds' } }) === 'other');

// ---------- names and notes
t('built-in name: default text from the language, or the one you wrote', S.sectionName('monsters', {}, tr) === 'T:wads:sec_monsters' && S.sectionName('monsters', { names: { monsters: 'Enemies' } }, tr) === 'Enemies');
t('...empty / blank text means "default"', S.sectionName('monsters', { names: { monsters: '  ' } }, tr) === 'T:wads:sec_monsters' && S.sectionNote('monsters', { notes: { monsters: '' } }, tr) === 'T:wads:secNote_monsters');
t('your own section: your name and your note (no translation)', S.sectionName('cheats1', r1, tr) === 'Cheats' && S.sectionNote('cheats1', r1, tr) === 'Cheat mods, load them last.');

// ---------- sorting, groups and numbers with your sections
const mods = [mod('bp', ['1_BP']), mod('ch', ['Cheat pack']), mod('odd', ['litdoom']), mod('patch', ['9_PATCHES']), mod('map:m', ['Ep'], { isMap: true })];
t('sorting: your section sits in front of "other" and the patches', S.sortBySections(['patch', 'odd', 'ch', 'bp', 'map:m'], mods, r1).join() === 'bp,ch,odd,patch,map:m');
t('groups: every section incl. yours, also empty ones', (() => { const g = S.groupFixed(['bp', 'ch'], mods, r1); return Object.keys(g).length === 14 && g.cheats1.length === 1; })());
t('groups: a removed section is not there', !('music' in S.groupFixed(['bp'], mods, r2)));
t('numbers: a new section gets its number by place, "other" none', (() => { const n = S.sectionNumbers(r1.order); return n.visual === 9 && n.cheats1 === 10 && n.other === undefined && n.patches === 11 && n.maps === 12; })());
t('numbers: removing a section closes the gap', S.sectionNumbers(r2.order).patches === 9 && S.sectionNumbers(r2.order).maps === 10);

// ---------- reducer
const base = (selected, extra = {}) => ({ ...initState, mods: mods.map(m => ({ ...m })), package: { ...initState.package, selected }, sectionMode: true, ...extra });
let s = reducer(base(['bp', 'ch', 'patch']), { type: 'sections/saveConfig', config: { custom: [cheats] } });
t('saving the editor with a new section: it exists, the mod that matches moves into it', s.sectionRules.custom.length === 1 && S.resolveSection(s.mods.find(m => m.id === 'ch'), s.sectionRules) === 'cheats1');
t('...and the load order is arranged with it', s.package.selected.join() === 'bp,ch,patch');
s = reducer(s, { type: 'sections/saveConfig', config: { custom: [] } });
t('removing your own section: its mods fall back to automatic ("other") and the order is re-arranged', S.resolveSection(s.mods.find(m => m.id === 'ch'), s.sectionRules) === 'other' && s.sectionRules.order.indexOf('cheats1') < 0);
s = reducer(base(['bp', 'ch']), { type: 'sections/saveConfig', config: { custom: [cheats], hidden: ['music'], names: { main: 'Core' } } });
t('saving several things at once', s.sectionRules.hidden.join() === 'music' && s.sectionRules.names.main === 'Core' && s.sectionRules.custom.length === 1);
s = reducer(s, { type: 'sections/assignFolder', key: 'litdoom', section: 'cheats1' });
s = reducer(s, { type: 'mods/drop', mods: [], ids: ['odd'] });
t('a folder rule for your section works through the load order', s.package.selected.join() === 'bp,ch,odd');
const reset = reducer(s, { type: 'sections/reset' });
t('RESET: your sections, names, removed sections and hand-made rules are all gone', reset.sectionRules.custom.length === 0 && reset.sectionRules.hidden.length === 0 && Object.keys(reset.sectionRules.names).length === 0 && Object.keys(reset.sectionRules.folders).length === 0 && Object.keys(reset.sectionRules.mods).length === 0);
t('RESET: the usual order is back and the load order follows', reset.sectionRules.order.join() === S.SECTION_ORDER.join() && reset.package.selected.join() === 'bp,odd,ch' || reset.package.selected.join() === 'bp,ch,odd');
t('RESET does not touch the view mode or the mods themselves', reset.sectionMode === true && reset.mods.length === s.mods.length);
t('reset on a state that is already default: nothing breaks', reducer(base([]), { type: 'sections/reset' }).sectionRules.order.length === 13);
s = reducer(base(['bp']), { type: 'sections/assignMod', id: 'ch', section: 'visual' });
t('a tag change gives the mod a hand-made section', s.sectionRules.mods.ch === 'visual');
s = reducer(s, { type: 'sections/assignMod', id: 'ch', section: 'other' });
t('...choosing the section the folder gives anyway removes the rule', s.sectionRules.mods.ch === undefined);
s = reducer(base(['bp']), { type: 'sections/assignMod', id: 'ch', section: 'visual' });
s = reducer(s, { type: 'sections/assignMod', id: 'ch', section: 'auto' });
t('...and "automatic" takes it away', s.sectionRules.mods.ch === undefined);
t('loading old saved rules (before own sections existed) works', reducer(base([]), { type: 'sections/load', mode: true, rules: { folders: { a: 'main' }, mods: {}, order: ['main'] } }).sectionRules.folders.a === 'main');
