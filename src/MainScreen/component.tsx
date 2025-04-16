import React from "react";
import useSWR from "swr";
import { Menu } from "~/Menu";
import { TwitchAuthContext } from "~/TwitchAuth";
import { twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
import type { Template } from "~/model/template";
import type { User } from "~/model/user";
import { useStorage } from "~/useStorage";
import { useTemplateOperations, useTemplateSearch } from "~/hooks";
import { AddTemplateButton } from "./AddTemplateButton";
import { TemplateList } from "./TemplateList";

export const MainScreen: React.FC = () => {
  const { t } = useTranslation();
  const { token } = React.useContext(TwitchAuthContext);
  const [templates, setTemplates] = useStorage<Template[]>("templates", []);

  const { data: users, isLoading } = useSWR(
    ["https://api.twitch.tv/helix/users", token],
    twitch.get<User[]>,
  );

  const { searchQuery, setSearchQuery, filteredTemplates } = useTemplateSearch(templates);

  const {
    onMoveTemplate,
    onApplyTemplate,
    onRemoveTemplate,
    onCloneTemplate,
    onSaveTemplate,
    onImportTemplates,
    onExportTemplates,
    onAddTemplate,
  } = useTemplateOperations({
    templates,
    setTemplates,
    users,
  });

  return (
    <div className="container mx-auto">
      {isLoading && <div className="skelton">{t("common.loading")}</div>}
      {users && (
        <Menu
          user={users[0]}
          onSearch={setSearchQuery}
          onImport={onImportTemplates}
          onExport={onExportTemplates}
        />
      )}
      <div className="p-16">
        <div className="flex flex-wrap gap-4">
          {filteredTemplates.length > 0 ? (
            <TemplateList
              templates={filteredTemplates}
              onMove={onMoveTemplate}
              onApply={onApplyTemplate}
              onRemove={onRemoveTemplate}
              onClone={onCloneTemplate}
              onSave={onSaveTemplate}
            />
          ) : (
            searchQuery.trim() && (
              <div className="w-full text-center py-8 text-gray-500">
                {t("template.noResults")}
              </div>
            )
          )}
          <AddTemplateButton
            onAdd={onAddTemplate}
          />
        </div>
      </div>
    </div>
  );
};
