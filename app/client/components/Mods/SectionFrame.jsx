import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// A framed box in the look of a sci-fi screen: thin corner brackets, a faint grid,
// slanted stripes next to the title (top) and next to the explanation (bottom).

const bracket = color => {
  const line = `linear-gradient(${color}, ${color})`;
  const size = 22;
  return [
    `${line} 0 0 / ${size}px 2px no-repeat`,
    `${line} 0 0 / 2px ${size}px no-repeat`,
    `${line} 100% 0 / ${size}px 2px no-repeat`,
    `${line} 100% 0 / 2px ${size}px no-repeat`,
    `${line} 0 100% / ${size}px 2px no-repeat`,
    `${line} 0 100% / 2px ${size}px no-repeat`,
    `${line} 100% 100% / ${size}px 2px no-repeat`,
    `${line} 100% 100% / 2px ${size}px no-repeat`
  ].join(',');
};

const Frame = styled.li`
  position: relative;
  list-style: none;
  margin: 16px 0 20px 0;
  padding: 40px 12px 46px 12px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 3px;
  background: ${({ theme }) => bracket(theme.color.active)},
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 22px 22px,
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 22px 22px,
    radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.07), transparent 65%),
    rgba(0, 0, 0, 0.5);

  /* small markers in the middle of both sides, like in the picture */
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 0;
    height: 0;
    margin-top: -4px;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    opacity: 0.55;
  }

  &::before {
    left: 3px;
    border-right: 6px solid ${({ theme }) => theme.color.active};
  }

  &::after {
    right: 3px;
    border-left: 6px solid ${({ theme }) => theme.color.active};
  }

  /* a mod / folder is dragged over this box */
  box-shadow: ${({ dropping, theme }) =>
    dropping ? `0 0 0 2px ${theme.color.active}, 0 0 18px ${theme.color.active}` : 'none'};

  ul {
    margin: 0;
    padding: 0;
  }
`;

const Empty = styled.div`
  padding: 14px 10px;
  text-align: center;
  font-size: 14px;
  user-select: none;
  color: ${({ theme }) => theme.color.meta};
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 3px;
`;

const Stripes = styled.i`
  display: inline-block;
  width: 46px;
  height: 9px;
  flex-shrink: 0;
  opacity: 0.8;
  background: repeating-linear-gradient(
    115deg,
    ${({ theme }) => theme.color.active} 0,
    ${({ theme }) => theme.color.active} 5px,
    transparent 5px,
    transparent 9px
  );
`;

const Title = styled.div`
  position: absolute;
  top: 10px;
  left: 18px;
  right: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;

  b {
    margin: 0 14px;
    font-weight: normal;
    font-size: 16px;
    letter-spacing: 2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${({ theme }) => theme.color.active};
    text-shadow: ${({ theme }) => theme.font.glow};
  }

  small {
    margin-inline-start: 8px;
    font-size: 13px;
    letter-spacing: 0;
    color: #fff;
    opacity: 0.6;
  }
`;

const Note = styled.div`
  position: absolute;
  bottom: 9px;
  left: 18px;
  right: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;

  span {
    margin: 0 14px;
    text-align: center;
    font-size: 13px;
    line-height: 1.25;
    color: ${({ theme }) => theme.color.meta};
  }
`;

const SectionFrame = ({
  title,
  count,
  note,
  empty,
  dropping = false,
  onDragOver,
  onDragLeave,
  onDrop,
  children
}) => (
  <Frame
    dropping={dropping}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    <Title>
      <Stripes />
      <b>
        {title}
        <small>{count}</small>
      </b>
      <Stripes />
    </Title>
    <ul>{children}</ul>
    {empty ? <Empty>{empty}</Empty> : null}
    {note ? (
      <Note>
        <Stripes />
        <span>{note}</span>
        <Stripes />
      </Note>
    ) : null}
  </Frame>
);

SectionFrame.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  note: PropTypes.string,
  empty: PropTypes.string,
  dropping: PropTypes.bool,
  onDragOver: PropTypes.func,
  onDragLeave: PropTypes.func,
  onDrop: PropTypes.func,
  children: PropTypes.node
};

export default SectionFrame;
