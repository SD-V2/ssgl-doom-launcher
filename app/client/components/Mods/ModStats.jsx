import byteSize from 'byte-size';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import { useTranslation } from '../../utils';

const StatsStyle = styled.div`
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

  .right {
    margin-inline-start: auto;
  }

  a.fix {
    color: #f5b945;
  }

  a:hover {
    text-decoration: underline;
  }
`;

const ModStats = ({
  count,
  bytes,
  groups,
  onOpen,
  onUsage,
  fixes = 0,
  onFix = () => {}
}) => {
  const { t } = useTranslation(['wads']);

  return (
    <StatsStyle>
      <span>
        <b>{t('wads:statsMods', { count })}</b> · <b>{byteSize(bytes).toString()}</b>
      </span>
      <a onClick={onUsage}>{t('wads:statsUsage')}</a>
      <span className="right">
        {fixes > 0 ? (
          <a className="fix" onClick={onFix}>
            {t('wads:statsFix', { count: fixes })}
          </a>
        ) : null}
        {groups > 0 ? (
          <a onClick={onOpen}>{t('wads:statsDupes', { count: groups })}</a>
        ) : null}
      </span>
    </StatsStyle>
  );
};

ModStats.propTypes = {
  count: PropTypes.number.isRequired,
  bytes: PropTypes.number.isRequired,
  groups: PropTypes.number.isRequired,
  onOpen: PropTypes.func.isRequired,
  onUsage: PropTypes.func.isRequired,
  fixes: PropTypes.number,
  onFix: PropTypes.func
};

export default ModStats;
