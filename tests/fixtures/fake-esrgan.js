#!/usr/bin/env node
// A fake "realesrgan-ncnn-vulkan" for the checks: same command line, same printed
// lines, but no graphics card needed. Every picture is made -s times bigger by
// copying pixels (no AI), so the whole Upscaler can be tested anywhere.
//
// Pretend problems (chosen by the model name):
//   oom-...       "out of memory" unless the tile size (-t) is 64 or smaller
//   novulkan-...  the Vulkan start fails (old driver / no graphics card)
//   alphabug-...  pictures WITH an alpha channel come out as noise (the bug some
//                 graphics cards showed); pictures without alpha are fine
//   noisy-...     every picture comes out as noise
// Env: FAKE_ESRGAN_SLOW=ms   wait per picture (to test Cancel)
//      FAKE_ESRGAN_PIDFILE   write the process id there
//      FAKE_ESRGAN_LOG       append the command line (and every input's colour type) there
//      FAKE_ESRGAN_NOISE_FOR noise only for inputs whose file name starts with this
const fs = require('fs');
const path = require('path');
const APP = path.resolve(__dirname, '..', '..', 'app');
const { PNG } = require(APP + '/node_modules/pngjs');
const png = {
  isJpg: b => b[0] === 0xff && b[1] === 0xd8,
  jpgInfo: b => { let p = 2; while (p + 9 < b.length) { if (b[p] !== 0xff) { p++; continue; } const m = b[p + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: b.readUInt16BE(p + 7), height: b.readUInt16BE(p + 5) }; p += 2 + b.readUInt16BE(p + 2); } return null; },
  decode: b => { const r = PNG.sync.read(b); return { width: r.width, height: r.height, data: r.data, colorType: b[25] }; },
  encode: (img, rgb) => { const p = new PNG({ width: img.width, height: img.height }); img.data.copy(p.data); if (rgb) for (let i = 3; i < p.data.length; i += 4) p.data[i] = 255; return PNG.sync.write(p, { colorType: rgb ? 2 : 6 }); }
};

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-v' || args[i] === '-x') opt[args[i].slice(1)] = true;
  else if (args[i][0] === '-') opt[args[i].slice(1)] = args[++i];
}
if (process.env.FAKE_ESRGAN_PIDFILE) fs.writeFileSync(process.env.FAKE_ESRGAN_PIDFILE, String(process.pid));
if (process.env.FAKE_ESRGAN_LOG) fs.appendFileSync(process.env.FAKE_ESRGAN_LOG, JSON.stringify(args) + '\n');
const say = t => process.stderr.write(t + '\n');
const scale = Number(opt.s || 4);
const model = opt.n || 'realesr-animevideov3';
const models = opt.m || 'models';
const tile = Number(opt.t || 0);

if (models.indexOf('models') < 0) { say('unknown model dir type'); process.exit(255); }
const file = model === 'realesr-animevideov3' ? `${model}-x${scale}` : model;
if (!fs.existsSync(path.join(models, file + '.param')) || !fs.existsSync(path.join(models, file + '.bin'))) {
  say(`_wfopen ${path.join(models, file)}.param failed`); process.exit(255);
}
if (/^novulkan/.test(model)) { say('vkCreateInstance failed -9'); say('invalid gpu device'); process.exit(255); }
if (/^oom/.test(model) && (tile === 0 || tile > 64)) {
  say('[0 NVIDIA GeForce RTX 5060]  queueC=2[8]  queueG=0[16]  queueT=1[2]');
  say('vkAllocateMemory failed -2'); process.exit(255);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const bigger = (img, s) => {
  const out = Buffer.alloc(img.width * s * img.height * s * 4);
  for (let y = 0; y < img.height * s; y++)
    for (let x = 0; x < img.width * s; x++) {
      const a = (Math.floor(y / s) * img.width + Math.floor(x / s)) * 4;
      img.data.copy(out, (y * img.width * s + x) * 4, a, a + 4);
    }
  return { width: img.width * s, height: img.height * s, data: out };
};

const one = async (input, output) => {
  const buf = fs.readFileSync(input);
  let img;
  if (png.isJpg(buf)) {
    const info = png.jpgInfo(buf);
    img = { width: info.width, height: info.height, data: Buffer.alloc(info.width * info.height * 4, 128) };
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  } else img = png.decode(buf);
  if (process.env.FAKE_ESRGAN_LOG) fs.appendFileSync(process.env.FAKE_ESRGAN_LOG, JSON.stringify({ input: path.basename(input), colorType: img.colorType }) + '\n');
  const noise = /^noisy/.test(model) || (/^alphabug/.test(model) && (img.colorType === 4 || img.colorType === 6)) ||
    (!!process.env.FAKE_ESRGAN_NOISE_FOR && path.basename(input).indexOf(process.env.FAKE_ESRGAN_NOISE_FOR) === 0);
  if (process.env.FAKE_ESRGAN_SLOW) await sleep(Number(process.env.FAKE_ESRGAN_SLOW));
  say('0.00%');
  const big = bigger(img, scale);
  if (noise) for (let i = 0; i < big.data.length; i++) big.data[i] = Math.random() * 256;
  // like the real engine: an alpha channel stays an alpha channel, no extra chunks
  fs.writeFileSync(output, png.encode(big, img.colorType !== 4 && img.colorType !== 6));
  say('100.00%');
  if (opt.v) say(`${input} -> ${output} done`);
};

(async () => {
  try {
    if (fs.statSync(opt.i).isDirectory()) {
      fs.mkdirSync(opt.o, { recursive: true });
      for (const name of fs.readdirSync(opt.i).sort()) {
        await one(path.join(opt.i, name), path.join(opt.o, name.replace(/\.[^.]+$/, '') + '.png'));
      }
    } else await one(opt.i, opt.o);
    process.exit(0);
  } catch (e) {
    say('decode image failed ' + e.message);
    process.exit(1);
  }
})();
