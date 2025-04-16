import React from "react";
import { LanguageSwitcher } from "~/LanguageSwitcher";
import { TwitchAuthContext } from "~/TwitchAuth";
import { useTranslation } from "~/i18n";
import type { User } from "~/model/user";

type Props = {
  user: User;
  onSearch: (query: string) => void;
  onImport: () => void;
  onExport: () => void;
};

export const Menu: React.FC<Props> = ({
  user,
  onSearch,
  onImport,
  onExport,
}) => {
  const { t } = useTranslation();
  const { logout } = React.useContext(TwitchAuthContext);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(event.target.value);
  };

  return (
    <div className="navbar bg-base-100 fixed top-0 left-0 right-0 z-30 shadow-md">
      <div className="flex-1 flex items-center">
        <a href="/" className="btn btn-ghost text-xl whitespace-nowrap">
          Stream Tag Inventory
        </a>
        <div className="form-control ml-4 mr-4 relative hidden md:block flex-grow">
          <input
            type="text"
            placeholder={t("template.search")}
            className="input input-bordered h-10 w-full pr-10"
            onChange={handleSearchChange}
            aria-label={t("template.search")}
          />
          <div className="absolute right-3 top-2.5 text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <title>{t("common.search")}</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>
      <div className="flex-none gap-4">
        <LanguageSwitcher />
        <div className="dropdown dropdown-end">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-circle avatar"
          >
            <div className="w-10 rounded-full">
              <img
                alt={`${user.display_name} icon`}
                src={user.profile_image_url}
              />
            </div>
          </div>
          <ul className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
            <li data-testid="import-templates-menu-item">
              <button type="button" onClick={onImport}>
                {t("template.importTemplates")}
              </button>
            </li>
            <li data-testid="export-templates-menu-item">
              <button type="button" onClick={onExport}>
                {t("template.exportTemplates")}
              </button>
            </li>
            {/* 区切り線をメニュー幅いっぱいに表示 */}
            <div className="py-0.5">
              <hr className="border-t border-gray-200 w-full" />
            </div>
            <li>
              <button type="button" onClick={() => logout()}>
                {t("auth.logout")}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
