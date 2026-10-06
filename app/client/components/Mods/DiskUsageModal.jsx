import byteSize from 'byte-size';
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { useTranslation } from '../../utils';
import {
  biggestMods,
  buildUsageTree,
  duplicateWaste,
  nodeAt,
  usageRows
} from '../../utils/diskUsage';
import { Button } from '../Form';
import Modal from '../Modal';

const Scroll = styled.div`
  max-height: calc(100vh - 230px);
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 15px;
  padding-inline-end: 8px;
  ${({ theme }) => theme.scrollbar};

  h3 {
    font-size: 15px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.active};
    margin: 16px 0 6px 0;
  }

  p.hint {
    font-size: 14px;
    color: ${({ theme }) => theme.color.meta};
    margin: 0 0 8px 0;
  }
`;

const Crumbs = styled.div`
  font-size: 16px;
  margin-bottom: 4px;
  text-transform: uppercase;

  a {
    cursor: pointer;
    color: ${({ theme }) => theme.color.active};
  }

  a:hover {
    text-decoration: underline;
  }

  span.sep {
    margin: 0 8px;
    color: ${({ theme }) => theme.color.meta};
  }
`;

const Row = styled.div`
  margin-bottom: 7px;
  cursor: ${({ open }) => (open ? 'pointer' : 'default')};

  .line {
    display: flex;
    align-items: baseline;
    font-size: 15px;
  }

  .name {
    flex-grow: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-transform: uppercase;
  }

  .name.own {
    text-transform: none;
    font-style: italic;
    color: ${({ theme }) => theme.color.meta};
  }

  .meta {
    margin-inline-start: 12px;
    white-space: nowrap;
    color: ${({ theme }) => theme.color.meta};
  }

  .size {
    margin-inline-start: 12px;
    min-width: 72px;
    text-align: end;
    white-space: nowrap;
  }

  .track {
    height: 9px;
    margin-top: 3px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: 5px;
    background: ${({ theme }) => theme.color.active};
    opacity: ${({ own }) => (own ? 0.4 : 0.85)};
  }

  &:hover .name:not(.own) {
    color: ${({ theme, open }) => (open ? theme.color.active : 'inherit')};
  }
`;

const BigRow = styled.div`
  display: flex;
  align-items: center;
  font-size: 14px;
  padding: 2px 0;

  .path {
    flex-grow: 1;
    direction: ltr;
    text-align: start;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #ccc;
  }

  .size {
    margin-inline-start: 10px;
    white-space: nowrap;
    color: ${({ theme }) => theme.color.meta};
  }

  a {
    margin-inline-start: 12px;
    white-space: nowrap;
    cursor: pointer;
    color: ${({ theme }) => theme.color.active};
  }

  a.danger {
    color: #f55945;
  }

  a:hover {
    text-decoration: underline;
  }
`;

const fmt = bytes => byteSize(bytes).toString();

const percent = (part, whole) => {
  if (!whole) return '0%';
  const p = (part / whole) * 100;
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
};

const DiskUsageModal = ({
  active,
  onClose,
  mods,
  duplicates,
  onShow,
  onDelete,
  onOpenDuplicates,
  maps = false
}) => {
  const { t } = useTranslation(['wads', 'common']);
  const [path, setPath] = useState([]);

  // start at the top every time the window opens
  useEffect(() => {
    if (active) setPath([]);
  }, [active]);

  const tree = useMemo(() => buildUsageTree(mods), [mods]);
  // a folder can disappear (deleted mods) while we are inside it
  const node = nodeAt(tree, path) || tree;
  const rows = usageRows(node);
  const biggest = useMemo(() => biggestMods(node, 10), [node]);
  const waste = useMemo(() => duplicateWaste(duplicates), [duplicates]);

  return (
    <Modal active={active} onBackdrop={onClose} title={t('wads:usageTitle')}>
      <Scroll>
        <Crumbs>
          <a onClick={() => setPath([])}>{t('wads:usageAll')}</a>
          {path.map((name, i) => (
            <span key={`${name}_${i}`}>
              <span className="sep">›</span>
              <a onClick={() => setPath(path.slice(0, i + 1))}>{name}</a>
            </span>
          ))}
        </Crumbs>
        <p className="hint">
          {t(maps ? 'wads:usageTotalMaps' : 'wads:usageTotal', {
            size: fmt(node.bytes),
            count: node.count
          })}
        </p>

        {rows.length === 0 ? <p className="hint">{t('wads:usageEmpty')}</p> : null}

        {rows.map(row => (
          <Row
            key={row.own ? '__own' : row.name}
            open={row.open}
            own={row.own}
            onClick={() => (row.open ? setPath([...path, row.name]) : null)}
          >
            <div className="line">
              <span className={row.own ? 'name own' : 'name'}>
                {row.own
                  ? path.length
                    ? t('wads:usageOwn')
                    : t('wads:noFolder')
                  : row.name}
              </span>
              <span className="meta">
                {t(maps ? 'wads:statsMaps' : 'wads:folderCount', {
                  count: row.count
                })}{' '}
                ·{' '}
                {percent(row.bytes, node.bytes)}
              </span>
              <span className="size">{fmt(row.bytes)}</span>
            </div>
            <div className="track">
              <div
                className="fill"
                style={{ width: `${(row.bytes / (rows[0].bytes || 1)) * 100}%` }}
              />
            </div>
          </Row>
        ))}

        {biggest.length > 0 ? (
          <>
            <h3>{t('wads:usageBiggest')}</h3>
            {biggest.map(mod => (
              <BigRow key={mod.id}>
                <span className="path" title={mod.path}>
                  {mod.name}
                </span>
                <span className="size">{fmt(mod.bytes || 0)}</span>
                <a onClick={onShow(mod.path)}>{t('wads:dupesShow')}</a>
                <a className="danger" onClick={onDelete(mod)}>
                  {t('wads:dupesDelete')}
                </a>
              </BigRow>
            ))}
          </>
        ) : null}

        {waste > 0 && path.length === 0 ? (
          <>
            <h3>{t('wads:dupesTitle')}</h3>
            <p className="hint">
              {t('wads:usageDupes', { size: fmt(waste) })}{' '}
              <a
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={onOpenDuplicates}
              >
                {t('wads:usageShowDupes')}
              </a>
            </p>
          </>
        ) : null}
      </Scroll>
      <div style={{ textAlign: 'right' }}>
        <Button type="button" onClick={onClose} width="100px" style={{ margin: 0 }}>
          {t('common:ok')}
        </Button>
      </div>
    </Modal>
  );
};

DiskUsageModal.propTypes = {
  active: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  mods: PropTypes.array.isRequired,
  duplicates: PropTypes.array.isRequired,
  onShow: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onOpenDuplicates: PropTypes.func.isRequired,
  maps: PropTypes.bool
};

export default DiskUsageModal;
