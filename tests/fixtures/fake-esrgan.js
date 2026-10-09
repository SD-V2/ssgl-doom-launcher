#!/usr/bin/env node
// A fake "realesrgan-ncnn-vulkan" for the checks: same command line, same printed
// lines, but no graphics card needed. Every picture is made -s times bigger by
// copying pixels (no AI), so the whole Upscaler can be tested anywhere.
//
// Pretend problems (chosen by the model name):
//   oom-...       "out of memory" unless the tile size (-t) is 64 or smaller
//   novulkan-...  the Vulkan start fails (old driver / no graphics card)
// Env: FAKE_ESRGAN_SLOW=ms   wait per picture (to test Cancel)
//      FAKE_ESRGAN_PIDFILE   write the process id there
//      FAKE_ESRGAN_LOG       append the command line there
const fs = require('fs');
const path = require('path');
const APP = path.resolve(__dirname, '..', '..', 'app');
require(path.resolve(__dirname, '..', 'node_modules', '@babel/register'))({
  presets: [[APP + '/node_modules/@babel/preset-env', { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'],
  only: [/app[\\/]electron[\\/]utils[\\/]png/]
});
const png = require(APP + '/electron/utils/png.js');

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
  } else img = await png.decode(buf);
  if (process.env.FAKE_ESRGAN_SLOW) await sleep(Number(process.env.FAKE_ESRGAN_SLOW));
  say('0.00%');
  // like the real engine: the hidden colours and the alpha are kept, no extra chunks
  fs.writeFileSync(output, await png.encode(bigger(img, scale), [], { rgb: png.isOpaque(img) }));
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
