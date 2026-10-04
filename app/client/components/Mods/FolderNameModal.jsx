import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import { useTranslation } from '../../utils';
import { Button, Input } from '../Form';
import Modal from '../Modal';

// Asks for a folder name: new folder (create) or rename.
// dialog = { mode: 'create' | 'rename', key, initial } or null
const FolderNameModal = ({ dialog, onSubmit, onCancel }) => {
  const { t } = useTranslation(['wads', 'common']);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (dialog) setValue(dialog.initial || '');
  }, [dialog]);

  const submit = e => {
    e.preventDefault();
    onSubmit(value);
  };

  const rename = dialog && dialog.mode === 'rename';

  return (
    <Modal
      active={!!dialog}
      tiny
      onBackdrop={onCancel}
      title={rename ? t('wads:folderRenameTitle') : t('wads:folderNewTitle')}
    >
      <form onSubmit={submit}>
        <Input
          name="folderName"
          label={t('wads:folderName')}
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          fluid
        />
        {dialog && !rename && dialog.key ? (
          <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 12px 0' }}>
            {t('wads:folderInside', { name: dialog.key })}
          </p>
        ) : null}
        <div style={{ textAlign: 'right' }}>
          <Button
            type="button"
            border={'#f55945'}
            glow={'#b8342a'}
            color={'#ff2f00'}
            onClick={onCancel}
            width="100px"
          >
            {t('common:cancel')}
          </Button>
          <Button type="submit" style={{ margin: 0 }} width="100px">
            {t('common:ok')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

FolderNameModal.propTypes = {
  dialog: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default FolderNameModal;
