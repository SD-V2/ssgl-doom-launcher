import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import Check, { MARKERS } from './Mods/Checkmarks';

// "Active mod marker": the five designs as small pictures to click, and "Automatic"
// (the design that belongs to the color theme).

const Tiles = styled.div`
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 15px;
`;

const Tile = styled.div`
  width: 84px;
  margin-inline-end: 8px;
  margin-bottom: 8px;
  padding: 8px 4px 6px 4px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  background: ${({ theme }) => theme.color.backdrop};
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  transition: ${({ theme }) => theme.transition.out};

  & > div {
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  small {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.1;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.meta};
  }

  &:hover,
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.border.active};
  }

  &.on {
    border-color: ${({ theme }) => theme.color.active};
    box-shadow: 0 0 10px ${({ theme }) => theme.color.glow};
  }

  &.on small {
    color: ${({ theme }) => theme.color.active};
  }
`;

const MarkerPicker = ({ value, onChange, colorTheme, names, autoLabel }) => {
  const pick = id => () => onChange({ name: 'marker', value: id });
  const key = id => e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange({ name: 'marker', value: id });
    }
  };

  const current = MARKERS.indexOf(value) > -1 ? value : 'auto';

  return (
    <Tiles>
      {['auto', ...MARKERS].map(id => (
        <Tile
          key={id}
          role="button"
          tabIndex={0}
          aria-pressed={current === id}
          title={id === 'auto' ? autoLabel : names[id]}
          className={current === id ? 'on' : undefined}
          onClick={pick(id)}
          onKeyDown={key(id)}
        >
          <div>
            <Check theme={id === 'auto' ? colorTheme : id} active size="44" />
          </div>
          <small>{id === 'auto' ? autoLabel : names[id]}</small>
        </Tile>
      ))}
    </Tiles>
  );
};

MarkerPicker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  colorTheme: PropTypes.string,
  names: PropTypes.object.isRequired,
  autoLabel: PropTypes.string.isRequired
};

export default MarkerPicker;
