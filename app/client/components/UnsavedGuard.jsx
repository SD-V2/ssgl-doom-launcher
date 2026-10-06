import { ipcRenderer } from 'electron';
import { useContext, useEffect, useRef } from 'react';

import { StoreContext } from '../state';
import { useToast, useTranslation } from '../utils';
import { useDialog } from './Dialog';
import { isUnsaved } from '../utils/unsaved';

// Renders nothing. Tells the main process whether there are unsaved changes
// (so closing SSGL can ask) and reports files that were restored from their copy.
const UnsavedGuard = () => {
  const { gstate, dispatch } = useContext(StoreContext);
  const [toast] = useToast();
  const dialog = useDialog();
  const { t } = useTranslation(['packages', 'common']);

  const dirty = isUnsaved(gstate.package, gstate.packages);

  useEffect(() => {
    ipcRenderer.send('app/dirty', { dirty });
  }, [dirty]);

  // closing SSGL with unsaved changes: the main process asks us to ask you
  const latest = useRef({});
  latest.current = { dialog, t };
  const asking = useRef(false);
  useEffect(() => {
    const onCloseRequest = async () => {
      if (asking.current) return;
      asking.current = true;
      const { dialog: box, t: tr } = latest.current;
      const sure = await box.confirm({
        title: tr('packages:unsavedTitle'),
        message: tr('packages:unsavedCloseMessage'),
        detail: tr('packages:unsavedDetail'),
        confirmText: tr('packages:unsavedCloseDiscard'),
        cancelText: tr('common:cancel'),
        danger: true
      });
      asking.current = false;
      if (sure) ipcRenderer.send('app/close-confirmed');
    };
    ipcRenderer.on('app/close-request', onCloseRequest);
    return () => ipcRenderer.removeListener('app/close-request', onCloseRequest);
  }, []);

  const told = useRef('');
  useEffect(() => {
    if (!gstate.recovered || !gstate.recovered.length) return;
    const key = gstate.recovered.join(',');
    if (told.current === key) return;
    told.current = key;
    gstate.recovered.forEach(name =>
      toast('danger', t('common:error'), t('common:recovered', { name }))
    );
    dispatch({ type: 'recovered/clear' });
  }, [gstate.recovered]);

  return null;
};

export default UnsavedGuard;
