import byteSize from 'byte-size';
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

  box-shadow: ${({ dropping, theme }) =>
    dropping ? `0 0 0 2px ${theme.color.active}` : 'none'};

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

const hasFiles = e =>
  Array.from(e.dataTransfer.types || []).indexOf('Files') > -1;

const NewModsTag = styled.i`
  flex-shrink: 0;
  margin-left: 10px;
  padding: 0 6px;
  font-style: normal;
  font-size: 11px;
  line-height: 16px;
  text-transform: uppercase;
  border-radius: 4px;
  color: ${({ theme }) => theme.color.active};
  border: 1px solid ${({ theme }) => theme.color.active};
`;

const FolderButton = styled.button`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-left: 8px;
  padding: 0;
  cursor: pointer;
  font-size: 18px;
  line-height: 20px;
  color: ${({ theme }) => theme.color.idle};
  background: transparent;
  border-radius: ${({ theme }) => theme.border.radius};
  border: 1px solid ${({ theme }) => theme.border.idle};
  transition: ${({ theme }) => theme.transition.out};

  &:hover {
    color: ${({ theme, danger }) => (danger ? '#f55945' : theme.color.active)};
    border: 1px solid
      ${({ theme, danger }) => (danger ? '#f55945' : theme.border.active)};
  }
`;

const MOD_MIME = 'application/x-ssgl-mod';

const modDragProps = item => ({
  draggable: true,
  onDragStart: e => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(MOD_MIME, item.id);
    e.dataTransfer.setData('text/plain', item.name);
  }
});

const ModBox = ({
  data,
  onClick,
  onTag,
  fixed,
  grouped = false,
  openFolders = [],
  forceOpen = false,
  onToggleFolder = () => {},
  onSetFolders = () => {},
  onAddFolder = () => {},
  onRemoveFolder = () => {},
  favorites = new Set(),
  onFavorite = () => () => {},
  onShow = () => () => {},
  onDelete = () => () => {},
  footer = null,
  compact = false,
  recentIds = new Set(),
  allFolders = [],
  importFolder = '',
  onFolderMenu = () => {},
  onDropFiles = () => {},
  onNewFolder = () => {}
}) => {
  const { t } = useTranslation(['wads']);
  const boxRef = useRef(null);
  const [dropKey, setDropKey] = useState(null);
  const [height, setHeight] = useState(365);

  useLayoutEffect(() => {
    const updateSize = () =>
      setHeight(
        boxRef.current.getBoundingClientRect().height - (footer ? 115 : 85)
      );

    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, [footer]);

  const { rows, folders } = useMemo(() => {
    if (!grouped) {
      return {
        rows: data.map(item => ({ type: 'mod', item })),
        folders: []
      };
    }
    const grouping = groupByFolder(data, openFolders, forceOpen, allFolders);
    // expand / collapse all + new folder links on top (not while searching)
    return forceOpen
      ? grouping
      : { ...grouping, rows: [{ type: 'toolbar' }, ...grouping.rows] };
  }, [data, grouped, openFolders, forceOpen, allFolders]);

  const itemSize = useMemo(
    () => index => {
      switch (rows[index].type) {
        case 'folder':
          return 45;
        case 'toolbar':
          return 30;
        default:
          return compact ? 45 : 77;
      }
    },
    [rows, compact]
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
            <a onClick={() => onNewFolder()}>{t('wads:newFolder')}</a>
            <a onClick={() => onSetFolders(folders)}>{t('wads:expandAll')}</a>
            <a onClick={() => onSetFolders([])}>{t('wads:collapseAll')}</a>
          </ToolbarStyle>
        </li>
      );
    }

    if (row.type === 'folder') {
      return (
        <li key={`folder_${row.key}`} style={style}>
          <FolderStyle
            dropping={dropKey === row.key}
            onClick={() => onToggleFolder(row.key)}
            onContextMenu={e => {
              e.preventDefault();
              onFolderMenu(row);
            }}
            onDragOver={e => {
              if (!hasFiles(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (dropKey !== row.key) setDropKey(row.key);
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget)) setDropKey(null);
            }}
            onDrop={e => {
              if (!hasFiles(e)) return;
              e.preventDefault();
              e.stopPropagation();
              setDropKey(null);
              onDropFiles(row.key, e);
            }}
          >
            <Arrow open={row.open} />
            <h2>{row.folder || t('wads:noFolder')}</h2>
            {row.key !== '' && row.key === importFolder ? (
              <NewModsTag title={t('wads:newModsHere')}>{t('wads:newModsHere')}</NewModsTag>
            ) : null}
            <span>
              {row.active > 0 ? (
                <>
                  <b>{t('wads:folderActive', { count: row.active })}</b>
                  {' · '}
                </>
              ) : null}
              {t('wads:folderCount', { count: row.count })}
              {row.bytes > 0 ? ` · ${byteSize(row.bytes).toString()}` : ''}
            </span>
            <FolderButton
              type="button"
              title={t('wads:addAll')}
              onClick={e => {
                e.stopPropagation();
                onAddFolder(row.key);
              }}
            >
              +
            </FolderButton>
            {row.active > 0 ? (
              <FolderButton
                type="button"
                danger
                title={t('wads:removeAll')}
                onClick={e => {
                  e.stopPropagation();
                  onRemoveFolder(row.key);
                }}
              >
                −
              </FolderButton>
            ) : null}
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
        fav={favorites.has(row.item.id)}
        onFav={onFavorite(row.item.id)}
        onShow={onShow(row.item.path)}
        onDelete={onDelete(row.item)}
        dragProps={modDragProps(row.item)}
        isNew={recentIds.has(row.item.id)}
        compact={compact}
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
      {footer}
    </BoxStyle>
  );
};

ModBox.propTypes = {
  data: PropTypes.any,
  fixed: PropTypes.element,
  footer: PropTypes.element,
  allFolders: PropTypes.array,
  importFolder: PropTypes.string,
  onFolderMenu: PropTypes.func,
  onDropFiles: PropTypes.func,
  onNewFolder: PropTypes.func,
  compact: PropTypes.bool,
  recentIds: PropTypes.any,
  favorites: PropTypes.any,
  onFavorite: PropTypes.func,
  onShow: PropTypes.func,
  onDelete: PropTypes.func,
  onAddFolder: PropTypes.func,
  onRemoveFolder: PropTypes.func,
  forceOpen: PropTypes.bool,
  grouped: PropTypes.bool,
  onSetFolders: PropTypes.func,
  onToggleFolder: PropTypes.func,
  openFolders: PropTypes.array,
  onClick: PropTypes.func.isRequired,
  onTag: PropTypes.any
};

export default ModBox;
