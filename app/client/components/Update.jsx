import { remote } from 'electron';
import React, { useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';

import { StoreContext } from '../state';
import { useTranslation } from '../utils';
import { dismiss } from '../utils/dismissed';
import { Button } from './Form';
import { Modal } from './index';

const MarkdownStyle = styled.div`
  max-height: 350px;
  overflow-y: scroll;
  overflow-x: hidden;
  background-color: black;
  border-radius: 4px;
  padding: 0 10px 10px 10px;
  ${({ theme }) => theme.scrollbar};

  p {
    margin-bottom: 10px;
  }

  ul {
    color: red;
    list-style-type: square;
    padding-inline-start: 20px;
    margin: 10px;
  }

  code {
    display: block;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid darkgrey;
    margin: 10px 0 10px 0;
  }
`;
const Update = () => {
  const { gstate, dispatch } = useContext(StoreContext);
  const { t } = useTranslation(['common']);

  // new files in the repository (no release): the program has to be built again
  const files = gstate.update.kind === 'files';

  const onOk = () => {
    remote.shell.openExternal(gstate.update.download);
    if (files) dismiss(gstate.update.sha);
    dispatch({ type: 'update/done' });
  };

  const onCancel = () => {
    if (files) dismiss(gstate.update.sha);
    dispatch({ type: 'update/done' });
  };

  return (
    <Modal
      active={true}
      title={
        files
          ? t('common:updateFilesTitle')
          : t('common:updateTitle', { version: gstate.update.version })
      }
      strict
    >
      {files ? (
        <p style={{ margin: '0 0 12px 0' }}>
          {t('common:updateFilesText', {
            repo: gstate.update.repo,
            version: gstate.update.version
          })}
        </p>
      ) : null}
      <MarkdownStyle>
        <ReactMarkdown source={gstate.update.changelog} />
      </MarkdownStyle>
      <div style={{ textAlign: 'end', marginTop: '20px' }}>
        <Button
          type="button"
          border={'#f55945'}
          glow={'#b8342a'}
          color={'#ff2f00'}
          onClick={onCancel}
          width="100px"
        >
          {t('common:updateLater')}
        </Button>
        <Button
          type="button"
          style={{ margin: 0 }}
          width="100px"
          onClick={onOk}
        >
          {files ? t('common:updateOpen') : t('common:updateDownload')}
        </Button>
      </div>
    </Modal>
  );
};

export default Update;
