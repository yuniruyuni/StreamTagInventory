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
    <main
      className="entrance-screen h-screen w-screen flex flex-col items-center justify-center relative"
      data-testid="entrance-screen"
    >
      <div className="entrance-content flex flex-col items-center">
        <h1 className="entrance-title text-4xl font-bold">
          Stream Tag Inventory
        </h1>
        <p className="entrance-tagline text-xl text-slate-900 pt-6 text-center">
          {t("entrance.tagline")}
        </p>
        <p className="entrance-description text-sm text-slate-500 pt-2 text-center max-w-md px-4">
          {t("entrance.description")}
        </p>
        <Link
          className="entrance-login text-2xl pt-6 text-sky-600 hover:text-sky-700"
          href={uri}
        >
          {t("auth.login")}
        </Link>
      </div>

      <div className="entrance-author absolute bottom-8 flex flex-col items-center gap-3">
        <AuthorInfo />
      </div>
    </main>
  );
};
