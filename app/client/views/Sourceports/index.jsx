import { AnimatePresence } from 'framer-motion';
import React, { useContext, useEffect, useState } from 'react';
import styled from 'styled-components';

import { Box, Flex } from '../../components';
import Confirm from '../../components/Confirm';
import { Button } from '../../components/Form';
import { StoreContext } from '../../state';
import { setTitle, useIpc, useToast, useTranslation } from '../../utils';
import AnimatedView from '../AnimatedView';
import Form from './Form';
import SourcePortItem from './SourcePortItem';

const SourcePortListStyle = styled.ul`
  margin-top: 15px;
`;

const SourcePorts = () => {
  setTitle('sourceports');
  const { gstate, dispatch } = useContext(StoreContext);
  const [selected, setSelected] = useState(null);
  const [sourcePorts, setSourcePorts] = useState(gstate.sourceports);
  const [ipc] = useIpc();
  const [toast] = useToast();
  const { t } = useTranslation(['sourceports', 'common']);
  const [confirm, setConfirm] = useState({ id: null, open: false });
  useEffect(() => {
    if (sourcePorts.length > 0) {
      setSelected(sourcePorts[0]);
    }
  }, []);
  const createSourceport = () => {
    const item = {
      id: null,
      hasSavedir: false,
      hasConfig: false,
      paramLoad: '-loadgame',
      paramSave: '-savedir',
      paramConfig: '-config',
      configFilename: 'gzdoom.ini',
      configDefault: '',
      name: 'New Sourceport',
      binary: ''
    };
    setSourcePorts([...sourcePorts, item]);
    setSelected(item);
  };

  const selectSourceport = item => () => setSelected(item);

  const onOkDelete = async () => {
    if (!confirm.id) {
      // a new sourceport that was never saved: just drop it from the list
      const left = sourcePorts.filter(item => item.id);
      setSourcePorts(left);
      setConfirm({ id: null, open: false });
      setSelected(left[0] || null);
      return;
    }

    try {
      const newSourceports = await ipc('sourceports/delete', confirm.id);
      setSourcePorts(newSourceports);
      dispatch({ type: 'sourceports/save', data: newSourceports });
      setConfirm({
        id: null,
        open: false
      });
      setSelected(newSourceports[0] || null);
    } catch (e) {
      toast('danger', t('common:error'));
    }
  };

  const onDeleteSourcePort = id => () =>
    setConfirm({
      id: id,
      open: true
    });

  const onCancelDelete = () =>
    setConfirm({
      id: null,
      open: false
    });

  const onSaveSourcePort = async sourceport => {
    try {
      const newSourcePorts = await ipc('sourceports/save', sourceport);
      setSourcePorts(newSourcePorts);
      dispatch({ type: 'sourceports/save', data: newSourcePorts });
      if (!sourceport.id) {
        // a new one got its id now: keep it selected, so a second Save does not add it twice
        const known = new Set(sourcePorts.map(item => item.id));
        const added = newSourcePorts.find(item => !known.has(item.id));
        if (added) setSelected(added);
      }
      toast('ok', t('common:success'), t('sourceports:toastSaved'));
    } catch (e) {
      console.log(e);
      toast('danger', t('common:error'));
    }
  };

  return (
    <AnimatedView>
      <Flex.Grid>
        <Flex.Col width="450px">
          <Box>
            <Button onClick={createSourceport} fluid>
              Add Sourceport
            </Button>
            <SourcePortListStyle>
              <AnimatePresence initial={false}>
                {sourcePorts.map(item => (
                  <SourcePortItem
                    className={
                      selected && item.id === selected.id ? 'active' : undefined
                    }
                    key={item.id}
                    item={item}
                    onClick={selectSourceport(item)}
                  />
                ))}
              </AnimatePresence>
            </SourcePortListStyle>
          </Box>
        </Flex.Col>
        <Flex.Col>
          <Box>
            {selected ? (
              <>
                <Form
                  item={selected}
                  onSave={onSaveSourcePort}
                  onDelete={onDeleteSourcePort}
                />
              </>
            ) : null}
          </Box>
        </Flex.Col>
      </Flex.Grid>
      <Confirm
        active={confirm.open}
        onOk={onOkDelete}
        onCancel={onCancelDelete}
      />
    </AnimatedView>
  );
};

export default SourcePorts;
