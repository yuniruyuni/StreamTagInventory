import type React from "react";
import { AuthorInfo } from "~/AuthorInfo/component";
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
        <AuthorInfo />
      </div>
    </div>
  );
};
