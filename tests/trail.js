require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/client\/Theme\/trail/] });
const { Trail, SETTINGS } = require((require('./paths').APP + '/client/Theme/trail.js'));
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const lcg = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const colors = { main: '#2dd4e8', second: '#ff2d46', hot: '#eafcff' };
const mk = seed => new Trail({ colors, rnd: lcg(seed || 7) });

// ---- moving
let tr = mk();
t('the first mouse event only remembers the place (nothing yet)', tr.move(100, 100, 0) === 0 && tr.alive === 0);
t('a tiny move (2 px) makes nothing, and the next tiny move adds up', tr.move(102, 100, 10) === 0 && tr.alive === 0 && tr.move(105, 100, 20) === 1);
tr = mk(); tr.move(0, 0, 0); const n40 = tr.move(40, 0, 10);
t('a 40 px move makes 10 squares (one per 4 px), spread along the way', n40 === 10 && tr.particles.length === 10 && tr.particles.every(p => p.x > -3 && p.x < 43 && Math.abs(p.y) < 3));
tr = mk(); tr.move(0, 0, 0); t('a very fast move (1000 px) makes at most ' + SETTINGS.perMove + ' squares', tr.move(1000, 0, 5) === SETTINGS.perMove);
tr = mk(); tr.move(0, 0, 0); for (let i = 1; i <= 60; i++) tr.move(i * 40, 0, i);
t('never more than ' + SETTINGS.max + ' squares (the oldest go first)', tr.particles.length === SETTINGS.max);
tr = mk(); tr.move(0, 0, 0); tr.move(80, 0, 10);
t('the squares drift BACK, away from where the pointer goes (moving right -> they go left)', tr.particles.reduce((s, p) => s + p.vx, 0) / tr.particles.length < 0);
tr = mk(); tr.move(0, 0, 0); tr.move(0, 80, 10);
t('...moving down -> they go up', tr.particles.reduce((s, p) => s + p.vy, 0) / tr.particles.length < 0);

// ---- how they look
tr = mk(3); tr.move(0, 0, 0); for (let i = 1; i <= 40; i++) tr.move(i * 40, 0, i);
const ps = tr.particles;
t('squares are whole pixels from ' + SETTINGS.size[0] + ' to ' + SETTINGS.size[1], ps.every(p => Number.isInteger(p.size) && p.size >= SETTINGS.size[0] && p.size <= SETTINGS.size[1]));
t('they live ' + SETTINGS.life[0] + ' - ' + SETTINGS.life[1] + ' ms', ps.every(p => p.life >= SETTINGS.life[0] && p.life <= SETTINGS.life[1]));
t('colors come only from the theme (main, second) and white-hot', ps.every(p => Object.values(colors).includes(p.color)) && new Set(ps.map(p => p.color)).size === 3);
t('about a quarter are "sparks" (a square with four tiny squares around it)', ps.filter(p => p.spark).length / ps.length > 0.15 && ps.filter(p => p.spark).length / ps.length < 0.4);
const share = hand => { const x = mk(5); x.move(0, 0, 0); for (let i = 1; i <= 40; i++) x.move(i * 40, 0, i, hand); return x.particles.filter(p => p.color === colors.second).length / x.particles.length; };
t('over things you can click the second color shows more (' + share(true).toFixed(2) + ' vs ' + share(false).toFixed(2) + ')', share(true) > share(false) + 0.1);

