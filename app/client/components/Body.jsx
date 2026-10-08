import styled from 'styled-components';

import background from '#/assets/ssglwall.png';

import { image } from '../utils';

const clamp = (value, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};

// how the picture is laid on the window (Settings: Wallpaper fit)
//   cover   = fills the whole window, what does not fit is cropped (default)
//   contain = the whole picture is visible; the rest around it is filled
//             (with a dark, blurred copy of the picture - plain black for a GIF)
//   stretch = the picture is pulled to exactly the size of the window (may distort)
export const FITS = ['cover', 'contain', 'stretch'];
export const fitOf = value => (FITS.indexOf(value) > -1 ? value : 'cover');

const SIZES = { cover: 'cover', contain: 'contain', stretch: '100% 100%' };

const wallUrl = p =>
  p.background && p.background.trim() !== ''
    ? `url("file://${image(p.background)}")`
    : `url(${background})`;

const isGif = p => /\.gif$/i.test(p.background || '');

// The wallpaper lives on its own layer behind everything, so it can be darkened
// and blurred without touching the texts and buttons on top of it.
//   dim  = darkening in percent (0 - 80)
//   blur = blur in pixels (0 - 12)
export default styled.div`
  position: relative;
  isolation: isolate;
  font-family: ${({ theme }) => (theme.font && theme.font.content) || "'Rajdhani', sans-serif"};
  color: white;
  background-color: #000;
  width: 100vw;
  height: 100vh;
  ${p =>
    clamp(p.blur, 0, 12) > 0 || fitOf(p.fit) === 'contain'
      ? 'overflow: hidden;'
      : ''}

  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: -1;
    background-image: ${wallUrl};
    background-repeat: no-repeat;
    background-size: ${p => SIZES[fitOf(p.fit)]};
    background-position: center center;
    ${p => {
      const dim = clamp(p.dim, 0, 80);
      const blur = clamp(p.blur, 0, 12);
      if (!dim && !blur) return '';
      const parts = [];
      if (dim) parts.push(`brightness(${(1 - dim / 100).toFixed(2)})`);
      if (blur) parts.push(`blur(${blur}px)`);
      // a little larger, so the blurred edges do not show (only when the picture fills the window)
      const grow = blur && fitOf(p.fit) === 'cover' ? ' transform: scale(1.06);' : '';
      return `filter: ${parts.join(' ')};${grow}`;
    }}
  }

  /* "Fit": the space around the picture shows a dark, blurred copy of it */
  ${p => {
    if (fitOf(p.fit) !== 'contain' || isGif(p)) return '';
    const dim = clamp(p.dim, 0, 80);
    return `
  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: -2;
    background-image: ${wallUrl(p)};
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center center;
    filter: blur(30px) brightness(${(0.45 * (1 - dim / 100)).toFixed(2)});
    transform: scale(1.15);
  }
  `;
  }}
`;
