import type React from "react";
import { useTranslation } from "react-i18next";
import { SupportedLanguages } from "../i18n/config";

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <div className="form-control w-full max-w-xs">
      <select
        className="select select-bordered select-sm"
        value={i18n.language}
        onChange={changeLanguage}
        aria-label="Select language"
      >
        {SupportedLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {i18n.getFixedT(lang)("language")}
          </option>
        ))}
      </select>
    </div>
  );
};
