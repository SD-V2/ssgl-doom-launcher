import PropTypes from 'prop-types';
import React, { useContext, useEffect } from 'react';
import { createGlobalStyle, ThemeContext } from 'styled-components';

import CursorTrail, { reducedMotion } from './CursorTrail';

// ---------------------------------------------------------------------------
// Interface styles: how the menus look and feel (shapes, fonts, effects).
// The color theme still decides the colors - every style works with every theme.
//
// A style has two parts:
//   1. applyStyle(): small changes to the theme (fonts, corners)
//   2. a global stylesheet that restyles the parts of SSGL that carry a hook class
//      (ssgl-panel, ssgl-item, ssgl-button, ssgl-input, ssgl-modal, ssgl-section,
//       ssgl-tabs, ssgl-nav, ssgl-folder, ssgl-tag)
// ---------------------------------------------------------------------------

export const STYLES = ['classic', 'cyberpunk', 'gothic'];

export const applyStyle = (theme, style) => {
  if (style === 'cyberpunk') {
    return {
      ...theme,
      interfaceStyle: 'cyberpunk',
      font: {
        ...theme.font,
        head: "'CyberHead', 'Michroma', sans-serif",
        content: "'CyberText', 'Rajdhani', sans-serif"
      },
      border: { ...theme.border, radius: '0px' }
    };
  }
  if (style === 'gothic') {
    return {
      ...theme,
      interfaceStyle: 'gothic',
      font: {
        ...theme.font,
        head: "'GothHead', 'Cinzel Decorative', serif",
        content: "'GothText', 'EB Garamond', serif"
      },
      border: { ...theme.border, radius: '0px' }
    };
  }
  return theme;
};

// '#ffa800' -> 'rgba(255, 168, 0, 0.3)'
export const rgba = (hex, alpha) => {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(h)) return `rgba(255, 168, 0, ${alpha})`;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const accent = alpha => ({ theme }) => rgba(theme.color.active, alpha);
const glow = alpha => ({ theme }) => rgba(theme.color.glow, alpha);
// the second accent of the theme (red next to cyan); themes without one use their glow color
const secondOf = theme => theme.color.second || theme.color.glow;
const second = alpha => ({ theme }) => rgba(secondOf(theme), alpha);

// the shape of a cut corner: top-left and bottom-right are cut by n pixels
const cut = n =>
  `polygon(${n}px 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%, 0 ${n}px)`;
// only the bottom-right corner is cut
const cutOne = n =>
  `polygon(0 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%)`;

// ---- drawings made of gradients (no clipping, so nothing can hide a dropdown) ----

const line = c => `linear-gradient(${c}, ${c})`;

// Four corner brackets like on a HUD: top-left and bottom-right in the main color,
// top-right and bottom-left in the second color. size = length of an arm, t = thickness.
const bracketLayers = (a, b, size, t) => [
  [line(a), `${size}px ${t}px`, '0 0'],
  [line(a), `${t}px ${size}px`, '0 0'],
  [line(b), `${size}px ${t}px`, '100% 0'],
  [line(b), `${t}px ${size}px`, '100% 0'],
  [line(b), `${size}px ${t}px`, '0 100%'],
  [line(b), `${t}px ${size}px`, '0 100%'],
  [line(a), `${size}px ${t}px`, '100% 100%'],
  [line(a), `${t}px ${size}px`, '100% 100%']
];

// a ruler of small ticks: |||||||||
const ruler = (c, width, at) => [
  `repeating-linear-gradient(90deg, ${c} 0, ${c} 1px, transparent 1px, transparent 6px)`,
  `${width}px 4px`,
  at
];

// layers [[image, size, position], ...] -> the three CSS lists (the background color stays)
const layered = layers => `
  background-image: ${layers.map(l => l[0]).join(', ')};
  background-size: ${layers.map(l => l[1]).join(', ')};
  background-position: ${layers.map(l => l[2]).join(', ')};
  background-repeat: no-repeat;
`;

