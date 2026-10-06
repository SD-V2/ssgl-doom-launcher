import { ipcRenderer } from 'electron';
import { useContext, useEffect, useRef } from 'react';

import { StoreContext } from '../state';
import { useDialog } from './Dialog';
import { explainError, useToast, useTranslation } from '../utils';

// Reacts to the "Packages" menu: export current / all packages, import a file.
// Renders nothing.
const PackageTransfer = () => {
  const { gstate, dispatch } = useContext(StoreContext);
  const [toast] = useToast();
  const { t } = useTranslation(['packages', 'common']);

  // the listeners are set once, so they read the latest state from here
  const latest = useRef({});
  const dialog = useDialog();
  latest.current = { gstate, dispatch, toast, t, dialog };

  useEffect(() => {
    const exportPackages = async current => {
      const { gstate, toast, t } = latest.current;

      if (current && !gstate.package.id) {
        toast('danger', t('common:error'), t('packages:exportNoCurrent'));
        return;
      }

      const names = {};
      gstate.mods.forEach(m => {
        names[m.id] = `${m.name}.${String(m.kind || '').toLowerCase()}`;
      });

      const res = await ipcRenderer.invoke('packages/export', {
        ids: current ? [gstate.package.id] : null,
        names,
        labels: {
          title: t('packages:exportDialogTitle'),
          filter: t('packages:fileFilter')
        }
      });

      if (res.error) {
        toast('danger', t('common:error'), explainError(res.error, t));
      } else if (!res.data.canceled) {
        toast(
          'ok',
          t('common:success'),
          t('packages:exportDone', { count: res.data.count })
        );
      }
    };

    const importPackages = async () => {
      const { gstate, dispatch, toast, t, dialog } = latest.current;
      const res = await ipcRenderer.invoke('packages/import', {
        labels: {
          title: t('packages:importDialogTitle'),
          filter: t('packages:fileFilter')
        }
      });

      if (res.error) {
        toast('danger', t('common:error'), explainError(res.error, t));
        return;
      }
      if (res.data.canceled) return;

      const { packages, imported, notes } = res.data;
      dispatch({ type: 'packages/set', packages });

      // mods the imported packages use that this PC does not have
      const have = new Set(gstate.mods.map(m => m.id));
      const missing = [];
      imported.forEach(pack => {
        pack.selected.forEach(id => {
          if (!have.has(id)) {
            missing.push(`${pack.modNames[id] || id}  (${pack.name})`);
          }
        });
      });

      toast(
        'ok',
        t('common:success'),
        t('packages:importDone', { count: imported.length })
      );

      if (missing.length || notes.length) {
        const shown = missing.slice(0, 25);
        const lines = [];
        if (notes.length) {
          lines.push(
            ...notes.map(note =>
              note.code === 'sourceport'
                ? t('packages:noteSourceport', note)
                : t('packages:noteIwad', note)
            ),
            ''
          );
        }
        if (missing.length) {
          lines.push(t('packages:importMissing', { count: missing.length }));
          lines.push(...shown);
          if (missing.length > shown.length) {
            lines.push(`... +${missing.length - shown.length}`);
          }
        }
        dialog.info({
          title: t('packages:importDone', { count: imported.length }),
          lines,
          okText: t('common:ok'),
          wide: true
        });
      }
    };

    // never fail silently: any error becomes a message
    const guard = fn => async () => {
      try {
        await fn();
      } catch (err) {
        const { toast, t } = latest.current;
        toast('danger', t('common:error'), explainError(err, t));
      }
    };

    const onCurrent = guard(() => exportPackages(true));
    const onAll = guard(() => exportPackages(false));
    const onImport = guard(importPackages);

    ipcRenderer.on('menu/export-current', onCurrent);
    ipcRenderer.on('menu/export-all', onAll);
    ipcRenderer.on('menu/import', onImport);
    return () => {
      ipcRenderer.removeListener('menu/export-current', onCurrent);
      ipcRenderer.removeListener('menu/export-all', onAll);
      ipcRenderer.removeListener('menu/import', onImport);
    };
  }, []);

  return null;
};

export default PackageTransfer;