// ---- click and rest
tr = mk(); tr.click(200, 100, 0);
t('a click: eight squares fly out in eight directions, and one square ripple spreads', tr.particles.length === 8 && tr.ripples.length === 1 && new Set(tr.particles.map(p => Math.round(Math.atan2(p.vy, p.vx) * 100))).size === 8);
t('...they fly faster than the tail squares', tr.particles.every(p => Math.hypot(p.vx, p.vy) >= 0.05));
t('...the ripple is gone after 380 ms', (tr.step(379), tr.ripples.length === 1) && (tr.step(381), tr.ripples.length === 0));
tr = mk(); for (let i = 0; i < 9; i++) tr.click(0, 0, i);
t('no more than 6 ripples at once', tr.ripples.length === 6);
tr = mk(); tr.idle(300, 300, 0);
t('a resting pointer: one slow, long-lived square within about 11 px of it', tr.particles.length === 1 && Math.abs(tr.particles[0].x - 300) <= 11 && Math.abs(tr.particles[0].y - 300) <= 11 && Math.hypot(tr.particles[0].vx, tr.particles[0].vy) < 0.02 && tr.particles[0].life > SETTINGS.life[0] * 1.3);

// ---- time
tr = mk(); tr.move(0, 0, 0); tr.move(100, 0, 0);
const born = tr.particles.length;
t('step: squares live until their time is over, then they are removed', tr.step(100) === born && tr.step(2000) === 0 && tr.alive === 0);
tr = mk(); tr.move(0, 0, 0); tr.leave();
t('leaving the window forgets the last place (no line from the old place to the new one)', tr.move(500, 500, 0) === 0 && tr.alive === 0);
tr = mk(); tr.click(1, 1, 0); tr.clear();
t('clear removes everything', tr.alive === 0 && tr.last === null);

// ---- drawing
const calls = []; const ctx = { set globalAlpha(v) { calls.push(['alpha', v]); }, get globalAlpha() { return 1; }, set fillStyle(v) { calls.push(['fill', v]); }, set strokeStyle(v) { calls.push(['stroke', v]); }, set shadowBlur(v) { calls.push(['blur', v]); }, set shadowColor(v) {}, set lineWidth(v) {}, set globalCompositeOperation(v) { calls.push(['composite', v]); }, clearRect: (...a) => calls.push(['clear', ...a]), fillRect: (...a) => calls.push(['rect', ...a]), strokeRect: (...a) => calls.push(['stroke-rect', ...a]) };
tr = mk(2); tr.move(0, 0, 0); tr.move(80, 0, 0); tr.click(300, 300, 0);
const sparks = tr.particles.filter(p => p.spark).length; const total = tr.particles.length;
calls.length = 0; tr.draw(ctx, 100, 1000, 600);
const rects = calls.filter(c => c[0] === 'rect');
t('draw: clears the canvas first, glows (lighter), and ends with normal settings again', calls[0][0] === 'clear' && calls[0].slice(1).join() === '0,0,1000,600' && calls.some(c => c[0] === 'composite' && c[1] === 'lighter') && calls[calls.length - 1][0] === 'composite' && calls[calls.length - 1][1] === 'source-over' && calls.filter(c => c[0] === 'alpha').pop()[1] === 1);
t('draw: one square per square, and four tiny ones more for every spark (' + total + ' + 4 x ' + sparks + ' = ' + rects.length + ')', rects.length === total + 4 * sparks);
t('draw: all squares sit on whole pixels (sharp edges)', rects.every(r => Number.isInteger(r[1]) && Number.isInteger(r[2])));
t('draw: one ripple outline for the click', calls.filter(c => c[0] === 'stroke-rect').length === 1);
const alphaAt = ms => { const x = mk(9); x.particles.push({ x: 50, y: 50, vx: 0, vy: 0, born: 0, life: 1000, size: 4, spark: false, color: '#fff', phase: 0 }); const seen = []; const c2 = { set globalAlpha(v) { seen.push(v); }, get globalAlpha() { return 1; }, set fillStyle(v) {}, set shadowColor(v) {}, set shadowBlur(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set globalCompositeOperation(v) {}, clearRect() {}, fillRect() {}, strokeRect() {} }; x.draw(c2, ms, 100, 100); return seen[0]; };
t('draw: a square gets fainter with age (and is not drawn at all when it is over)', alphaAt(100) > alphaAt(500) && alphaAt(500) > alphaAt(900) && alphaAt(1500) === 1);