// hazard stripes  ////////
const hazard = c =>
  `repeating-linear-gradient(115deg, ${c} 0, ${c} 3px, transparent 3px, transparent 7px)`;

// a patch of small dots  . . . .
const dots = c => `radial-gradient(circle, ${c} 1px, transparent 1.6px)`;

// A picture written into CSS as data. It must not contain ; ' ( ) or // : the tool that
// builds the style sheet would cut it there and garble everything behind it.
const dataUrl = svg =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')}")`;

// ---- mouse pointers (32 x 32 pictures). arrow = the normal one, hand = over things you can click
const svgOf = body =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`;

// The Cyberpunk pointers, drawn like neon tubes: a dark fill, a soft glow, the colored
// line and a white-hot thin line in the middle.
const NEON_ARROW = 'M3 3 L3 24 L9 19 L13 28 L17 26.3 L13 17.5 L21 17.5 Z';
// a pointing hand
const NEON_HAND =
  'M12 3.2 Q12 2 13.2 2 Q14.4 2 14.4 3.2 V13 H16.2 Q16.8 11.8 18 11.8 Q19.2 11.8 19.6 13 Q20.6 12.2 21.8 12.6 Q22.8 13 23 14.2 Q24.2 14 25 15 Q25.6 16 25.6 17.5 V22 Q25.6 28.5 19 28.5 H15.4 Q11 28.5 8.6 24.2 L5.6 19 Q5 17.8 6.2 17.2 Q7.4 16.6 8.4 17.4 L12 21 Z';
const HOT = '#eafcff';

const neon = (d, main) =>
  `<path d='${d}' fill='#00131a' fill-opacity='0.6' stroke='${main}' stroke-opacity='0.3' stroke-width='4.5' stroke-linejoin='round'/>` +
  `<path d='${d}' fill='none' stroke='${main}' stroke-width='1.8' stroke-linejoin='round'/>` +
  `<path d='${d}' fill='none' stroke='${HOT}' stroke-width='0.6' stroke-linejoin='round'/>`;

const cyberCursors = (main, other) => ({
  // a neon arrow (the trail of squares behind it is drawn live by CursorTrail)
  arrow: `${dataUrl(svgOf(neon(NEON_ARROW, main)))} 3 3, default`,
  // a neon pointing hand, with a small square in the second color on the finger tip
  hand: `${dataUrl(
    svgOf(
      neon(NEON_HAND, main) +
        `<rect x='12.4' y='1' width='2.4' height='2.4' fill='${other}'/>`
    )
  )} 13 3, pointer`
});

const gothicCursors = (main, other) => {
  // a dagger, the tip is at the top left
  const dagger = (blade, guard) =>
    `<g transform='rotate(-45 16 16)' stroke='#000' stroke-opacity='0.7' stroke-width='0.8'>` +
    `<path d='M16 1 L19.5 8 V20 H12.5 V8 Z' fill='${blade}'/>` +
    `<path d='M7 20 H25 V23.5 H7 Z' fill='${guard}'/>` +
    `<rect x='14.2' y='23.5' width='3.6' height='5' fill='${guard}'/>` +
    `<circle cx='16' cy='29.5' r='2.2' fill='${other}'/></g>`;
  return {
    arrow: `${dataUrl(svgOf(dagger(main, main)))} 5 5, default`,
    // the same dagger, with a blood red guard: "this can be used"
    hand: `${dataUrl(svgOf(dagger('#fff3d0', other)))} 5 5, pointer`
  };
};

// the pointer rules of a style
const cursorRules = c => `
  html body,
  html body * {
    cursor: ${c.arrow} !important;
  }

  html body button,
  html body a,
  html body [role='button'],
  html body [draggable='true'],
  html body input[type='range'],
  html body input[type='checkbox'],
  html body label,
  html body .ssgl-item,
  html body .ssgl-folder,
  html body .ssgl-tabs button,
  html body .ssgl-button,
  html body .ssgl-input input[readonly] {
    cursor: ${c.hand} !important;
  }

  html body input[type='text'],
  html body textarea {
    cursor: text !important;
  }

  html body .ssgl-input input[readonly] {
    cursor: ${c.hand} !important;
  }
