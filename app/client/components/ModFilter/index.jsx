import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import refreshSvg from '../../assets/icon/refresh.svg';
import { useTranslation } from '../../utils';
import { Dropdown, IconButton, Input } from '../Form';
import TabSwitch from '../Mods/TabSwitch';

const ModFilterStyle = styled.div`
  display: flex;
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
      <TabSwitch
        tabs={[
          { value: 'maps', label: t('wads:tabMaps'), count: counts.maps },
          { value: 'mods', label: t('wads:tabMods'), count: counts.mods }
        ]}
        value={section}
        onChange={onSection}
      />
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
