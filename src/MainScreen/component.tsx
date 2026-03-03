import React, { useCallback } from "react";
import useSWR from "swr";
import { ulid } from "ulid";
import { CurrentStreamInfo } from "~/CurrentStreamInfo";
import { twitch } from "~/fetcher";
import {
  useChannelInfo,
  useTemplateOperations,
  useTemplateSearch,
} from "~/hooks";
import { useTranslation } from "~/i18n";
import { Menu } from "~/Menu";
import { newCategory } from "~/model/category";
import type { Template } from "~/model/template";
import type { User } from "~/model/user";
import { useNotification } from "~/Notification";
import { TwitchAuthContext } from "~/TwitchAuth";
import { useStorage } from "~/useStorage";
import { AddTemplateButton } from "./AddTemplateButton";
import { TemplateList } from "./TemplateList";

export const MainScreen: React.FC = () => {
  const { i18n, t } = useTranslation();
  const { token } = React.useContext(TwitchAuthContext);
  const [templates, setTemplates] = useStorage<Template[]>("templates", []);

  const { data: users, isLoading } = useSWR(
    ["https://api.twitch.tv/helix/users", token, i18n.language],
    twitch.get<User[]>,
  );

  const {
    channelInfo,
    category: channelCategory,
    isLoading: isChannelLoading,
  } = useChannelInfo(users?.[0]?.id);
  const { addNotification } = useNotification();

  const { searchQuery, setSearchQuery, filteredTemplates } =
    useTemplateSearch(templates);

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

  const onImportCurrentAsTemplate = useCallback(() => {
    if (!channelInfo) return;

    const template: Template = {
      id: ulid(),
      title: channelInfo.title,
      category: channelCategory ?? newCategory(),
      tags: channelInfo.tags,
    };

    onAddTemplate(template);
    addNotification({
      type: "success",
      title: t("stream.importSuccess"),
      message: `${channelInfo.title} - ${channelInfo.game_name}`,
      autoClose: true,
    });
  }, [channelInfo, channelCategory, onAddTemplate, addNotification, t]);

  return (
    <div className="container mx-auto">
      <Menu
        user={users?.[0]}
        isLoading={isLoading}
        onSearch={setSearchQuery}
        onImport={onImportTemplates}
        onExport={onExportTemplates}
      />
      <div className="flex flex-col gap-4 p-16 pt-24">
        <CurrentStreamInfo
          channelInfo={channelInfo}
          category={channelCategory}
          isLoading={isLoading || isChannelLoading}
          onImportAsTemplate={onImportCurrentAsTemplate}
        />
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
          <AddTemplateButton onAdd={onAddTemplate} />
        </div>
      </div>
    </div>
  );
};