`;

// ---- the frame around what you reached with the keyboard (Tab).
// (it only shows when the Tab key was used last: html gets the mark data-keyboard)
const focusRules = (ring, glowing, offset) => `
  html[data-keyboard] body button:focus,
  html[data-keyboard] body a:focus,
  html[data-keyboard] body [role='button']:focus,
  html[data-keyboard] body [tabindex]:focus,
  html[data-keyboard] body .ssgl-input:focus-within {
    outline: ${ring};
    outline-offset: ${offset}px;
    box-shadow: ${glowing};
  }

  /* inside a box the box shows the frame, not the text field itself */
  html[data-keyboard] body .ssgl-input input:focus,
  html[data-keyboard] body .ssgl-input textarea:focus {
    outline: none;
    box-shadow: none;
  }
`;

// "html body .x" is stronger than the single class of any normal component style
const CyberpunkStyle = createGlobalStyle`
  /* ---------- the screen: scanlines and a dark edge ---------- */
  body::after {
    content: '';
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 9999;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.16) 0,
        rgba(0, 0, 0, 0.16) 1px,
        transparent 1px,
        transparent 3px
      ),
      radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, 0.5) 100%);
  }

  /* the text of windows (they are drawn outside of the main screen) */
  body {
    font-family: ${({ theme }) => theme.font.content};
  }

  /* ---------- big panels: a thin frame with HUD brackets ----------
     No clip-path on panels, inputs and windows: the lists of dropdowns stick out of
     them, a clipped box would hide the list (and block the clicks). */
  html body .ssgl-panel {
    position: relative;
    border-radius: 0;
    border: 1px solid ${accent(0.4)};
    box-shadow: inset 0 0 60px ${accent(0.06)}, 0 0 18px ${accent(0.1)};
    ${({ theme }) =>
      layered([
        ...bracketLayers(theme.color.active, secondOf(theme), 26, 2),
        ruler(rgba(theme.color.active, 0.8), 130, '52px 0'),
        ruler(rgba(secondOf(theme), 0.8), 90, 'calc(100% - 54px) 100%')
      ])}
  }

  /* red hazard stripes on the top edge, a patch of dots on the bottom edge */
  html body .ssgl-panel::before,
  html body .ssgl-panel::after {
    content: '';
    position: absolute;
    pointer-events: none;
    z-index: 2;
  }

  html body .ssgl-panel::before {
    top: -1px;
    right: 44px;
    width: 76px;
    height: 7px;
    background: ${({ theme }) => hazard(secondOf(theme))};
  }

  html body .ssgl-panel::after {
    bottom: 5px;
    left: 40px;
    width: 40px;
    height: 12px;
    opacity: 0.8;
    background: ${({ theme }) => dots(secondOf(theme))};
    background-size: 8px 6px;
  }

  /* ---------- mods and folders in the lists ---------- */
  html body .ssgl-item {
    position: relative;
    border-radius: 0;
    border: 1px solid ${accent(0.22)};
    border-left: 3px solid ${accent(0.7)};
    clip-path: ${cutOne(12)};
    transition: all 0.15s ease-out;
    ${({ theme }) =>
      layered([
        [line(secondOf(theme)), '30px 2px', '0 100%'],
        [
          `linear-gradient(90deg, ${rgba(theme.color.active, 0.1)} 0%, transparent 45%)`,
          '100% 100%',
          '0 0'
        ]
      ])}
  }

  html body .ssgl-item:hover {
    border-left-color: ${({ theme }) => theme.color.active};
    border-color: ${accent(0.5)};
  }

  html body .ssgl-item h1 {
    letter-spacing: 1.5px;
  }

  html body .ssgl-folder {
    position: relative;
    border-radius: 0;
    border: 1px solid ${accent(0.22)};
    border-left: 3px solid ${second(0.9)};
    clip-path: ${cutOne(10)};
    background-image: linear-gradient(90deg, ${accent(0.12)} 0%, transparent 50%);
  }

  html body .ssgl-folder h2 {
    letter-spacing: 2px;
  }

  html body .ssgl-tag {
    border-radius: 0;
    letter-spacing: 0.5px;
  }

  /* ---------- sections: "[ 2 · MONSTERS ]" ---------- */
  html body .ssgl-section {
    position: relative;
    border-radius: 0;
    border: 1px solid ${accent(0.35)};
    ${({ theme }) =>
      layered([
        ...bracketLayers(theme.color.active, secondOf(theme), 16, 2),
        [
          `linear-gradient(135deg, ${rgba(theme.color.active, 0.1)} 0%, transparent 35%)`,
          '100% 100%',
          '0 0'
        ]
      ])}
  }

  html body .ssgl-section::after {
    content: '';
    position: absolute;
    top: 0;
    right: 36px;
    width: 56px;
    height: 6px;
    pointer-events: none;
    background: ${({ theme }) => hazard(secondOf(theme))};
  }

  html body .ssgl-section h2 {
    font-family: ${({ theme }) => theme.font.head};
    letter-spacing: 3px;
    font-size: 15px;
    text-shadow: 0 0 10px ${glow(0.9)};
  }

  html body .ssgl-section h2::before {
    content: '[ ';
    color: ${second(1)};
  }

  html body .ssgl-section h2::after {
    content: ' ]';
    color: ${second(1)};
  }

  /* ---------- buttons and inputs ---------- */
  html body .ssgl-button {
    position: relative;
    border-radius: 0;
    clip-path: ${cut(8)};
    border: 1px solid ${accent(0.85)};
    background: ${accent(0.07)};
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 600;
  }

  /* a small square in the second color on the corner */
  html body .ssgl-button::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 7px;
    height: 7px;
    background: ${({ theme }) => secondOf(theme)};
    pointer-events: none;
  }

  html body .ssgl-button:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.active};
    box-shadow: 0 0 18px ${glow(0.8)};
  }

  html body .ssgl-button:hover:not(:disabled),
  html body .ssgl-button:hover:not(:disabled) * {
    color: #03070a;
    text-shadow: none;
  }

  html body .ssgl-input {
    border-radius: 0;
    border: 1px solid ${accent(0.28)};
    border-left: 3px solid ${second(0.95)};
    border-bottom: 1px solid ${accent(0.7)};
  }

  html body .ssgl-input input,
  html body .ssgl-input textarea {
    letter-spacing: 0.5px;
  }

  /* ---------- tabs ---------- */
  html body .ssgl-tabs {
    border-radius: 0;
    border-color: ${accent(0.35)};
  }

  html body .ssgl-tabs button {
    clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
    font-family: ${({ theme }) => theme.font.head};
    font-size: 13px;
    letter-spacing: 3px;
  }

  html body .ssgl-tabs button::after {
    height: 3px;
  }

  /* ---------- windows ---------- */
  /* NO "position" here: windows are placed with position: absolute by SSGL */
  html body .ssgl-modal {
    border-radius: 0;
    border: 1px solid ${accent(0.55)};
    box-shadow: 0 0 40px ${glow(0.3)};
    ${({ theme }) =>
      layered([
        ...bracketLayers(theme.color.active, secondOf(theme), 26, 2),
        ruler(rgba(theme.color.active, 0.8), 120, '52px 0'),
        [
          `linear-gradient(180deg, ${rgba(theme.color.active, 0.08)} 0%, transparent 30%)`,
          '100% 100%',
          '0 0'
        ]
      ])}
  }

  html body .ssgl-modal::before,
  html body .ssgl-modal::after {
    content: '';
    position: absolute;
    pointer-events: none;
  }

  html body .ssgl-modal::before {
    top: -1px;
    right: 44px;
    width: 76px;
    height: 7px;
    background: ${({ theme }) => hazard(secondOf(theme))};
  }

  html body .ssgl-modal::after {
    bottom: 5px;
    left: 40px;
    width: 40px;
    height: 12px;
    opacity: 0.8;
    background: ${({ theme }) => dots(secondOf(theme))};
    background-size: 8px 6px;
  }

  html body .ssgl-modal h1 {
    letter-spacing: 3px;
    text-shadow: 0 0 14px ${glow(0.9)};
  }

  html body .ssgl-modal h1::before {
    content: '[ ';
    color: ${second(1)};
  }

  html body .ssgl-modal h1::after {
    content: ' ]';
    color: ${second(1)};
  }

  /* ---------- the main menu ---------- */
  html body .ssgl-nav span {
    font-family: ${({ theme }) => theme.font.head};
    letter-spacing: 4px;
    font-size: 15px;
  }

  html body .ssgl-nav span.active::before {
    content: '//';
    margin-inline-end: 8px;
    color: ${({ theme }) => secondOf(theme)};
  }

  /* ---------- mouse pointer and keyboard frame ---------- */
  ${({ theme }) =>
    cursorRules(cyberCursors(theme.color.active, secondOf(theme)))}

  ${({ theme }) =>
    focusRules(
      `2px solid ${theme.color.active}`,
      `0 0 0 5px ${rgba(secondOf(theme), 0.4)}, 0 0 16px ${rgba(theme.color.active, 0.6)}`,
      2
    )}

  /* ---------- scrollbars ---------- */
  ::-webkit-scrollbar-thumb {
    border-radius: 0 !important;
  }
