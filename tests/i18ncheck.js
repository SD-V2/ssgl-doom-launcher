require('@babel/register')({
  presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'], only: [/app\/client\/locales/]
});
const L = (require('./paths').APP + '/client/locales/');
const en = require(L + 'en.js').default, tr = require(L + 'tr.js').default, ar = require(L + 'ar.js').default, ru = require(L + 'ru.js').default;
const flat = (o, p = '') => Object.keys(o).reduce((a, k) => (typeof o[k] === 'object' ? Object.assign(a, flat(o[k], p + k + '.')) : (a[p + k] = o[k], a)), {});
const E = flat(en), T = flat(tr), A = flat(ar), R = flat(ru);
// the keys each language needs: plural keys become key / key_plural (tr) and key_0..key_5 (ar)
const bases = new Set(Object.keys(E).map(k => k.replace(/_plural$/, '')));
const needTr = Object.keys(E), needAr = [], needRu = [];
bases.forEach(b => { if (E[b + '_plural'] !== undefined) { [0,1,2,3,4,5].forEach(i => needAr.push(`${b}_${i}`)); [0,1,2].forEach(i => needRu.push(`${b}_${i}`)); } else { needAr.push(b); needRu.push(b); } });
const missing = (need, have) => need.filter(k => have[k] === undefined);
const extra = (need, have) => Object.keys(have).filter(k => need.indexOf(k) < 0);
console.log('English keys:', Object.keys(E).length, '| Turkish has:', Object.keys(T).length, '| Arabic has:', Object.keys(A).length);
console.log('Turkish missing:', missing(needTr, T).join(', ') || 'none', '| extra:', extra(needTr, T).join(', ') || 'none');
console.log('Russian has:', Object.keys(R).length, '| missing:', missing(needRu, R).join(', ') || 'none', '| extra:', extra(needRu, R).join(', ') || 'none');
console.log('Arabic  missing:', missing(needAr, A).join(', ') || 'none', '| extra:', extra(needAr, A).join(', ') || 'none');
// every {{placeholder}} of English must exist in the translation
const ph = s => (String(s).match(/\{\{[^}]+\}\}/g) || []).map(x => x.replace(/\s/g, '').replace(/,.*\}\}/, '}}'));
const bad = [];
Object.keys(E).forEach(k => {
  const base = k.replace(/_plural$/, '');
  const need = new Set(ph(E[k]));
  const keysT = [k], keysA = k.endsWith('_plural') ? [] : (E[k + '_plural'] !== undefined ? [0,1,2,3,4,5].map(i => `${k}_${i}`) : [k]);
  keysT.forEach(x => { if (T[x] !== undefined) need.forEach(p => { if (p !== '{{count}}' && ph(T[x]).indexOf(p) < 0) bad.push('tr ' + x + ' lacks ' + p); }); });
  const keysR = k.endsWith('_plural') ? [] : (E[k + '_plural'] !== undefined ? [0,1,2].map(i => `${k}_${i}`) : [k]);
  keysR.forEach(x => { if (R[x] !== undefined) need.forEach(p => { if (p !== '{{count}}' && ph(R[x]).indexOf(p) < 0) bad.push('ru ' + x + ' lacks ' + p); }); });
  keysA.forEach(x => { if (A[x] !== undefined) need.forEach(p => { if (p !== '{{count}}' && ph(A[x]).indexOf(p) < 0) bad.push('ar ' + x + ' lacks ' + p); }); });
});
console.log('placeholder problems:', bad.join(' | ') || 'none');
