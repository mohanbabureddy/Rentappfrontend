import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import ta from './locales/ta.json';

// A per-viewer UI preference, not shared app state -- localStorage is the
// right place for it (see apiClient.js authFetch for the same reasoning
// applied to session data, which is NOT stored this way).
function storedLanguage() {
  try {
    return localStorage.getItem('language') || 'en';
  } catch {
    return 'en';
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    kn: { translation: kn },
    ta: { translation: ta },
  },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
];

export function setLanguage(code) {
  i18n.changeLanguage(code);
  try {
    localStorage.setItem('language', code);
  } catch {
    // Private browsing / blocked storage -- the language still changes for
    // this session, it just won't be remembered next time.
  }
}

export default i18n;
