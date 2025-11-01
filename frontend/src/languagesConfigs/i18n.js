import i18n from 'i18next';                              // import core i18next
import { initReactI18next } from 'react-i18next';         // import React binding
// Static imports of translation JSON:
import enTranslation from './locales/en/translation.json';
import amTranslation from './locales/am/translation.json';
import orTranslation from './locales/or/translation.json';

// Define resources object
const resources = {
  en: { translation: enTranslation },  // English translations
  am: { translation: amTranslation },  // Amharic translations
  or: { translation: orTranslation },  // Oromo   translations
};

// Initialize
i18n
  .use(initReactI18next)             // pass i18n to react-i18next
  .init({                            // start configuration
    resources,                       // our translations
    lng: 'en',                       // default language
    fallbackLng: 'en',               // fallback when key missing
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false }    // disable suspense (bundled resources)
  });

export default i18n;                // export for use in index.js