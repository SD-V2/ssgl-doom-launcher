import { remote } from 'electron';

// true when the load order in the window is not what the selected package has saved
// (or when there is a load order but no package at all)
export const isUnsaved = (pack, packages) => {
  const selected = pack.selected || [];
  if (!pack.id) return selected.length > 0;

  const saved = packages.find(p => p.id === pack.id);
  if (!saved) return selected.length > 0;

  const before = saved.selected || [];
  return (
    before.length !== selected.length || before.some((id, i) => id !== selected[i])
  );
};

// "Your load order has changes that are not saved" -> true = go on and lose them
export const confirmDiscard = async t => {
  const res = await remote.dialog.showMessageBox({
    type: 'warning',
    buttons: [t('packages:unsavedDiscard'), t('common:cancel')],
    defaultId: 1,
    cancelId: 1,
    message: t('packages:unsavedMessage'),
    detail: t('packages:unsavedDetail')
  });
  return res.response === 0;
};
