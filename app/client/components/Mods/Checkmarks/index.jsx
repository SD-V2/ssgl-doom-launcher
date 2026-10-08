import PropTypes from 'prop-types';
import React from 'react';

import CheckMarkStyle from './CheckMarkStyle';
import collection from './Collection';

// The designs of the active mod marker (the pictures are in Collection.jsx)
// the groups: five classic ones, three for Cyberpunk, three for Gothic, four for the holidays, two skulls,
// five emblems
// (the groups only decide the order in the picker; it shows them all in one grid)
export const MARKER_GROUPS = {
  classic: ['hell', 'uac', 'bfg', 'pinkie', 'slayer'],
  cyberpunk: ['target', 'chip', 'bolt'],
  gothic: ['cross', 'rose', 'arch'],
  seasonal: ['christmas', 'halloween', 'ramadan', 'eid'],
  skulls: ['skull', 'demonskull'],
  emblems: ['brand', 'demonmask', 'mechagoat', 'spider', 'biohazard']
};

export const MARKERS = [
  ...MARKER_GROUPS.classic,
  ...MARKER_GROUPS.cyberpunk,
  ...MARKER_GROUPS.gothic,
  ...MARKER_GROUPS.seasonal,
  ...MARKER_GROUPS.skulls,
  ...MARKER_GROUPS.emblems
];

// The design in use: the one chosen in Settings ("marker"). When it says "auto"
// (or nothing): the target in the Cyberpunk style, the cross in the Gothic style,
// and in the Classic style the one that belongs to the color theme, as it always was.
export const markerOf = settings => {
  if (MARKERS.indexOf(settings.marker) > -1) return settings.marker;
  if (settings.style === 'cyberpunk') return 'target';
  if (settings.style === 'gothic') return 'cross';
  return settings.theme;
};

const CheckMark = ({ theme, active, size, onClick }) => {
  const ThemedCheckMark = collection[theme] || collection['hell'];
  return (
    <CheckMarkStyle onClick={onClick}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 347 347"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={active ? 'active' : undefined}
      >
        <g className="ring-outer">
          <path d="M183.5 43.5H164L174 11L183.5 43.5Z" />
          <path d="M183.5 304H164L174 336.5L183.5 304Z" />
          <path d="M43.5 164L43.5 183.5L11 173.5L43.5 164Z" />
          <path d="M304 164L304 183.5L336.5 173.5L304 164Z" />
          <circle cx="174" cy="174" r="129" />
        </g>

        <circle className="ring-inner" transform="matrix(1 0 0 -1 174 174)" />

        <g className="pent">
          <ThemedCheckMark />
        </g>
      </svg>
    </CheckMarkStyle>
  );
};

CheckMark.propTypes = {
  active: PropTypes.bool,
  onClick: PropTypes.func,
  size: PropTypes.string,
  theme: PropTypes.string
};

export default CheckMark;
