import React from "react";
import { LanguageSwitcher } from "~/LanguageSwitcher";
import { TwitchAuthContext } from "~/TwitchAuth";
import { useTranslation } from "~/i18n";

type User = {
  id: string;
  display_name: string;
  profile_image_url: string;
};

type Props = {
  user: User;
};

export const Menu: React.FC<Props> = ({ user }) => {
  const { t } = useTranslation();
  const { logout } = React.useContext(TwitchAuthContext);

  return (
    <div className="navbar bg-base-100">
      <div className="flex-1">
        <a href="/" className="btn btn-ghost text-xl">
          Stream Tag Inventory
        </a>
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
