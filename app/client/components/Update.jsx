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
  max-height: calc(100vh - 340px);
  min-height: 60px;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: black;
  border-radius: 4px;
  padding: 10px 14px 10px 14px;
  overflow-wrap: anywhere;
  line-height: 1.35;
  ${({ theme }) => theme.scrollbar};

  /* every paragraph decides its own direction (English notes inside Arabic screens) */
  p,
  li,
  h1,
  h2,
  h3 {
    unicode-bidi: plaintext;
  }

  p {
    margin-bottom: 10px;
  }

  h1,
  h2,
  h3 {
    font-size: 15px;
    margin: 12px 0 6px 0;
  }

  ul {
    list-style-type: square;
    padding-inline-start: 20px;
    margin: 6px 0 10px 0;
  }

  /* short code stays inside the sentence */
  code {
    display: inline;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid darkgrey;
    margin: 0 2px;
    overflow-wrap: anywhere;
  }

  /* only a block of code gets its own box */
  pre {
    margin: 10px 0;
  }

  pre code {
    display: block;
    padding: 10px;
    margin: 0;
    white-space: pre-wrap;
  }
`;

// the text of an upload is not markdown: first line = title, rest as written
const CommitStyle = styled(MarkdownStyle)`
  white-space: pre-wrap;
  unicode-bidi: plaintext;

  strong {
    display: block;
    margin-bottom: 8px;
    font-weight: normal;
    color: ${({ theme }) => theme.color.active};
  }
`;

const Intro = styled.p`
  margin: 0 0 12px 0;
  line-height: 1.35;
  overflow-wrap: anywhere;

  b {
    font-weight: normal;
    color: ${({ theme }) => theme.color.active};
  }
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-top: 20px;

  button {
    margin: 0 0 0 10px;
  }

  [dir='rtl'] & button {
    margin: 0 10px 0 0;
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
        <Intro>
          {t('common:updateFilesText', {
            repo: gstate.update.repo,
            version: gstate.update.version
          })}
        </Intro>
      ) : null}
      {files ? (
        <CommitStyle>
          {(() => {
            const [first, ...rest] = String(gstate.update.changelog || '').split('\n');
            return (
              <>
                <strong>{first}</strong>
                {rest.join('\n').replace(/^\n+/, '')}
              </>
            );
          })()}
        </CommitStyle>
      ) : (
        <MarkdownStyle>
          <ReactMarkdown source={gstate.update.changelog} />
        </MarkdownStyle>
      )}
      <Buttons>
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
        <Button type="button" width="100px" onClick={onOk}>
          {files ? t('common:updateOpen') : t('common:updateDownload')}
        </Button>
      </Buttons>
    </Modal>
  );
};

export default Update;
