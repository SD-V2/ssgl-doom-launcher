import PropTypes from 'prop-types';
import React from 'react';
import { createGlobalStyle } from 'styled-components';

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

export const STYLES = ['classic', 'cyberpunk'];

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

  /* ---------- scrollbars ---------- */
  ::-webkit-scrollbar-thumb {
    border-radius: 0 !important;
  }
`;

export const StyleLayer = ({ style }) =>
  style === 'cyberpunk' ? <CyberpunkStyle /> : null;

StyleLayer.propTypes = { style: PropTypes.string };
