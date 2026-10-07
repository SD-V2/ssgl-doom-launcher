import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

export const BoxStyle = styled.div`
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  background: ${({ theme }) => theme.box.backdrop};
  backdrop-filter: blur(5px);
  flex-grow: 1;
  padding: 10px;
  height: calc(100vh - 140px);

  .scroll {
    overflow-y: ${p => (p.noscroll ? 'hidden' : 'scroll')};
    ${p => (p.noscroll ? null : p.theme.scrollbar)};
    height: ${p =>
      p.fixed ? `calc(100vh - ${195 + (p.fixedExtra || 0)}px)` : '100%'};
    overflow-x: hidden;
  }

  .content {
    margin-inline-end: 5px;
    margin-bottom: ${p => (p.noscroll ? '0px' : '80px')};
  }
`;

const Box = ({ children, fixed, fixedExtra = 0, noscroll = false }) => {
  return (
    <BoxStyle noscroll={noscroll} fixed={fixed} fixedExtra={fixedExtra}>
      {fixed ? <div className="fixed">{fixed}</div> : null}

      <div className="scroll">
        <div className="content">{children}</div>
      </div>
    </BoxStyle>
  );
};

Box.propTypes = {
  children: PropTypes.any,
  fixed: PropTypes.element,
  fixedExtra: PropTypes.number,
  noscroll: PropTypes.bool
};

export default Box;
