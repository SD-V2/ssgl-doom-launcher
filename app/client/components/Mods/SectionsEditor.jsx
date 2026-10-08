import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { useTranslation } from '../../utils';
import {
  DEFAULT_WORDS,
  newCustomId,
  sectionName,
  sectionNote,
  sectionOrder
} from '../../utils/sections';
import { Button, Input } from '../Form';
import Modal from '../Modal';

const Scroll = styled.div`
  max-height: calc(100vh - 290px);
  min-height: 120px;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 12px;
  padding-inline-end: 8px;
  ${({ theme }) => theme.scrollbar};

  p.hint {
    margin: 0 0 12px 0;
    font-size: 14px;
    line-height: 1.35;
    color: ${({ theme }) => theme.color.meta};
  }

  h3 {
    margin: 16px 0 8px 0;
    font-size: 14px;
    font-weight: normal;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.meta};
  }
`;

const Card = styled.div`
  position: relative;
  margin-bottom: 10px;
  padding: 10px 10px 0 10px;
  background: ${({ theme }) => theme.color.backdrop};
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};

  .row {
    display: flex;
  }

  .row > div {
    flex: 1;
  }

  .tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -6px 0 8px 0;
    font-size: 13px;
    color: ${({ theme }) => theme.color.meta};
  }

  a {
    cursor: pointer;
    color: ${({ theme }) => theme.color.active};
  }

  a.danger {
    color: #e8705f;
  }

  a:hover {
    text-decoration: underline;
  }

  .bad {
    color: #e8705f;
  }
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-top: 14px;

  button {
    margin: 0 0 0 10px;
  }

  [dir='rtl'] & button {
    margin: 0 10px 0 0;
  }
`;

// a row of the editor: { id, builtin, name, note, words }
const rowsFrom = (rules, t) =>
  sectionOrder(rules).map(id => {
    const builtin = !(rules.custom || []).some(c => c.id === id);
    const hasWords = builtin ? id !== 'other' && id !== 'maps' : true;
    return {
      id,
      builtin,
      hasWords,
      removable: id !== 'other' && id !== 'maps',
      name: sectionName(id, rules, t),
      note: sectionNote(id, rules, t),
      words: !hasWords
        ? ''
        : builtin
        ? typeof (rules.words || {})[id] === 'string'
          ? rules.words[id]
          : DEFAULT_WORDS[id] || ''
        : (rules.custom.find(c => c.id === id) || {}).words || ''
    };
  });

const SectionsEditor = ({ active, onClose, rules, onSave }) => {
  const { t } = useTranslation(['wads', 'common']);
  const [rows, setRows] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [tried, setTried] = useState(false);

  // every time the window opens it starts from what is saved
  useEffect(() => {
    if (!active) return;
    setRows(rowsFrom(rules, t));
    setRemoved((rules.hidden || []).slice());
    setTried(false);
  }, [active]);

  const change = (id, field) => e => {
    const { value } = e.currentTarget;
    setRows(rows.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addSection = () =>
    setRows([
      ...rows,
      {
        id: newCustomId(),
        builtin: false,
        hasWords: true,
        removable: true,
        name: '',
        note: '',
        words: ''
      }
    ]);

  const remove = row => {
    setRows(rows.filter(r => r.id !== row.id));
    if (row.builtin) setRemoved([...removed, row.id]);
  };

  const putBack = id => {
    setRemoved(removed.filter(x => x !== id));
    setRows([
      ...rows,
      {
        id,
        builtin: true,
        hasWords: true,
        removable: true,
        name: sectionName(id, {}, t),
        note: sectionNote(id, {}, t),
        words: DEFAULT_WORDS[id] || ''
      }
    ]);
  };

  const save = () => {
    setTried(true);
    const mine = rows.filter(r => !r.builtin);
    if (mine.some(r => !r.name.trim())) return;

    // only what differs from the built-in texts is saved
    const names = {};
    const notes = {};
    const words = {};
    rows
      .filter(r => r.builtin)
      .forEach(r => {
        if (r.name.trim() && r.name.trim() !== sectionName(r.id, {}, t)) {
          names[r.id] = r.name.trim();
        }
        if (r.note.trim() !== sectionNote(r.id, {}, t)) notes[r.id] = r.note.trim();
        if (r.hasWords && r.words.trim() !== (DEFAULT_WORDS[r.id] || '')) {
          words[r.id] = r.words.trim();
        }
      });

    onSave({
      custom: mine.map(r => ({
        id: r.id,
        name: r.name.trim(),
        note: r.note.trim(),
        words: r.words.trim()
      })),
      names,
      notes,
      words,
      hidden: removed
    });
  };

  return (
    <Modal active={active} onBackdrop={onClose} strict title={t('wads:secEdTitle')}>
      <Scroll>
        <p className="hint">{t('wads:secEdHint')}</p>
        {rows.map(row => (
          <Card key={row.id}>
            <div className="row">
              <div>
                <Input
                  name={`name_${row.id}`}
                  label={t('wads:secEdName')}
                  value={row.name}
                  onChange={change(row.id, 'name')}
                  error={tried && !row.builtin && !row.name.trim()}
                  placeholder={t('wads:secEdNewName')}
                  fluid
                />
              </div>
              {row.hasWords ? (
                <div>
                  <Input
                    name={`words_${row.id}`}
                    label={t('wads:secEdWords')}
                    value={row.words}
                    onChange={change(row.id, 'words')}
                    placeholder={t('wads:secEdWordsExample')}
                    fluid
                  />
                </div>
              ) : null}
            </div>
            <Input
              name={`note_${row.id}`}
              label={t('wads:secEdNote')}
              value={row.note}
              onChange={change(row.id, 'note')}
              fluid
            />
            <div className="tools">
              <span className={tried && !row.builtin && !row.name.trim() ? 'bad' : ''}>
                {tried && !row.builtin && !row.name.trim()
                  ? t('wads:secEdNameRequired')
                  : row.builtin
                  ? t('wads:secEdBuiltin')
                  : t('wads:secEdOwn')}
              </span>
              {row.removable ? (
                <a className="danger" onClick={() => remove(row)}>
                  {t('wads:secEdRemove')}
                </a>
              ) : null}
            </div>
          </Card>
        ))}
        <Button type="button" width="auto" onClick={addSection}>
          + {t('wads:secEdAdd')}
        </Button>
        {removed.length ? (
          <>
            <h3>{t('wads:secEdRemoved')}</h3>
            {removed.map(id => (
              <Card key={`removed_${id}`}>
                <div className="tools" style={{ marginTop: 0, paddingTop: 4 }}>
                  <span>{sectionName(id, rules, t)}</span>
                  <a onClick={() => putBack(id)}>{t('wads:secEdRestore')}</a>
                </div>
              </Card>
            ))}
          </>
        ) : null}
      </Scroll>
      <Buttons>
        <Button
          type="button"
          width="100px"
          border="#f55945"
          glow="#b8342a"
          color="#ff2f00"
          onClick={onClose}
        >
          {t('common:cancel')}
        </Button>
        <Button type="button" width="100px" onClick={save}>
          {t('wads:secEdSave')}
        </Button>
      </Buttons>
    </Modal>
  );
};

SectionsEditor.propTypes = {
  active: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  rules: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired
};

export default SectionsEditor;
