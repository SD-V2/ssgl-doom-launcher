import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import Icon from './Icon';

// One section of the load order, drawn like the other boxes of SSGL
// (same background, border and corners as the mods and the folder rows).

const Box = styled.li`
  list-style: none;
  margin: 0 0 14px 0;
  padding: 10px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  transition: ${({ theme }) => theme.transition.out};
  box-shadow: ${({ dropping, theme }) =>
    dropping ? `0 0 0 1px ${theme.color.active}, 0 0 14px ${theme.color.glow}` : 'none'};
  border-color: ${({ dropping, theme }) =>
    dropping ? theme.border.active : theme.border.idle};

  ul {
    margin: 0;
    padding: 0;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  user-select: none;

  h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${({ theme }) => theme.color.active};
    text-shadow: ${({ theme }) => theme.font.glow};
  }

  .count {
    margin-inline-start: 10px;
    font-size: 14px;
    color: ${({ theme }) => theme.color.meta};
  }

  .arrows {
    display: flex;
    align-items: center;
    margin-inline-start: auto;
    padding-inline-start: 12px;
  }

  .arrows > span {
    display: block;
    margin-inline-start: 12px;
    line-height: 0;
  }

  .arrows > span.off {
    opacity: 0.2;
    pointer-events: none;
  }
`;

const Note = styled.div`
  margin-top: 8px;
  padding-top: 8px;
  font-size: 13px;
  line-height: 1.3;
  user-select: none;
  color: ${({ theme }) => theme.color.meta};
  border-top: 1px solid rgba(255, 255, 255, 0.07);
`;

const Empty = styled.div`
  padding: 12px 10px;
  text-align: center;
  font-size: 14px;
  user-select: none;
  color: ${({ theme }) => theme.color.meta};
  border: 1px dashed ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
`;

const SectionFrame = ({
  title,
  count,
  note,
  empty,
  dropping = false,
  moveable = true,
  canUp = false,
  canDown = false,
  onUp,
  onDown,
  onDragOver,
  onDragLeave,
  onDrop,
  children
}) => (
  <Box
    dropping={dropping}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    <Header>
      <h2>{title}</h2>
      <span className="count">{count}</span>
      {moveable ? (
        <div className="arrows">
          <span className={canUp ? undefined : 'off'}>
            <Icon name="up" width="13" onClick={canUp ? onUp : undefined} />
          </span>
          <span className={canDown ? undefined : 'off'}>
            <Icon name="down" width="13" onClick={canDown ? onDown : undefined} />
          </span>
        </div>
      ) : null}
    </Header>
    <ul>{children}</ul>
    {empty ? <Empty>{empty}</Empty> : null}
    {note ? <Note>{note}</Note> : null}
  </Box>
);

SectionFrame.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  note: PropTypes.string,
  empty: PropTypes.string,
  dropping: PropTypes.bool,
  moveable: PropTypes.bool,
  canUp: PropTypes.bool,
  canDown: PropTypes.bool,
  onUp: PropTypes.func,
  onDown: PropTypes.func,
  onDragOver: PropTypes.func,
  onDragLeave: PropTypes.func,
  onDrop: PropTypes.func,
  children: PropTypes.node
};

export default SectionFrame;
