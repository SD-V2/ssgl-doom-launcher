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
export const confirmDiscard = (dialog, t) =>
  dialog.confirm({
    title: t('packages:unsavedTitle'),
    message: t('packages:unsavedMessage'),
    detail: t('packages:unsavedDetail'),
    confirmText: t('packages:unsavedDiscard'),
    cancelText: t('common:cancel'),
    danger: true
  });
