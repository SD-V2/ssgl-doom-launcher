import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import { useTranslation } from '../../utils';
import { Button } from '../Form';
import Modal from '../Modal';

const Scroll = styled.div`
  max-height: calc(100vh - 260px);
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 15px;
  padding-inline-end: 8px;
  ${({ theme }) => theme.scrollbar};

  p.hint {
    font-size: 13px;
    color: ${({ theme }) => theme.color.meta};
    margin: 0 0 10px 0;
  }

  h3 {
    font-size: 15px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.active};
    margin: 14px 0 4px 0;
  }
`;

const Card = styled.div`
  background: ${({ theme }) => theme.color.backdrop};
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  padding: 8px 10px;
  margin-bottom: 8px;

  .name {
    font-size: 17px;
    text-transform: uppercase;
  }

  .why {
    font-size: 14px;
    color: #f5b945;
    margin: 2px 0 4px 0;
  }

  .path {
    font-size: 13px;
    color: ${({ theme }) => theme.color.meta};
    direction: ltr;
    text-align: start;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }

  a {
    margin-inline-end: 16px;
    font-size: 14px;
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

const BrokenFilesModal = ({
  active,
  onClose,
  loading,
  error,
  result,
  count,
  modpath,
  onShow,
  onDelete,
  onRecheck
}) => {
  const { t } = useTranslation(['wads', 'common']);

  const rel = p =>
    (modpath ? p.replace(modpath, '') : p).replace(/^[\\/]+/, '');

  const reason = p =>
    t(`wads:health_${p.code}`, { kind: p.kind, type: p.detail, defaultValue: p.code });

  return (
    <Modal active={active} onBackdrop={onClose} title={t('wads:healthTitle')}>
      <Scroll>
        {loading ? (
          <p className="hint">{t('wads:healthChecking', { count })}</p>
        ) : null}

        {error ? <p className="hint">{error}</p> : null}

        {result && !loading ? (
          <>
            <p className="hint">
              {result.problems.length === 0
                ? t('wads:healthNone', { count: result.checked })
                : `${t('wads:healthFound', { count: result.problems.length })} ${t(
                    'wads:healthChecked',
                    { count: result.checked }
                  )}`}
            </p>

            {result.problems.map(p => (
              <Card key={p.id}>
                <div className="name">{p.name}</div>
                <div className="why">{reason(p)}</div>
                <div className="path" title={p.path}>
                  {rel(p.path)}
                </div>
                <a onClick={onShow(p.path)}>{t('wads:dupesShow')}</a>
                <a className="danger" onClick={onDelete(p)}>
                  {t('wads:dupesDelete')}
                </a>
              </Card>
            ))}

            {result.unchecked > 0 ? (
              <p className="hint">
                {t('wads:healthUnchecked', { count: result.unchecked })}
              </p>
            ) : null}
          </>
        ) : null}
      </Scroll>
      <div style={{ textAlign: 'end' }}>
        <Button
          type="button"
          onClick={onRecheck}
          width="140px"
          style={{ marginInlineEnd: 10 }}
        >
          {t('wads:healthAgain')}
        </Button>
        <Button type="button" onClick={onClose} width="100px" style={{ margin: 0 }}>
          {t('common:ok')}
        </Button>
      </div>
    </Modal>
  );
};

BrokenFilesModal.propTypes = {
  active: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  result: PropTypes.object,
  count: PropTypes.number,
  modpath: PropTypes.string,
  onShow: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRecheck: PropTypes.func.isRequired
};

export default BrokenFilesModal;
