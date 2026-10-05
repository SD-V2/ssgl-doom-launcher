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

  .old {
    font-size: 16px;
    text-transform: uppercase;
    color: #ccc;
  }

  .arrow {
    font-size: 17px;
    text-transform: uppercase;
  }

  .arrow i {
    font-style: normal;
    margin-inline-end: 8px;
    color: ${({ theme }) => theme.color.meta};
  }

  .meta {
    font-size: 13px;
    color: ${({ theme }) => theme.color.meta};
    margin: 2px 0 6px 0;
  }

  .tier2 {
    color: #f5b945;
  }

  a {
    font-size: 14px;
    cursor: pointer;
    color: ${({ theme }) => theme.color.active};
  }

  a:hover {
    text-decoration: underline;
  }
`;

const FixPackagesModal = ({ active, onClose, fixes, onApply }) => {
  const { t } = useTranslation(['wads', 'common']);

  const fixable = fixes.filter(f => f.candidate);
  const exact = fixable.filter(f => f.candidate.tier === 1);
  const unknown = fixes.filter(f => !f.candidate);

  return (
    <Modal active={active} onBackdrop={onClose} title={t('wads:fixTitle')}>
      <Scroll>
        <p className="hint">
          {fixable.length ? t('wads:fixHint') : t('wads:fixNothing')}
        </p>

        {exact.length > 1 ? (
          <div style={{ marginBottom: 10 }}>
            <Button
              type="button"
              width="100%"
              style={{ margin: 0 }}
              onClick={() => onApply(exact)}
            >
              {t('wads:fixUpdateAll', { count: exact.length })}
            </Button>
          </div>
        ) : null}

        {fixable.map(fix => {
          const mod = fix.candidate.mod;
          return (
            <Card key={fix.id}>
              <div className="old">{fix.name || fix.id}</div>
              <div className="arrow">
                <i>→</i>
                {mod.name}
              </div>
              <div className="meta">
                {mod.size} {mod.kind}
                {mod.folders && mod.folders.length
                  ? ` · ${mod.folders.join('/')}`
                  : ''}
                {' · '}
                <span className={fix.candidate.tier === 2 ? 'tier2' : undefined}>
                  {fix.candidate.tier === 1
                    ? t('wads:fixTier1')
                    : t('wads:fixTier2')}
                </span>
              </div>
              <div className="meta">
                {t('wads:fixUsedIn', { packages: fix.packages.join(', ') })}
              </div>
              <a onClick={() => onApply([fix])}>{t('wads:fixUpdate')}</a>
            </Card>
          );
        })}

        {unknown.length > 0 ? (
          <>
            <h3>{t('wads:fixNoneTitle')}</h3>
            <p className="hint">{t('wads:fixNoneHint')}</p>
            {unknown.map(fix => (
              <p className="hint" key={fix.id}>
                {fix.name || fix.id} · {fix.packages.join(', ')}
              </p>
            ))}
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

FixPackagesModal.propTypes = {
  active: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  fixes: PropTypes.array.isRequired,
  onApply: PropTypes.func.isRequired
};

export default FixPackagesModal;
