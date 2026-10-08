// The sparkle trail of the Cyberpunk mouse pointer: small squares that come off the
// pointer while it moves, drift a little, twinkle and fade. A click gives a burst of
// squares and a square ripple. This file only holds the logic and the drawing; the
// canvas and the mouse events are in CursorTrail.jsx.
//
//   colors = { main, second, hot }  (hex colors)

export const SETTINGS = {
  max: 110, // never more squares than this
  every: 4, // a new square for every 4 pixels the pointer moves
  perMove: 10, // at most this many for one mouse event (fast moves)
  life: [550, 1000], // how long a square lives (milliseconds)
  size: [3, 6]
};

const between = (rnd, [a, b]) => a + (b - a) * rnd();

export class Trail {
  constructor({ colors, rnd = Math.random } = {}) {
    this.colors = colors;
    this.rnd = rnd;
    this.particles = [];
    this.ripples = [];
    this.last = null;
  }

  get alive() {
    return this.particles.length + this.ripples.length;
  }

  pick(hand) {
    // over things you can click the second color shows more
    const r = this.rnd();
    const limit = hand ? [0.3, 0.8] : [0.55, 0.8];
    if (r < limit[0]) return this.colors.main;
    if (r < limit[1]) return this.colors.second;
    return this.colors.hot;
  }

  add(x, y, now, opts = {}) {
    const rnd = this.rnd;
    // moves away from where the pointer goes
    const angle = opts.angle === undefined ? rnd() * Math.PI * 2 : opts.angle + (rnd() - 0.5) * 1.2;
    const speed = opts.speed === undefined ? 0.01 + rnd() * 0.035 : opts.speed;
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      born: now,
      life: between(rnd, SETTINGS.life) * (opts.long ? 1.4 : 1),
      size: Math.round(between(rnd, SETTINGS.size)),
      spark: rnd() < 0.25, // a square with four tiny squares around it
      color: this.pick(opts.hand),
      phase: rnd() * Math.PI * 2
    });
    if (this.particles.length > SETTINGS.max) {
      this.particles.splice(0, this.particles.length - SETTINGS.max);
    }
  }

  // the pointer moved to x, y
  move(x, y, now, hand = false) {
    if (!this.last) {
      this.last = { x, y };
      return 0;
    }
    const dx = x - this.last.x;
    const dy = y - this.last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.min(SETTINGS.perMove, Math.floor(dist / SETTINGS.every));
    if (steps < 1) return 0; // a tiny move: wait for more
    const back = Math.atan2(-dy, -dx);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.add(
        this.last.x + dx * t + (this.rnd() - 0.5) * 4,
        this.last.y + dy * t + (this.rnd() - 0.5) * 4,
        now - (steps - i) * 4,
        { angle: back, hand }
      );
    }
    this.last = { x, y };
    return steps;
  }

  // the pointer left the window or stopped being watched
  leave() {
    this.last = null;
  }

  // a click: eight squares fly out and a square ripple spreads
  click(x, y, now) {
    for (let i = 0; i < 8; i++) {
      this.add(x, y, now, {
        angle: (i / 8) * Math.PI * 2,
        speed: 0.05 + this.rnd() * 0.05
      });
    }
    this.ripples.push({ x, y, born: now, life: 380 });
    if (this.ripples.length > 6) this.ripples.shift();
  }

  // the pointer rests: now and then one slow square near it
  idle(x, y, now) {
    this.add(x + (this.rnd() - 0.5) * 22, y + (this.rnd() - 0.5) * 22, now, {
      speed: 0.006 + this.rnd() * 0.01,
      long: true
    });
  }

  // remove what is gone; returns how many are left
  step(now) {
    this.particles = this.particles.filter(p => now - p.born < p.life);
    this.ripples = this.ripples.filter(r => now - r.born < r.life);
    return this.alive;
  }

  clear() {
    this.particles = [];
    this.ripples = [];
    this.last = null;
  }

  // draw everything (ctx is already scaled to css pixels)
  draw(ctx, now, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    this.particles.forEach(p => {
      const age = now - p.born;
      if (age < 0) return;
      const t = age / p.life;
      if (t >= 1) return; // over (normally removed by step() already)
      const twinkle = 0.65 + 0.35 * Math.sin(p.phase + t * 30);
      const alpha = Math.pow(1 - t, 1.4) * twinkle;
      if (alpha <= 0.02) return;
      const s = Math.max(1, Math.round(p.size * (1 - 0.45 * t)));
      const x = Math.round(p.x + p.vx * age - s / 2);
      const y = Math.round(p.y + p.vy * age - s / 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(x, y, s, s);
      if (p.spark) {
        const o = s + 2;
        ctx.fillRect(x + Math.floor(s / 2), y - o, 1, 2);
        ctx.fillRect(x + Math.floor(s / 2), y + s + o - 2, 1, 2);
        ctx.fillRect(x - o, y + Math.floor(s / 2), 2, 1);
        ctx.fillRect(x + s + o - 2, y + Math.floor(s / 2), 2, 1);
      }
    });

    ctx.shadowBlur = 0;
    this.ripples.forEach(r => {
      const t = (now - r.born) / r.life;
      if (t < 0 || t >= 1) return;
      const ease = 1 - Math.pow(1 - t, 3);
      const size = Math.round(4 + 30 * ease);
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = this.colors.main;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.round(r.x - size / 2) + 0.5, Math.round(r.y - size / 2) + 0.5, size, size);
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
