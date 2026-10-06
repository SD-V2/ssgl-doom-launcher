import styled from 'styled-components';

import background from '#/assets/ssglwall.png';

import { image } from '../utils';

const clamp = (value, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};

// The wallpaper lives on its own layer behind everything, so it can be darkened
// and blurred without touching the texts and buttons on top of it.
//   dim  = darkening in percent (0 - 80)
//   blur = blur in pixels (0 - 12)
export default styled.div`
  position: relative;
  isolation: isolate;
  font-family: 'Rajdhani', sans-serif;
  color: white;
  background-color: #000;
  width: 100vw;
  height: 100vh;
  ${p => (clamp(p.blur, 0, 12) > 0 ? 'overflow: hidden;' : '')}

  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: -1;
    background: ${p =>
      p.background && p.background.trim() !== ''
        ? `url("file://${image(p.background)}")`
        : `url(${background})`};
    background-size: cover;
    background-position: center center;
    ${p => {
      const dim = clamp(p.dim, 0, 80);
      const blur = clamp(p.blur, 0, 12);
      if (!dim && !blur) return '';
      const parts = [];
      if (dim) parts.push(`brightness(${(1 - dim / 100).toFixed(2)})`);
      if (blur) parts.push(`blur(${blur}px)`);
      // a little larger, so the blurred edges do not show
      return `filter: ${parts.join(' ')};${blur ? ' transform: scale(1.06);' : ''}`;
    }}
  }
`;
