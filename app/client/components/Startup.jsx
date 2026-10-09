import PropTypes from 'prop-types';
import React from 'react';
import styled, { keyframes } from 'styled-components';

import { useTranslation } from '../utils';
import Logo from './Logo';

// The first thing you see: the SSGL logo, a thin moving line and how many mods are
// read. Same colours as the little page that is shown even before this code runs
// (production.html), so the window never flashes white.

export const START_BACK = '#0d0f12';
const LOOK = 'ssgl.look';

// the colours of the last start (so the very first frame already has them)
export const savedLook = () => {
  try {
    const l = JSON.parse(window.localStorage.getItem(LOOK));
    return l && typeof l === 'object' ? l : {};
  } catch (e) {
    return {};
  }
};

export const saveLook = look => {
  try {
    window.localStorage.setItem(LOOK, JSON.stringify(look));
  } catch (e) {
    // the next start uses the default colours
  }
};

// how many mods the last start had ("Scanning 560 mods...")
const COUNT = 'ssgl.modCount';
export const savedCount = () => {
  try {
    const n = Number(window.localStorage.getItem(COUNT));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    return 0;
  }
};
export const saveCount = n => {
  try {
    window.localStorage.setItem(COUNT, String(n));
  } catch (e) {
    // only for the text
  }
};

const slide = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(260%); }
`;

const Screen = styled.div`
  position: fixed;
  inset: 0;
  background-color: ${START_BACK};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.font.head};
  color: #b8b8b8;
  user-select: none;

  .line {
    width: 260px;
    height: 2px;
    margin: 22px 0 14px 0;
    overflow: hidden;
    background-color: rgba(255, 255, 255, 0.08);
  }

  .line div {
    width: 40%;
    height: 100%;
    background-color: ${({ theme }) => theme.color.active};
    box-shadow: 0 0 6px ${({ theme }) => theme.color.glow};
    animation: ${slide} 1.1s ease-in-out infinite;
  }

  p {
    margin: 0;
    font-size: 14px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    .line div {
      animation: none;
      width: 100%;
    }
  }
`;

export const LoadingScreen = ({ count }) => {
  const { t } = useTranslation('common');
  return (
    <Screen data-startup="loading">
      <div style={{ width: 220 }}>
        <Logo height="130" center />
      </div>
      <div className="line">
        <div />
      </div>
      <p>{count ? t('startScanning', { n: count }) : t('startReading')}</p>
    </Screen>
  );
};

LoadingScreen.propTypes = {
  count: PropTypes.number
};

// a thin line at the top while the folders are checked in the background
const Line = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 1000;
  overflow: hidden;
  pointer-events: none;

  div {
    width: 30%;
    height: 100%;
    background-color: ${({ theme }) => theme.color.active};
    box-shadow: 0 0 6px ${({ theme }) => theme.color.glow};
    animation: ${slide} 1.4s ease-in-out infinite;
  }
`;

export const CheckingLine = () => {
  const { t } = useTranslation('common');
  return (
    <Line data-startup="checking" title={t('startChecking')}>
      <div />
    </Line>
  );
};
