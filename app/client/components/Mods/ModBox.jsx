import PropTypes from 'prop-types';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import VirtualList from 'react-tiny-virtual-list';
import styled from 'styled-components';

import { useTranslation } from '../../utils';
import groupByFolder from '../../utils/groupByFolder';
import ModItem from './ModItem';

const BoxStyle = styled.div`
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  background: ${({ theme }) => theme.box.backdrop};
  backdrop-filter: blur(5px);
  flex-grow: 1;
  padding: 10px;
  height: calc(100vh - 140px);

  & > ul > div {
    padding-right: 5px;
    overflow-x: hidden !important;
    overflow-y: scroll !important;
    ${({ theme }) => theme.scrollbar};
  }
`;

const FolderStyle = styled.div`
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  margin-bottom: 5px;
  cursor: pointer;
  user-select: none;
  background: ${({ theme }) => theme.color.backdrop};
  border-radius: ${({ theme }) => theme.border.radius};
  border: 1px solid ${({ theme }) => theme.border.idle};
  transition: ${({ theme }) => theme.transition.out};

  &:hover {
    border: 1px solid ${({ theme }) => theme.border.active};
  }

  &:hover h2 {
    color: ${({ theme }) => theme.color.active};
  }

  h2 {
    margin: 0 0 0 12px;
    font-size: 18px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: ${({ theme }) => theme.transition.out};
  }

  span {
    margin-left: auto;
    padding-left: 12px;
    white-space: nowrap;
    font-size: 14px;
    color: ${({ theme }) => theme.color.meta};
  }

  span b {
    font-weight: normal;
    color: ${({ theme }) => theme.color.active};
  }
`;

const Arrow = styled.i`
  flex-shrink: 0;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid ${({ theme }) => theme.color.active};
  transform: ${({ open }) => (open ? 'rotate(0deg)' : 'rotate(-90deg)')};
  transition: ${({ theme }) => theme.transition.short};
`;

const ToolbarStyle = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: 26px;
  font-size: 14px;
  user-select: none;
  color: ${({ theme }) => theme.color.meta};

  a {
    cursor: pointer;
    margin-left: 14px;
    transition: ${({ theme }) => theme.transition.out};
  }

  a:hover {
    color: ${({ theme }) => theme.color.active};
  }
`;

const ModBox = ({
  data,
  onClick,
  onTag,
  fixed,
  grouped = false,
  openFolders = [],
  forceOpen = false,
  onToggleFolder = () => {},
  onSetFolders = () => {}
}) => {
  const { t } = useTranslation(['wads']);
  const boxRef = useRef(null);
  const [height, setHeight] = useState(365);

  useLayoutEffect(() => {
    const updateSize = () =>
      setHeight(boxRef.current.getBoundingClientRect().height - 85);

    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const { rows, folders } = useMemo(() => {
    if (!grouped) {
      return {
        rows: data.map(item => ({ type: 'mod', item })),
        folders: []
      };
    }
    const grouping = groupByFolder(data, openFolders, forceOpen);
    // expand / collapse all links on top (not needed while searching)
    return forceOpen || !grouping.folders.length
      ? grouping
      : { ...grouping, rows: [{ type: 'toolbar' }, ...grouping.rows] };
  }, [data, grouped, openFolders, forceOpen]);

  const itemSize = useMemo(
    () => index => {
      switch (rows[index].type) {
        case 'folder':
          return 45;
        case 'toolbar':
          return 30;
        default:
          return 77;
      }
    },
    [rows]
  );

  const INDENT = 16;

  const renderRow = ({ index, style: baseStyle }) => {
    const row = rows[index];
    // nested folders / mods are pushed to the right
    const indent = (row.depth || 0) * INDENT;
    const style =
      indent > 0
        ? { ...baseStyle, left: indent, width: `calc(100% - ${indent}px)` }
        : baseStyle;

    if (row.type === 'toolbar') {
      return (
        <li key="folder_toolbar" style={style}>
          <ToolbarStyle>
            <a onClick={() => onSetFolders(folders)}>{t('wads:expandAll')}</a>
            <a onClick={() => onSetFolders([])}>{t('wads:collapseAll')}</a>
          </ToolbarStyle>
        </li>
      );
    }

    if (row.type === 'folder') {
      return (
        <li key={`folder_${row.key}`} style={style}>
          <FolderStyle onClick={() => onToggleFolder(row.key)}>
            <Arrow open={row.open} />
            <h2>{row.folder || t('wads:noFolder')}</h2>
            <span>
              {row.active > 0 ? (
                <>
                  <b>{t('wads:folderActive', { count: row.active })}</b>
                  {' · '}
                </>
              ) : null}
              {t('wads:folderCount', { count: row.count })}
            </span>
          </FolderStyle>
        </li>
      );
    }

    return (
      <ModItem
        style={style}
        key={`mod_${row.item.id}`}
        item={row.item}
        onSelect={onClick(row.item.id)}
        onTag={onTag}
      />
    );
  };

  return (
    <BoxStyle fixed={fixed} ref={boxRef}>
      {fixed ? <div className="fixed">{fixed}</div> : null}

      <ul>
        <VirtualList
          width="100%"
          height={height}
          itemCount={rows.length}
          itemSize={itemSize}
          renderItem={renderRow}
        />
      </ul>
    </BoxStyle>
  );
};

ModBox.propTypes = {
  data: PropTypes.any,
  fixed: PropTypes.element,
  forceOpen: PropTypes.bool,
  grouped: PropTypes.bool,
  onSetFolders: PropTypes.func,
  onToggleFolder: PropTypes.func,
  openFolders: PropTypes.array,
  onClick: PropTypes.func.isRequired,
  onTag: PropTypes.any
};

export default ModBox;
