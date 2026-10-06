const KEY = 'ssgl.dismissedUpload';

export const isDismissed = sha => {
  try {
    return !!sha && localStorage.getItem(KEY) === sha;
  } catch (e) {
    return false;
  }
};

export const dismiss = sha => {
  try {
    if (sha) localStorage.setItem(KEY, sha);
  } catch (e) {
    // announced again next time, no harm
  }
};
