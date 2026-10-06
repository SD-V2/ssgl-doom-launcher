import byteSize from 'byte-size';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import styled from 'styled-components';

import { useTranslation } from '../../utils';

const StatsStyle = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  height: 26px;
  margin-top: 4px;
  font-size: 14px;
  user-select: none;
  color: ${({ theme }) => theme.color.meta};

  b {
    font-weight: normal;
    color: #fff;
  }

  a {
    cursor: pointer;
    margin-inline-start: 14px;
    color: ${({ theme }) => theme.color.active};
  }

  a:hover {
    text-decoration: underline;
  }

  .right {
    margin-inline-start: auto;
  }

  a.fix {
    color: #f5b945;
  }

  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-inline-start: 5px;
    border-radius: 50%;
    background: #f5b945;
  }
`;

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
`;

const Menu = styled.ul`
  position: absolute;
  bottom: 30px;
  right: 0;
  z-index: 41;
  min-width: 190px;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: #000;
  border-radius: ${({ theme }) => theme.border.radius};
  border: 1px solid ${({ theme }) => theme.border.active};

  [dir='rtl'] & {
    right: auto;
    left: 0;
  }

  li {
    padding: 5px 14px;
    cursor: pointer;
    color: #fff;
    white-space: nowrap;
  }

  li:hover {
    background: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme.color.active};
  }
`;

const ModStats = ({
  count,
  bytes,
  groups,
  onOpen,
  onUsage,
  onHealth = () => {},
  fixes = 0,
  onFix = () => {},
  initiallyOpen = false
}) => {
  const { t } = useTranslation(['wads']);
  const [open, setOpen] = useState(initiallyOpen);

  const choose = fn => () => {
    setOpen(false);
    fn();
  };

  return (
    <StatsStyle>
      <span>
        <b>{t('wads:statsMods', { count })}</b> · <b>{byteSize(bytes).toString()}</b>
      </span>
      <span className="right">
        {fixes > 0 ? (
          <a className="fix" onClick={onFix}>
            {t('wads:statsFix', { count: fixes })}
          </a>
        ) : null}
        <a onClick={() => setOpen(!open)}>
          {t('wads:tools')} ▾{groups > 0 ? <i className="dot" /> : null}
        </a>
      </span>
      {open ? (
        <>
          <Backdrop onClick={() => setOpen(false)} />
          <Menu>
            <li onClick={choose(onUsage)}>{t('wads:statsUsage')}</li>
            <li onClick={choose(onHealth)}>{t('wads:healthMenu')}</li>
            {groups > 0 ? (
              <li onClick={choose(onOpen)}>{t('wads:statsDupes', { count: groups })}</li>
            ) : null}
          </Menu>
        </>
      ) : null}
    </StatsStyle>
  );
};

ModStats.propTypes = {
  count: PropTypes.number.isRequired,
  bytes: PropTypes.number.isRequired,
  groups: PropTypes.number.isRequired,
  onOpen: PropTypes.func.isRequired,
  onUsage: PropTypes.func.isRequired,
  onHealth: PropTypes.func,
  fixes: PropTypes.number,
  onFix: PropTypes.func,
  initiallyOpen: PropTypes.bool
};

export default ModStats;
