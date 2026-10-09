// Reads the four locale files (shared by i18ncheck.js and missing-translations.js).
const APP = require('./paths').APP + '';
require('@babel/register')({
  presets: [[(APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'], only: [/app\/client\/locales/]
});
const L = APP + '/client/locales/';
const flat = (o, p = '') => Object.keys(o).reduce((a, k) => (typeof o[k] === 'object' ? Object.assign(a, flat(o[k], p + k + '.')) : (a[p + k] = o[k], a)), {});
const E = flat(require(L + 'en.js').default);
const OTHER = { tr: flat(require(L + 'tr.js').default), ar: flat(require(L + 'ar.js').default), ru: flat(require(L + 'ru.js').default) };

// the keys each language needs: plural keys become key / key_plural (tr) and key_0..key_5 (ar), key_0..key_2 (ru)
const forms = { tr: b => [b, b + '_plural'], ar: b => [0, 1, 2, 3, 4, 5].map(i => `${b}_${i}`), ru: b => [0, 1, 2].map(i => `${b}_${i}`) };
const bases = Array.from(new Set(Object.keys(E).map(k => k.replace(/_plural$/, ''))));
const isPlural = b => E[b + '_plural'] !== undefined;
const keysOf = (lng, b) => (isPlural(b) ? forms[lng](b) : [b]);
const need = lng => bases.reduce((a, b) => a.concat(keysOf(lng, b)), []);
// English keys (bases) that a language does not have yet -> { key: ['tr', 'ru'] }
const untranslated = () => bases.reduce((a, b) => {
  const lacking = Object.keys(OTHER).filter(lng => keysOf(lng, b).some(x => OTHER[lng][x] === undefined));
  if (lacking.length) a[b] = lacking;
  return a;
}, {});

module.exports = { APP, E, OTHER, bases, isPlural, keysOf, need, untranslated };
