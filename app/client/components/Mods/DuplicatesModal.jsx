import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import { useTranslation } from '../../utils';
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
    margin: 10px 0 4px 0;
  }

  p.hint {
    font-size: 13px;
    color: ${({ theme }) => theme.color.meta};
    margin: 0 0 10px 0;
  }
`;

const Group = styled.div`
  background: ${({ theme }) => theme.color.backdrop};
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  padding: 8px 10px;
  margin-bottom: 8px;

  .head {
    font-size: 17px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .head small {
    font-size: 13px;
    margin-inline-start: 8px;
    color: ${({ theme }) => theme.color.meta};
  }
`;

const Row = styled.div`
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

const DuplicatesModal = ({
  active,
  onClose,
  duplicates,
  versions,
  modpath,
  onShow,
  onDelete
}) => {
  const { t } = useTranslation(['wads', 'common']);

  const rel = p =>
    (modpath ? p.replace(modpath, '') : p).replace(/^[\\/]+/, '');

  const renderRow = (path, name, size) => (
    <Row key={path}>
      <span className="path" title={path}>
        {rel(path)}
      </span>
      {size ? <span className="size">{size}</span> : null}
      <a onClick={onShow(path)}>{t('wads:dupesShow')}</a>
      <a className="danger" onClick={onDelete(path, name)}>
        {t('wads:dupesDelete')}
      </a>
    </Row>
  );

  return (
    <Modal active={active} onBackdrop={onClose} title={t('wads:dupesTitle')}>
      <Scroll>
        {duplicates.length > 0 ? (
          <>
            <h3>{t('wads:dupesExact')}</h3>
            <p className="hint">{t('wads:dupesExactHint')}</p>
            {duplicates.map(d => (
              <Group key={d.id}>
                <div className="head">
                  {d.name}
                  <small>
                    {d.size} {d.kind}
                  </small>
                </div>
                {d.paths.map(path => renderRow(path, d.name))}
              </Group>
            ))}
          </>
        ) : null}

        {versions.length > 0 ? (
          <>
            <h3>{t('wads:dupesVersions')}</h3>
            <p className="hint">{t('wads:dupesVersionsHint')}</p>
            {versions.map(v => (
              <Group key={`${v.name}|${v.kind}`}>
                <div className="head">
                  {v.name}
                  <small>{v.kind}</small>
                </div>
                {v.items.map(i => renderRow(i.path, v.name, i.size))}
              </Group>
            ))}
          </>
        ) : null}

        {!duplicates.length && !versions.length ? (
          <p className="hint">{t('wads:dupesNone')}</p>
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

DuplicatesModal.propTypes = {
  active: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  duplicates: PropTypes.array.isRequired,
  versions: PropTypes.array.isRequired,
  modpath: PropTypes.string,
  onShow: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};

export default DuplicatesModal;
