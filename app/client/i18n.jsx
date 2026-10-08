import { formatDistance } from 'date-fns';
import { arSA, de, nl, ru, tr } from 'date-fns/locale';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import locales from './locales';
import { followTextDirection } from './utils/textDirection';

const lngs = {
  de: de,
  nl: nl,
  ru: ru,
  tr: tr,
  ar: arSA
};

i18n.use(initReactI18next).init({
  interpolation: {
    escapeValue: false,
    format: function(value, format, lng) {
      if (format === 'date') {
        return formatDistance(value, Date.now(), {
          locale: lngs[lng] || null
        });
      }
      return value;
    }
  },
  lng: 'en',
  fallbackLng: 'en',
  debug: false,
  resources: locales
});

// The layout is the same in every language (left to right, nothing is mirrored).
// Only the text follows the language: in Arabic every line of text reads from right
// to left and lines up on the right (global.css, data-text-dir), English names stay
// left to right.
const applyDirection = lng => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('lang', lng);
  root.setAttribute('dir', 'ltr');
  root.setAttribute('data-text-dir', i18n.dir(lng));
  followTextDirection(i18n.dir(lng) === 'rtl');
};

i18n.on('languageChanged', applyDirection);
applyDirection(i18n.language);

export default i18n;
