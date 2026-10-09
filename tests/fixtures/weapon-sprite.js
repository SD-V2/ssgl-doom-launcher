// A made-up weapon sprite for the Upscaler checks (drawn here, not from any game):
// a shotgun seen from the side, tilted, with a dark outline, metal in a few shades,
// a wooden grip with a curve, and a muzzle flash. Classic sprite rules: every pixel is
// solid or see-through, and the hidden colour under see-through pixels is black.
// -> { width, height, data } (RGBA)
const W = 72;
const H = 44;
const make = () => {
  const data = Buffer.alloc(W * H * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = (y * W + x) * 4;
    data[p] = c[0];
    data[p + 1] = c[1];
    data[p + 2] = c[2];
    data[p + 3] = 255;
  };
  const inBarrel = (x, y) => {
    // a tilted band: rises 1 pixel every 3 pixels
    const top = 24 - Math.floor(x / 3);
    return x >= 6 && x <= 60 && y >= top && y <= top + 5;
  };
  const inGrip = (x, y) => {
    // a curved wooden grip under the back of the barrel
    const cx = 16;
    const cy = 34;
    const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    return d <= 9 && y >= 26 && x >= 8 && x <= 26;
  };
  const inFlash = (x, y) => {
    // a diamond (45 degree edges) at the muzzle
    return Math.abs(x - 66) + Math.abs(y - 6) <= 5;
  };
  const metal = [[70, 70, 80], [110, 110, 120], [150, 150, 160], [190, 190, 200]];
  const wood = [[90, 50, 20], [120, 70, 30], [150, 95, 45]];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inBarrel(x, y)) set(x, y, metal[Math.min(3, (y - (24 - Math.floor(x / 3))))]);
      else if (inGrip(x, y)) set(x, y, wood[(x + y) % 3]);
      else if (inFlash(x, y)) set(x, y, Math.abs(x - 66) + Math.abs(y - 6) <= 2 ? [255, 250, 200] : [250, 160, 40]);
    }
  // a dark outline around everything solid
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] === 255;
  const edge = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) edge.push([x, y]);
  edge.forEach(([x, y]) => set(x, y, [30, 25, 20]));
  return { width: W, height: H, data };
};
module.exports = { make, W, H };
