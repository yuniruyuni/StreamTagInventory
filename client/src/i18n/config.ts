import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import translationEN from "./locales/en.json";
import translationJA from "./locales/ja.json";

const resources = {
  en: {
    translation: translationEN,
  },
  ja: {
    translation: translationJA,
  },
};

export type TSupportedLanguages = keyof typeof resources;
export const SupportedLanguages = Object.keys(
  resources,
) as (keyof typeof resources)[];

// 言語設定の保存に使用するキー
export const LANGUAGE_STORAGE_KEY = "language";

i18n
  .use(LanguageDetector) // 言語検出機能
  .use(initReactI18next) // Reactと統合
  .init({
    resources,
    supportedLngs: ["en", "ja"], // サポートする言語を明示的に指定
    load: "languageOnly", // 地域コード（ja-JP）を無視して言語コード（ja）のみを使用
    fallbackLng: "ja", // フォールバック言語
    debug: process.env.NODE_ENV === "development",
    interpolation: {
      escapeValue: false, // Reactではすでにエスケープされている
    },
    detection: {
      order: ["localStorage", "navigator"], // 検出順序を変更（localStorageを優先）
      caches: ["localStorage"], // 言語設定をキャッシュ
      lookupLocalStorage: LANGUAGE_STORAGE_KEY, // LocalStorageに保存するキーを明示的に指定
    },
  });

export default i18n;