`;

// ===========================================================================
// Gothic: old chapels and manuscripts - double frames, corner ornaments of
// tracery, diamonds, serif letters, a dark warm edge and a little stone grain.
// (the same rules as for Cyberpunk: nothing that holds a dropdown is clipped,
//  windows keep their position, no sizes or places are changed)
// ===========================================================================

// a corner ornament as a picture: [flip left-right, flip up-down]
const cornerSvg = (color, flipX, flipY) => {
  const m = `matrix(${flipX ? -1 : 1} 0 0 ${flipY ? -1 : 1} ${flipX ? 48 : 0} ${flipY ? 48 : 0})`;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>` +
    `<g transform='${m}' fill='none' stroke='${color}' stroke-linecap='round'>` +
    `<path d='M3 45 V19 Q3 3 19 3 H45' stroke-width='1.6'/>` +
    `<path d='M8 45 V21 Q8 8 21 8 H45' stroke-width='0.8' opacity='0.55'/>` +
    `<circle cx='15' cy='15' r='3.2' stroke-width='1.2'/>` +
    `<path d='M3 41 l3.4 3.5 l-3.4 3.5 l-3.4 -3.5z M41 3 l3.5 3.4 l3.5 -3.4 l-3.5 -3.4z' fill='${color}' stroke='none'/>` +
    `</g></svg>`;
  return dataUrl(svg);
};

