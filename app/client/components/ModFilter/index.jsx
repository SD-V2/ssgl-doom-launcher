import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import refreshSvg from '../../assets/icon/refresh.svg';
import { useTranslation } from '../../utils';
import { Dropdown, IconButton, Input } from '../Form';

const ModFilterStyle = styled.div`
  display: flex;
`;

const SwitchStyle = styled.div`
  display: flex;
  margin-bottom: 8px;
  border-radius: ${({ theme }) => theme.border.radius};
  border: 1px solid ${({ theme }) => theme.border.idle};
  overflow: hidden;

  button {
    flex: 1;
    padding: 8px 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 16px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.button.idle};
    background: ${({ theme }) => theme.color.backdrop};
    border: none;
    transition: ${({ theme }) => theme.transition.out};
  }

  button + button {
    border-inline-start: 1px solid ${({ theme }) => theme.border.idle};
  }

  button:hover {
    color: ${({ theme }) => theme.color.active};
  }

  /* same background as the other tab - only the line marks the open one */
  button.on {
    color: ${({ theme }) => theme.color.active};
    text-shadow: ${({ theme }) =>
      `0 0 5px ${theme.color.glow}, 0 0 15px ${theme.color.glow}`};
    box-shadow: inset 0 -3px 0 0 ${({ theme }) => theme.color.active};
  }

  small {
    margin-inline-start: 8px;
    font-size: 13px;
    opacity: 0.7;
  }
`;
const ModFilter = ({
  filterValue,
  sortValue,
  onSort,
  onRefresh,
  onInput,
  refreshLoad,
  onClear,
  size,
  section = 'mods',
  onSection = null,
  counts = { mods: 0, maps: 0 }
}) => {
  const { t } = useTranslation(['wads', 'filters']);

  const opts = [
    {
      label: t('filters:newest'),
      value: 'new'
    },
    {
      label: t('filters:oldest'),
      value: 'old'
    },
    {
      label: t('filters:active'),
      value: 'active'
    },
    {
      label: 'A-Z',
      value: 'asc'
    },
    {
      label: 'Z-A',
      value: 'desc'
    },
    {
      label: t('filters:tag'),
      value: 'tag'
    },
    {
      label: t('filters:folders'),
      value: 'folder'
    },
    {
      label: t('filters:recent'),
      value: 'recent'
    },
    {
      label: t('filters:favFirst'),
      value: 'fav'
    },
    {
      label: t('filters:starred'),
      value: 'starred'
    }
  ];

  const filterInput = (
    <ModFilterStyle>
      <Input
        value={filterValue}
        onChange={onInput}
        placeholder={t(section === 'maps' ? 'wads:filterMaps' : 'wads:filter', {
          size
        })}
        shortcut="ctrl+f,cmd+f"
        onClear={onClear}
        fluid
      />
      <Dropdown
        name="sortvalue"
        options={opts}
        width="200px"
        onChange={onSort}
        value={sortValue}
        shortcut="ctrl+d,cmd+d"
      />
      <IconButton
        svg={refreshSvg}
        onClick={onRefresh}
        load={refreshLoad}
        style={{ margin: 0 }}
      />
    </ModFilterStyle>
  );

  // the switch is only there when a maps directory is set
  if (!onSection) return filterInput;

  return (
    <>
      <SwitchStyle>
        <button
          type="button"
          className={section === 'maps' ? 'on' : undefined}
          onClick={() => onSection('maps')}
        >
          {t('wads:tabMaps')}
          <small>{counts.maps}</small>
        </button>
        <button
          type="button"
          className={section === 'mods' ? 'on' : undefined}
          onClick={() => onSection('mods')}
        >
          {t('wads:tabMods')}
          <small>{counts.mods}</small>
        </button>
      </SwitchStyle>
      {filterInput}
    </>
  );
};

ModFilter.propTypes = {
  section: PropTypes.string,
  onSection: PropTypes.func,
  counts: PropTypes.object,
  filterValue: PropTypes.string.isRequired,
  onInput: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  refreshLoad: PropTypes.bool.isRequired,
  sortValue: PropTypes.string.isRequired,
  onSort: PropTypes.func.isRequired,
  size: PropTypes.number.isRequired,
  onClear: PropTypes.func.isRequired
};

export default ModFilter;
