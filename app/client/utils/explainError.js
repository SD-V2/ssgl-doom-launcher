// Turns an error from the file handling into a sentence in the current language.
//   { code: 'E_FOLDER_EXISTS', params } -> t('errors:E_FOLDER_EXISTS')
//   'SETTINGS_FILE' (older style code)   -> t('errors:SETTINGS_FILE')
//   anything else (system messages)      -> shown as it is
const explainError = (err, t) => {
  if (err && typeof err === 'object' && typeof err.code === 'string') {
    return t(`errors:${err.code}`, {
      ...(err.params || {}),
      defaultValue: err.message || err.code
    });
  }
  const text = String((err && err.message) || err);
  return /^[A-Z][A-Z_]+$/.test(text)
    ? t(`errors:${text}`, { defaultValue: text })
    : text;
};

export default explainError;
