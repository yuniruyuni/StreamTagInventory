import type React from "react";
import { useTranslation } from "~/i18n";

type Props = {
  uri: string;
};

export const Entrance: React.FC<Props> = ({ uri }) => {
  const { t } = useTranslation();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative">
      <div className="flex flex-col items-center">
        <h1 className="text-4xl">Stream Tag Inventory</h1>
        <a
          className="link text-2xl pt-4 text-blue-400 hover:text-blue-700 visited:text-purple-500"
          href={uri}
        >
          {t("auth.login")}
        </a>
      </div>

      <div className="absolute bottom-8 flex flex-col items-center gap-3">
        <a
          href="https://yuniruyuni.net/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-2 group transition-transform hover:scale-105"
        >
          <img
            src="/yuniruyuni.png"
            alt="yuniruyuni"
            className="w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-gray-300 group-hover:ring-blue-400 transition-all"
          />
          <span className="text-sm text-gray-600 group-hover:text-blue-500 transition-colors">
            Created by yuniruyuni
          </span>
        </a>
      </div>
    </div>
  );
};
