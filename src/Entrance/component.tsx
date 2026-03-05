import type React from "react";
import { AuthorInfo } from "~/AuthorInfo/component";
import { Link } from "~/components/Link";
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
        <p className="text-xl text-gray-700 pt-6 text-center">
          {t("entrance.tagline")}
        </p>
        <p className="text-sm text-gray-500 pt-2 text-center max-w-md px-4">
          {t("entrance.description")}
        </p>
        <Link
          className="text-2xl pt-6 text-blue-400 hover:text-blue-700 visited:text-purple-500"
          href={uri}
        >
          {t("auth.login")}
        </Link>
      </div>

      <div className="absolute bottom-8 flex flex-col items-center gap-3">
        <AuthorInfo />
      </div>
    </div>
  );
};
