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

// the shape of a cut corner: top-left and bottom-right are cut by n pixels
const cut = n =>
  `polygon(${n}px 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%, 0 ${n}px)`;
// only the bottom-right corner is cut
const cutOne = n =>
  `polygon(0 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%)`;

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

  /* ---------- big panels ----------
     No clip-path here: the lists of dropdowns stick out of panels, a clipped panel
     would hide them (and block the clicks). The cut corner is a small corner flag. */
  html body .ssgl-panel {
    position: relative;
    border-radius: 0;
    border-color: ${accent(0.3)};
    box-shadow: inset 0 0 60px ${accent(0.07)};
  }

  /* corner flags: top-left in the color of the theme, bottom-right in its second color */
  html body .ssgl-panel::before,
  html body .ssgl-panel::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
    z-index: 2;
  }

  html body .ssgl-panel::before {
    top: 0;
    left: 0;
    border-top: 14px solid ${({ theme }) => theme.color.active};
    border-right: 14px solid transparent;
    filter: drop-shadow(0 0 4px ${accent(0.9)});
  }

  html body .ssgl-panel::after {
    right: 0;
    bottom: 0;
    border-bottom: 14px solid ${({ theme }) => theme.color.glow};
    border-left: 14px solid transparent;
    filter: drop-shadow(0 0 4px ${glow(0.9)});
  }

  /* ---------- mods and folders in the lists ---------- */
  html body .ssgl-item {
    border-radius: 0;
    border-left: 3px solid ${accent(0.55)};
    clip-path: ${cutOne(12)};
    background-image: linear-gradient(90deg, ${accent(0.1)} 0%, transparent 45%);
    transition: all 0.15s ease-out;
  }

  html body .ssgl-item:hover {
    border-left-color: ${({ theme }) => theme.color.active};
    background-image: linear-gradient(90deg, ${accent(0.22)} 0%, transparent 60%);
  }

  html body .ssgl-item h1 {
    letter-spacing: 1.5px;
  }

  html body .ssgl-folder {
    border-radius: 0;
    border-left: 3px solid ${accent(0.55)};
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

  /* ---------- sections ---------- */
  html body .ssgl-section {
    border-radius: 0;
    border-color: ${accent(0.3)};
    border-left: 3px solid ${({ theme }) => theme.color.active};
    clip-path: ${cut(14)};
    background-image: linear-gradient(135deg, ${accent(0.1)} 0%, transparent 35%);
  }

  html body .ssgl-section h2 {
    font-family: ${({ theme }) => theme.font.head};
    letter-spacing: 3px;
    font-size: 15px;
    text-shadow: 1px 0 rgba(255, 0, 60, 0.55), -1px 0 rgba(0, 240, 255, 0.55),
      0 0 10px ${glow(0.9)};
  }

  /* ---------- buttons and inputs ---------- */
  html body .ssgl-button {
    border-radius: 0;
    clip-path: ${cut(9)};
    border: 1px solid ${accent(0.7)};
    background: linear-gradient(180deg, ${accent(0.2)} 0%, ${accent(0.06)} 100%);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 600;
  }

  html body .ssgl-button:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.active};
    box-shadow: 0 0 18px ${glow(0.8)};
  }

  html body .ssgl-button:hover:not(:disabled),
  html body .ssgl-button:hover:not(:disabled) * {
    color: #05070a;
    text-shadow: none;
  }

  /* no clip-path on inputs: the list of a dropdown sticks out of its box */
  html body .ssgl-input {
    border-radius: 0;
    border-left: 3px solid ${accent(0.8)};
  }

  html body .ssgl-input input,
  html body .ssgl-input textarea {
    letter-spacing: 0.5px;
  }

  /* ---------- tabs ---------- */
  html body .ssgl-tabs {
    border-radius: 0;
    border-color: ${accent(0.3)};
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
  html body .ssgl-modal {
    position: relative;
    border-radius: 0;
    border-top: 2px solid ${({ theme }) => theme.color.active};
    border-left: 3px solid ${({ theme }) => theme.color.active};
    box-shadow: 0 0 40px ${glow(0.35)};
    background-image: linear-gradient(180deg, ${accent(0.08)} 0%, transparent 30%);
  }

  /* a corner flag at the bottom right (windows can hold dropdowns: no clip-path) */
  html body .ssgl-modal::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    width: 0;
    height: 0;
    pointer-events: none;
    border-bottom: 18px solid ${({ theme }) => theme.color.glow};
    border-left: 18px solid transparent;
    filter: drop-shadow(0 0 4px ${glow(0.9)});
  }

  html body .ssgl-modal h1 {
    letter-spacing: 3px;
    text-shadow: 2px 0 rgba(255, 0, 60, 0.55), -2px 0 rgba(0, 240, 255, 0.55),
      0 0 14px ${glow(0.9)};
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
    color: ${({ theme }) => theme.color.active};
  }

  /* ---------- scrollbars ---------- */
  ::-webkit-scrollbar-thumb {
    border-radius: 0 !important;
  }
`;

export const StyleLayer = ({ style }) =>
  style === 'cyberpunk' ? <CyberpunkStyle /> : null;

StyleLayer.propTypes = { style: PropTypes.string };
