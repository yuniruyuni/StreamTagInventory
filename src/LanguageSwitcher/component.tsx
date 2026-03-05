import type React from "react";
import { useTranslation } from "react-i18next";
import { Select } from "~/components/Select";
import { SupportedLanguages } from "../i18n/config";

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <div className="flex items-center">
      <Select
        size="sm"
        bordered
        value={i18n.language}
        onChange={changeLanguage}
        aria-label="Select language"
      >
        {SupportedLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {i18n.getFixedT(lang)("language")}
          </option>
        ))}
      </Select>
    </div>
  );
};
