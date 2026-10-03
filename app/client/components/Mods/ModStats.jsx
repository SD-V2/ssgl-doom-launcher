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
    margin-left: 14px;
    color: ${({ theme }) => theme.color.active};
  }

  a.dupes {
    margin-left: auto;
  }

  a:hover {
    text-decoration: underline;
  }
`;

const ModStats = ({ count, bytes, groups, onOpen, onUsage }) => {
  const { t } = useTranslation(['wads']);

  return (
    <StatsStyle>
      <span>
        <b>{t('wads:statsMods', { count })}</b> · <b>{byteSize(bytes).toString()}</b>
      </span>
      <a onClick={onUsage}>{t('wads:statsUsage')}</a>
      {groups > 0 ? (
        <a className="dupes" onClick={onOpen}>{t('wads:statsDupes', { count: groups })}</a>
      ) : null}
    </StatsStyle>
  );
};

ModStats.propTypes = {
  count: PropTypes.number.isRequired,
  bytes: PropTypes.number.isRequired,
  groups: PropTypes.number.isRequired,
  onOpen: PropTypes.func.isRequired,
  onUsage: PropTypes.func.isRequired
};

export default ModStats;
