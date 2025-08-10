import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import language files
import enTranslation from "./locales/en/translation.json";
import zhCNTranslation from "./locales/zh-CN/translation.json";

// Configure i18next
i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      "zh-CN": {
        translation: zhCNTranslation,
      },
    },
    fallbackLng: "en", // Default language
    debug: false, // Turn off debugging in production

    interpolation: {
      escapeValue: false, // Don't escape HTML
    },

    // Language detection options
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "language", // Key name stored in localStorage
      caches: ["localStorage"],
    },
  });

export default i18n;
