import { formatDistance } from 'date-fns';
import { arSA, de, nl, tr } from 'date-fns/locale';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import locales from './locales';

const lngs = {
  de: de,
  nl: nl,
  tr: tr,
  ar: arSA
};

i18n.use(initReactI18next).init({
  interpolation: {
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

// The whole window follows the language: reading direction (Arabic is written
// from right to left) and the lang attribute
const applyDirection = lng => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('lang', lng);
  root.setAttribute('dir', i18n.dir(lng));
};

i18n.on('languageChanged', applyDirection);
applyDirection(i18n.language);

export default i18n;
