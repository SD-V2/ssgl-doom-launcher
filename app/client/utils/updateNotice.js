// When SSGL asks GitHub about updates, and which answers are shown.

// at the start and when you come back to the window, but not more often than this
export const MIN_GAP = 10 * 60 * 1000;

export const canCheck = (notifier, lastCheck, now) =>
  notifier !== 'off' && now - lastCheck >= MIN_GAP;

// the same notice is shown only once while SSGL is open
export const noticeKey = update =>
  `${update.kind}:${update.sha || update.version}`;

// isDismissed(sha) tells if you already said "not now" to that upload
export const shouldAnnounce = (update, announcedKey, isDismissed) =>
  !!update &&
  !!update.available &&
  noticeKey(update) !== announcedKey &&
  !(update.kind === 'files' && isDismissed(update.sha));

// "Stable only" shows no beta releases and no new uploads (they are work in progress)
export const isVisible = (notifier, update) => {
  if (!update || !update.available) return false;
  if (notifier === 'off') return false;
  if (notifier === 'stable' && (update.prerelease === true || update.kind === 'files')) {
    return false;
  }
  return true;
};
