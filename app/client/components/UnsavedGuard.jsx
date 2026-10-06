import { ipcRenderer } from 'electron';
import { useContext, useEffect, useRef } from 'react';

import { StoreContext } from '../state';
import { useToast, useTranslation } from '../utils';
import { isUnsaved } from '../utils/unsaved';

// Renders nothing. Tells the main process whether there are unsaved changes
// (so closing SSGL can ask) and reports files that were restored from their copy.
const UnsavedGuard = () => {
  const { gstate, dispatch } = useContext(StoreContext);
  const [toast] = useToast();
  const { t } = useTranslation(['packages', 'common']);

  const dirty = isUnsaved(gstate.package, gstate.packages);

  useEffect(() => {
    ipcRenderer.send('app/dirty', {
      dirty,
      labels: {
        message: t('packages:unsavedCloseMessage'),
        detail: t('packages:unsavedDetail'),
        discard: t('packages:unsavedCloseDiscard'),
        cancel: t('common:cancel')
      }
    });
  }, [dirty, t]);

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
