import React from "react";
import { Avatar } from "~/components/Avatar";
import { Button } from "~/components/Button";
import { Dropdown, DropdownContent } from "~/components/Dropdown";
import { Input } from "~/components/Input";
import { MenuList } from "~/components/MenuList";
import { Navbar } from "~/components/Navbar";
import { useTranslation } from "~/i18n";
import { LanguageSwitcher } from "~/LanguageSwitcher";
import type { User } from "~/model/user";
import { TwitchAuthContext } from "~/TwitchAuth";

type Props = {
  user?: User;
  isLoading?: boolean;
  onSearch: (query: string) => void;
  onImport: () => void;
  onExport: () => void;
  onEditPostTemplate: () => void;
};

export const Menu: React.FC<Props> = ({
  user,
  isLoading,
  onSearch,
  onImport,
  onExport,
  onEditPostTemplate,
}) => {
  const { t } = useTranslation();
  const { logout } = React.useContext(TwitchAuthContext);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(event.target.value);
  };

  if (isLoading) {
    return (
      <Navbar className="bg-white fixed top-0 left-0 right-0 z-30 shadow-md">
        <div className="flex-1 flex items-center animate-pulse">
          <div className="bg-slate-200 rounded h-8 w-48 ml-4" />
          <div className="bg-slate-200 rounded h-10 w-64 ml-4 mr-4 hidden md:block" />
        </div>
        <div className="flex-none flex gap-4 animate-pulse">
          <div className="bg-slate-200 rounded h-8 w-20" />
          <div className="bg-slate-200 rounded-full w-10 h-10" />
        </div>
      </Navbar>
    );
  }

  if (!user) return null;

  return (
    <Navbar className="bg-white fixed top-0 left-0 right-0 z-30 shadow-md">
      <div className="flex-1 flex items-center">
        <a
          href="/"
          className="inline-flex items-center justify-center font-bold rounded-lg transition-colors px-4 py-2 bg-transparent hover:bg-slate-100 text-xl whitespace-nowrap"
        >
          Stream Tag Inventory
        </a>
        <div className="ml-4 mr-4 relative hidden md:block flex-grow">
          <Input
            type="text"
            placeholder={t("template.search")}
            className="h-10 w-full pr-10"
            onChange={handleSearchChange}
            aria-label={t("template.search")}
          />
          <div className="absolute right-3 top-2.5 text-slate-400">
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
      <div className="flex-none flex gap-4">
        <LanguageSwitcher />
        <Dropdown align="end">
          <Button
            type="button"
            tabIndex={0}
            variant="ghost"
            shape="circle"
            className="avatar"
            aria-label="user menu"
          >
            <Avatar>
              <div className="w-10 rounded-full">
                <img
                  alt={`${user.display_name} icon`}
                  src={user.profile_image_url}
                />
              </div>
            </Avatar>
          </Button>
          <DropdownContent
            role="menu"
            aria-label="user menu"
            className="mt-3 w-52 p-2 shadow bg-white rounded-lg"
          >
            <MenuList size="sm">
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
              <li data-testid="post-template-menu-item">
                <button type="button" onClick={onEditPostTemplate}>
                  {t("settings.postTemplate")}
                </button>
              </li>
              {/* 区切り線をメニュー幅いっぱいに表示 */}
              <div className="py-0.5">
                <hr className="border-t border-slate-200 w-full" />
              </div>
              <li>
                <button type="button" onClick={() => logout()}>
                  {t("auth.logout")}
                </button>
              </li>
            </MenuList>
          </DropdownContent>
        </Dropdown>
      </div>
    </Navbar>
  );
};