// the four corners of a frame
const cornerLayers = (color, size) => [
  [cornerSvg(color, false, false), `${size}px ${size}px`, '0 0'],
  [cornerSvg(color, true, false), `${size}px ${size}px`, '100% 0'],
  [cornerSvg(color, false, true), `${size}px ${size}px`, '0 100%'],
  [cornerSvg(color, true, true), `${size}px ${size}px`, '100% 100%']
];

// a little stone grain
const grain = () => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.7  0 0 0 0.6 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return dataUrl(svg);
};

// a rotated square: the diamond of the ornaments
const diamond = (size, color) => `
  content: '';
  display: inline-block;
  width: ${size}px;
  height: ${size}px;
  transform: rotate(45deg);
  background: ${color};
  box-shadow: 0 0 6px ${color};
`;

const GothicStyle = createGlobalStyle`
  /* ---------- the screen: warm dark edge and stone grain ---------- */
  body::after {
    content: '';
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 9999;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 48%, rgba(8, 2, 2, 0.62) 100%);
  }

  body::before {
    content: '';
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 9998;
    pointer-events: none;
    opacity: 0.07;
    background-image: ${grain()};
  }

  /* the text of windows (they are drawn outside of the main screen) */
  body {
    font-family: ${({ theme }) => theme.font.content};
  }

  /* ---------- big panels: double frame, ornaments in the corners ----------
     No clip-path on panels, inputs and windows (the lists of dropdowns stick out of them). */
  html body .ssgl-panel {
    position: relative;
    border-radius: 0;
    border: 1px solid ${accent(0.6)};
    outline: 1px solid ${accent(0.22)};
    outline-offset: -6px;
    box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.5), 0 0 24px ${second(0.18)};
    ${({ theme }) => layered(cornerLayers(theme.color.active, 40))}
  }

  /* a diamond on the middle of the top and the bottom edge */
  html body .ssgl-panel::before,
  html body .ssgl-panel::after {
    ${({ theme }) => diamond(9, theme.color.active)}
    position: absolute;
    left: 50%;
    margin-left: -5px;
    pointer-events: none;
    z-index: 2;
  }

  html body .ssgl-panel::before {
    top: -5px;
  }

  html body .ssgl-panel::after {
    bottom: -5px;
    background: ${({ theme }) => secondOf(theme)};
    box-shadow: 0 0 6px ${({ theme }) => secondOf(theme)};
  }

  /* ---------- mods and folders in the lists ---------- */
  html body .ssgl-item {
    border-radius: 0;
    border: 1px solid ${accent(0.3)};
    border-left: 5px double ${accent(0.85)};
    background-image: linear-gradient(90deg, ${second(0.28)} 0%, transparent 55%);
    transition: all 0.15s ease-out;
  }

  html body .ssgl-item:hover {
    border-color: ${accent(0.7)};
    box-shadow: inset 0 0 22px ${accent(0.12)};
  }

  html body .ssgl-item h1 {
    letter-spacing: 1px;
    font-weight: 600;
  }

  html body .ssgl-folder {
    border-radius: 0;
    border: 1px solid ${accent(0.3)};
    border-left: 5px double ${second(1)};
    background-image: linear-gradient(90deg, ${accent(0.14)} 0%, transparent 55%);
  }

  html body .ssgl-folder h2 {
    letter-spacing: 2px;
    font-weight: 600;
  }

  html body .ssgl-tag {
    border-radius: 0;
    font-size: 13px;
  }

  /* ---------- sections ---------- */
  html body .ssgl-section {
    position: relative;
    border-radius: 0;
    border: 1px solid ${accent(0.45)};
    outline: 1px solid ${accent(0.18)};
    outline-offset: -5px;
    ${({ theme }) => layered(cornerLayers(theme.color.active, 28))}
  }

  html body .ssgl-section h2 {
    font-family: ${({ theme }) => theme.font.head};
    letter-spacing: 3px;
    font-size: 16px;
    text-shadow: 0 0 10px ${glow(0.9)};
  }

  html body .ssgl-section h2::before {
    ${({ theme }) => diamond(7, secondOf(theme))}
    margin-inline-end: 12px;
    margin-inline-start: 3px;
    vertical-align: middle;
  }

  /* ---------- buttons and inputs ---------- */
  html body .ssgl-button {
    border-radius: 0;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px);
    border: 1px solid ${accent(0.85)};
    background: linear-gradient(180deg, ${accent(0.3)} 0%, ${second(0.34)} 100%);
    font-family: ${({ theme }) => theme.font.head};
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  html body .ssgl-button:hover:not(:disabled) {
    background: linear-gradient(180deg, ${({ theme }) => theme.color.active} 0%, ${accent(0.7)} 100%);
    box-shadow: 0 0 18px ${accent(0.55)};
  }

  html body .ssgl-button:hover:not(:disabled),
  html body .ssgl-button:hover:not(:disabled) * {
    color: #1a0606;
    text-shadow: none;
  }

  html body .ssgl-input {
    border-radius: 0;
    border: 1px solid ${accent(0.35)};
    border-bottom: 3px double ${accent(0.75)};
    box-shadow: inset 0 3px 9px rgba(0, 0, 0, 0.65);
  }

  html body .ssgl-input input,
  html body .ssgl-input textarea {
    font-size: 17px;
    letter-spacing: 0.5px;
  }

  /* ---------- tabs: the top of a church window ---------- */
  html body .ssgl-tabs {
    border-radius: 0;
    border-color: ${accent(0.5)};
  }

  html body .ssgl-tabs button {
    clip-path: polygon(0 100%, 0 38%, 50% 0, 100% 38%, 100% 100%);
    font-family: ${({ theme }) => theme.font.head};
    font-size: 13px;
    letter-spacing: 3px;
    padding-top: 12px;
  }

  html body .ssgl-tabs button::after {
    height: 3px;
  }

  /* ---------- windows ---------- */
  /* NO "position" here: windows are placed with position: absolute by SSGL */
  html body .ssgl-modal {
    border-radius: 0;
    border: 1px solid ${accent(0.65)};
    outline: 1px solid ${accent(0.22)};
    outline-offset: -6px;
    box-shadow: 0 0 44px ${second(0.35)}, inset 0 0 70px rgba(0, 0, 0, 0.5);
    ${({ theme }) => layered(cornerLayers(theme.color.active, 40))}
  }

  html body .ssgl-modal::before {
    ${({ theme }) => diamond(10, theme.color.active)}
    position: absolute;
    top: -6px;
    left: 50%;
    margin-left: -5px;
    pointer-events: none;
  }

  html body .ssgl-modal h1 {
    letter-spacing: 3px;
    text-shadow: 0 0 14px ${glow(0.95)};
  }

  html body .ssgl-modal h1::before {
    ${({ theme }) => diamond(7, secondOf(theme))}
    margin-inline-end: 12px;
    margin-inline-start: 3px;
    vertical-align: middle;
  }

  /* ---------- the main menu ---------- */
  html body .ssgl-nav span {
    font-family: ${({ theme }) => theme.font.head};
    letter-spacing: 3px;
    font-size: 15px;
  }

  html body .ssgl-nav span.active::before {
    ${({ theme }) => diamond(8, secondOf(theme))}
    margin-inline-end: 12px;
    vertical-align: middle;
  }

  /* ---------- mouse pointer and keyboard frame ---------- */
  ${({ theme }) =>
    cursorRules(gothicCursors(theme.color.active, secondOf(theme)))}

  ${({ theme }) =>
    focusRules(
      `1px solid ${theme.color.active}`,
      `0 0 0 5px ${rgba(theme.color.active, 0.2)}, 0 0 14px ${rgba(secondOf(theme), 0.5)}`,
      3
    )}

  /* ---------- scrollbars ---------- */
  ::-webkit-scrollbar-thumb {
    border-radius: 0 !important;
  }
`;

