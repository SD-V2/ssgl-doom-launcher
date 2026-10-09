// The texts of the four languages. English is the master.
// FAILS on: English texts the code uses but en.js lacks, empty English texts, keys that exist in
// another language but not in English, broken {{placeholders}} in existing translations.
// Only REPORTS: texts not translated yet (the app falls back to English; see missing-translations.js).
// Prints OK / MISS lines like the other check files, plus one "NOTE" line.
const fs = require('fs');
const path = require('path');
const { APP, E, OTHER, bases, isPlural, keysOf, need, untranslated } = require('./locales-lib');

const check = (label, ok, detail) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label + (ok || !detail ? '' : ': ' + detail));
const list = a => a.slice(0, 12).join(', ') + (a.length > 12 ? ` ... (${a.length})` : '');

// 1. English texts that the code uses (t('group:key')) but en.js lacks
const files = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (e.name !== 'locales' && e.name !== 'node_modules') walk(p); } else if (/\.jsx?$/.test(e.name)) files.push(p);
});
walk(APP + '/client');
const used = new Set();
files.forEach(f => {
  const src = fs.readFileSync(f, 'utf8');
  (src.match(/\bt\(\s*'[a-zA-Z0-9_]+:[a-zA-Z0-9_.]+'/g) || []).forEach(m => used.add(m.replace(/^t\(\s*'|'$/g, '').replace(':', '.')));
  // t('key') in a file with one useTranslation('group'): the key is in that group
  const groups = Array.from(new Set((src.match(/useTranslation\(\s*'([a-zA-Z0-9_]+)'/g) || []).map(m => m.replace(/^.*'(.*)'$/, '$1'))));
  if (groups.length === 1) (src.match(/\bt\(\s*'[a-zA-Z0-9_.]+'/g) || []).forEach(m => used.add(groups[0] + '.' + m.replace(/^t\(\s*'|'$/g, '')));
});
const noEnglish = Array.from(used).filter(k => E[k] === undefined && E[k + '_plural'] === undefined && E[k + '_0'] === undefined);
check(`every text the code uses exists in English (${used.size} used)`, noEnglish.length === 0, list(noEnglish));
const empty = Object.keys(E).filter(k => typeof E[k] !== 'string' || !E[k].trim());
check('no empty English texts', empty.length === 0, list(empty));

// 2. keys in another language that English does not have
Object.keys(OTHER).forEach(lng => {
  const ok = new Set(need(lng));
  const extra = Object.keys(OTHER[lng]).filter(k => !ok.has(k));
  check(`${lng}: no texts that English does not have`, extra.length === 0, list(extra));
});

// 3. every {{placeholder}} of English must exist in an existing translation
const ph = s => (String(s).match(/\{\{[^}]+\}\}/g) || []).map(x => x.replace(/\s/g, '').replace(/,.*\}\}/, '}}'));
const bad = [];
bases.forEach(b => {
  const want = new Set(ph(E[b]).concat(isPlural(b) ? ph(E[b + '_plural']) : []));
  Object.keys(OTHER).forEach(lng => keysOf(lng, b).forEach(x => {
    if (OTHER[lng][x] !== undefined) want.forEach(p => { if (p !== '{{count}}' && ph(OTHER[lng][x]).indexOf(p) < 0) bad.push(`${lng} ${x} lacks ${p}`); });
  }));
});
check('placeholders ({{name}}) kept in every existing translation', bad.length === 0, list(bad));

// 4. only reported: texts not translated yet
const notYet = Object.keys(untranslated());
console.log(`NOTE ${notYet.length} texts not translated yet (English keys: ${bases.length})`);
