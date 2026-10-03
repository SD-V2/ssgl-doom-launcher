import PropTypes from 'prop-types';
import React, { useState } from 'react';
import styled from 'styled-components';

import { useTranslation } from '../../utils';
import { Button } from '../Form';
import Modal from '../Modal';

const Scroll = styled.div`
  max-height: calc(100vh - 260px);
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 15px;
  padding-right: 8px;
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

  .names {
    font-size: 17px;
    text-transform: uppercase;
  }

  .names i {
    font-style: normal;
    margin: 0 8px;
    color: ${({ theme }) => theme.color.meta};
  }

  .winner {
    font-size: 14px;
    color: ${({ theme }) => theme.color.active};
    margin: 2px 0 6px 0;
  }

  .groups {
    font-size: 14px;
    color: #ccc;
    margin-bottom: 6px;
  }

  .groups span {
    display: inline-block;
    margin: 0 6px 4px 0;
    padding: 0 6px;
    border-radius: 4px;
    border: 1px solid ${({ theme }) => theme.border.idle};
  }

  .files {
    font-size: 13px;
    color: ${({ theme }) => theme.color.meta};
    margin: 4px 0 6px 0;
    word-break: break-all;
  }

  .actions a {
    margin-right: 16px;
    font-size: 14px;
    cursor: pointer;
    color: ${({ theme }) => theme.color.active};
  }

  .actions a.danger {
    color: #f55945;
  }

  .actions a:hover {
    text-decoration: underline;
  }
`;

const ConflictsModal = ({
  active,
  onClose,
  loading,
  error,
  result,
  count,
  onSwap,
  onRemove
}) => {
  const { t } = useTranslation(['wads', 'common']);
  const [open, setOpen] = useState({});

  const toggle = key => setOpen({ ...open, [key]: !open[key] });

  const skipText = s =>
    s.code === 'patch'
      ? t('wads:conflictSkipPatch')
      : s.code === 'unsupported'
      ? t('wads:conflictSkipUnsupported', { type: s.detail })
      : t('wads:conflictSkipUnreadable');

  return (
    <Modal active={active} onBackdrop={onClose} title={t('wads:conflictsTitle')}>
      <Scroll>
        {loading ? (
          <p className="hint">{t('wads:conflictsChecking', { count })}</p>
        ) : null}

        {error ? <p className="hint">{error}</p> : null}

        {result && !loading ? (
          <>
            <p className="hint">
              {result.conflicts.length === 0
                ? t('wads:conflictsNone', { count: result.checked })
                : `${t('wads:conflictsFound', {
                    count: result.conflicts.length
                  })} ${t('wads:conflictsHint')}`}
            </p>

            {result.conflicts.map(c => {
              const key = `${c.a}|${c.b}`;
              return (
                <Card key={key}>
                  <div className="names">
                    {c.aName}
                    <i>→</i>
                    {c.bName}
                  </div>
                  <div className="winner">
                    {t('wads:conflictWinner', { name: c.bName })} ·{' '}
                    {t('wads:conflictShared', { count: c.count })}
                  </div>
                  <div className="groups">
                    {c.groups.slice(0, 8).map(g => (
                      <span key={g.label}>
                        {g.label} {g.count}
                      </span>
                    ))}
                  </div>
                  {open[key] ? (
                    <div className="files">
                      {c.sample.join(', ')}
                      {c.count > c.sample.length
                        ? ` … ${t('wads:conflictMore', {
                            count: c.count - c.sample.length
                          })}`
                        : ''}
                    </div>
                  ) : null}
                  <div className="actions">
                    <a onClick={() => onSwap(c.a, c.b)}>{t('wads:conflictSwap')}</a>
                    <a onClick={() => toggle(key)}>
                      {open[key] ? t('wads:conflictHide') : t('wads:conflictShow')}
                    </a>
                    <a className="danger" onClick={() => onRemove(c.a)}>
                      {t('wads:conflictRemove', { name: c.aName })}
                    </a>
                    <a className="danger" onClick={() => onRemove(c.b)}>
                      {t('wads:conflictRemove', { name: c.bName })}
                    </a>
                  </div>
                </Card>
              );
            })}

            {result.skipped.length > 0 ? (
              <>
                <h3>{t('wads:conflictSkipped', { count: result.skipped.length })}</h3>
                {result.skipped.map(s => (
                  <p className="hint" key={s.id}>
                    {s.name}: {skipText(s)}
                  </p>
                ))}
              </>
            ) : null}
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

ConflictsModal.propTypes = {
  active: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  result: PropTypes.object,
  count: PropTypes.number,
  onSwap: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired
};

export default ConflictsModal;
