import ar from './ar';
import de from './de';
import en from './en';
import nl from './nl';
import ru from './ru';
import tr from './tr';

// label = the language written in itself
export const AVAILABLE_LOCALES = [
  {
    label: 'English',
    value: 'en'
  },
  {
    label: 'Deutsch',
    value: 'de'
  },
  {
    label: 'Nederlands',
    value: 'nl'
  },
  {
    label: 'Русский',
    value: 'ru'
  },
  {
    label: 'Türkçe',
    value: 'tr'
  },
  {
    label: 'العربية',
    value: 'ar'
  }
];

// languages that are written from right to left
export const RTL_LOCALES = ['ar'];

export default {
  en,
  de,
  nl,
  ru,
  tr,
  ar
};
