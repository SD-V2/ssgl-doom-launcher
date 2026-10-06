import byteSize from 'byte-size';
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
`;

const Card = styled.div`
  background: ${({ theme }) => theme.color.backdrop};
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  padding: 8px 10px;
  margin-bottom: 8px;

  .tier {
    font-size: 13px;
    color: #f5b945;
    margin-bottom: 4px;
  }

  .row {
    display: flex;
    align-items: baseline;
    font-size: 16px;
    padding: 2px 0;
  }

  .row .name {
    flex-grow: 1;
    text-transform: uppercase;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .row .meta {
    margin-inline-start: 10px;
    min-width: 70px;
    text-align: end;
    font-size: 13px;
    white-space: nowrap;
    color: ${({ theme }) => theme.color.meta};
  }

  .row .newer {
    margin-inline-start: 8px;
    min-width: 110px;
    text-align: end;
    font-size: 12px;
    color: ${({ theme }) => theme.color.active};
  }

  a {
    margin-inline-start: 14px;
    font-size: 14px;
    white-space: nowrap;
    cursor: pointer;
    color: ${({ theme }) => theme.color.active};
  }

  a:hover {
    text-decoration: underline;
  }

  .footer {
    margin-top: 6px;
    font-size: 14px;
  }

  .footer a {
    margin-inline-start: 0;
    color: ${({ theme }) => theme.color.meta};
  }
`;

const TwinsModal = ({ active, onClose, groups, onKeep, onNotSame }) => {
  const { t } = useTranslation(['wads', 'common']);

  return (
    <Modal active={active} onBackdrop={onClose} title={t('wads:twinsTitle')}>
      <Scroll>
        <p className="hint">
          {groups.length ? t('wads:twinsHint') : t('wads:twinsNone')}
        </p>
        {groups.map(group => {
          const newest = group.mods.reduce(
            (a, b) => ((b.created || 0) > (a.created || 0) ? b : a),
            group.mods[0]
          );
          return (
            <Card key={group.key}>
              <div className="tier">
                {group.tier === 1 ? t('wads:twinsTier1') : t('wads:twinsTier2')}
              </div>
              {group.mods.map(mod => (
                <div className="row" key={mod.id}>
                  <span className="name" title={mod.path}>
                    {mod.name}
                  </span>
                  <span className="meta">{byteSize(mod.bytes || 0).toString()}</span>
                  <span className="newer">
                    {mod.id === newest.id && group.mods.length > 1
                      ? t('wads:twinsNewer')
                      : ''}
                  </span>
                  <a onClick={() => onKeep(group, mod.id)}>{t('wads:twinsKeep')}</a>
                </div>
              ))}
              <div className="footer">
                <a onClick={() => onNotSame(group)}>{t('wads:twinsNotSame')}</a>
              </div>
            </Card>
          );
        })}
      </Scroll>
      <div style={{ textAlign: 'end' }}>
        <Button type="button" onClick={onClose} width="100px" style={{ margin: 0 }}>
          {t('common:ok')}
        </Button>
      </div>
    </Modal>
  );
};

TwinsModal.propTypes = {
  active: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  groups: PropTypes.array.isRequired,
  onKeep: PropTypes.func.isRequired,
  onNotSame: PropTypes.func.isRequired
};

export default TwinsModal;
