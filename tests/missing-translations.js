// Writes docs/TODO-TRANSLATIONS.md: every English text that Turkish, Arabic or Russian do not have yet.
// Run it only for the translation job:   node missing-translations.js
// (not part of run-all.js; the app shows English where a translation is missing)
const fs = require('fs');
const path = require('path');
const { E, isPlural, untranslated } = require('./locales-lib');

const todo = untranslated();
const keys = Object.keys(todo).sort();
const cell = s => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const lines = [
  '# Texts not translated yet',
  '',
  'Made by `tests/missing-translations.js` (run it again to update this list).',
  'Add each text to `app/client/locales/<language>.js` with the same key. Keep `{{placeholders}}` as they are.',
  'Plural texts (marked "plural") need the forms of the language: Turkish key + key_plural, Arabic key_0..key_5, Russian key_0..key_2.',
  '',
  `${keys.length} texts.`,
  '',
  '| key | English | missing in |',
  '|---|---|---|'
].concat(keys.map(k => `| \`${k}\`${isPlural(k) ? ' (plural)' : ''} | ${cell(E[k])}${isPlural(k) ? ' / ' + cell(E[k + '_plural']) : ''} | ${todo[k].join(', ')} |`));
const out = path.join(__dirname, '..', 'docs', 'TODO-TRANSLATIONS.md');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`${keys.length} texts not translated yet -> ${out}`);
