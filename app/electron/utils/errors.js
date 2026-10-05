// An error the window can show in the language of the user: a code (see the
// "errors" texts of the language files) plus values for the sentence.
export class AppError extends Error {
  constructor(code, params = {}, message) {
    super(message || code);
    this.code = code;
    this.params = params;
  }
}

// what goes back to the window for an error
export const toPayload = err => {
  if (err && typeof err.code === 'string' && err.code.indexOf('E_') === 0) {
    return { code: err.code, params: err.params || {}, message: err.message };
  }
  return (err && err.message) || String(err);
};

export default {
  SETTINGS_FILE: {
    data: null,
    error: 'SETTINGS_FILE'
  },
  UNEXPECTED: {
    data: null,
    error: 'UNEXPECTED'
  },
  WALKER_ERROR: {
    data: null,
    error: 'WALKER_ERROR'
  },
  JSON_WRITE: {
    data: null,
    error: 'JSON_WRITE'
  }
};
