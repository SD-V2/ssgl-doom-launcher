import PropTypes from 'prop-types';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import styled from 'styled-components';

import { Button } from '../Form';
import Modal from '../Modal';

// Questions and messages in the look of SSGL (instead of the grey Windows boxes):
//
//   const dialog = useDialog();
//   const sure = await dialog.confirm({ title, message, detail, confirmText,
//                                       cancelText, danger: true });   // true / false
//   await dialog.info({ title, message, lines: [...], okText });
//
// Several questions at once wait for each other (one window at a time).

const NOT_THERE = {
  confirm: async () => false,
  info: async () => undefined
};

const DialogContext = createContext(NOT_THERE);

export const useDialog = () => useContext(DialogContext);

const Message = styled.p`
  margin: 0 0 12px 0;
  font-size: 17px;
  line-height: 1.35;
  overflow-wrap: anywhere;
`;

const Detail = styled.p`
  margin: 0 0 12px 0;
  font-size: 14px;
  line-height: 1.35;
  overflow-wrap: anywhere;
  color: ${({ theme }) => theme.color.meta};
`;

const Lines = styled.div`
  max-height: calc(100vh - 300px);
  min-height: 120px;
  overflow-y: auto;
  overflow-x: hidden;
  margin: 0 0 12px 0;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  unicode-bidi: plaintext;
  background-color: black;
  border-radius: 4px;
  ${({ theme }) => theme.scrollbar};
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

const DialogView = ({ item, onClose }) => {
  const {
    title,
    message,
    detail,
    lines,
    confirmText,
    cancelText,
    okText,
    danger = false,
    wide = false
  } = item.options;
  const isConfirm = item.type === 'confirm';

  // Escape = "no" / close
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Modal active tiny={!wide} strict title={title || ''}>
      {message ? <Message>{message}</Message> : null}
      {detail ? <Detail>{detail}</Detail> : null}
      {lines && lines.length ? <Lines>{lines.join('\n')}</Lines> : null}
      <Buttons>
        {isConfirm ? (
          <>
            {/* the safe answer has the focus, a stray Enter does not delete anything */}
            <Button type="button" autoFocus width="100px" onClick={() => onClose(false)}>
              {cancelText}
            </Button>
            {danger ? (
              <Button
                type="button"
                width="100px"
                border="#f55945"
                glow="#b8342a"
                color="#ff2f00"
                style={{ color: '#e8705f', borderColor: '#7d2f28' }}
                onClick={() => onClose(true)}
              >
                {confirmText}
              </Button>
            ) : (
              <Button type="button" width="100px" onClick={() => onClose(true)}>
                {confirmText}
              </Button>
            )}
          </>
        ) : (
          <Button type="button" autoFocus width="100px" onClick={() => onClose(false)}>
            {okText}
          </Button>
        )}
      </Buttons>
    </Modal>
  );
};

DialogView.propTypes = {
  item: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired
};

export const DialogProvider = ({ children }) => {
  const [current, setCurrent] = useState(null);
  const currentRef = useRef(null);
  const queue = useRef([]);
  const counter = useRef(0);

  const show = useCallback(item => {
    counter.current += 1;
    const full = { ...item, id: counter.current };
    if (currentRef.current) {
      queue.current.push(full);
    } else {
      currentRef.current = full;
      setCurrent(full);
    }
  }, []);

  const api = useMemo(
    () => ({
      confirm: options =>
        new Promise(resolve => show({ type: 'confirm', options, resolve })),
      info: options =>
        new Promise(resolve => show({ type: 'info', options, resolve }))
    }),
    [show]
  );

  const close = useCallback(result => {
    const item = currentRef.current;
    if (!item) return;
    item.resolve(item.type === 'confirm' ? !!result : undefined);
    const next = queue.current.shift() || null;
    currentRef.current = next;
    setCurrent(next);
  }, []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current ? <DialogView key={current.id} item={current} onClose={close} /> : null}
    </DialogContext.Provider>
  );
};

DialogProvider.propTypes = {
  children: PropTypes.any
};