// html gets the mark "data-keyboard" when Tab or an arrow key was used last, and loses it
// when the mouse is used. The keyboard frame of the styles only shows while it is there.
const useKeyboardMark = active => {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    const onKey = e => {
      if (e.key === 'Tab' || /^Arrow/.test(e.key)) root.setAttribute('data-keyboard', '1');
    };
    const onMouse = () => root.removeAttribute('data-keyboard');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onMouse, true);
      root.removeAttribute('data-keyboard');
    };
  }, [active]);
};

// the sparkle trail is only for the Cyberpunk style, can be switched off in Settings
// (trail = false) and is not drawn when the system asks for less motion
export const StyleLayer = ({ style, trail = true }) => {
  const theme = useContext(ThemeContext);
  useKeyboardMark(style === 'cyberpunk' || style === 'gothic');
  if (style === 'cyberpunk') {
    const colors = theme && theme.color
      ? { main: theme.color.active, second: secondOf(theme), hot: '#eafcff' }
      : null;
    return (
      <>
        <CyberpunkStyle />
        {trail && colors && !reducedMotion() ? <CursorTrail colors={colors} /> : null}
      </>
    );
  }
  if (style === 'gothic') return <GothicStyle />;
  return null;
};

StyleLayer.propTypes = { style: PropTypes.string, trail: PropTypes.bool };
