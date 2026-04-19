import React, { useCallback, useState } from "react";
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
import { cloneTemplate, type Template } from "~/model/template";
import type { User } from "~/model/user";
import { useNotification } from "~/Notification";
import { PostTemplateEditor } from "~/PostTemplateEditor";
import { usePostTemplate } from "~/sync/usePostTemplate";
import { useTemplates } from "~/sync/useTemplates";
import { TwitchAuthContext } from "~/TwitchAuth";

import { AddTemplateButton } from "./AddTemplateButton";
import { TemplateList } from "./TemplateList";

export const MainScreen: React.FC = () => {
  const { i18n, t } = useTranslation();
  const { token } = React.useContext(TwitchAuthContext);
  const {
    templates,
    addTemplate,
    updateTemplate,
    removeTemplate,
    moveTemplate,
  } = useTemplates();
  const { postTemplate, setPostTemplate } = usePostTemplate();
  const [postTemplateEditorOpen, setPostTemplateEditorOpen] = useState(false);

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

  // Twitch 依存操作 (apply + marker) と import/export 専用。CRUD は useTemplates の
  // setter を TemplateCard / TemplateList にそのまま渡す。
  const { onApplyTemplate, onImportTemplates, onExportTemplates } =
    useTemplateOperations({ users });

  const onRemoveTemplate = useCallback(
    (t: Template) => removeTemplate(t.id),
    [removeTemplate],
  );
  const onCloneTemplate = useCallback(
    (t: Template) => addTemplate(cloneTemplate(t)),
    [addTemplate],
  );

  const onImportCurrentAsTemplate = useCallback(() => {
    if (!channelInfo) return;

    const template: Template = {
      id: ulid(),
      title: channelInfo.title,
      category: channelCategory ?? newCategory(),
      tags: channelInfo.tags,
    };

    addTemplate(template);
    addNotification({
      type: "success",
      title: t("stream.importSuccess"),
      message: `${channelInfo.title} - ${channelInfo.game_name}`,
      autoClose: true,
    });
  }, [channelInfo, channelCategory, addTemplate, addNotification, t]);

  return (
    <div className="container mx-auto">
      <Menu
        user={users?.[0]}
        isLoading={isLoading}
        onSearch={setSearchQuery}
        onImport={onImportTemplates}
        onExport={onExportTemplates}
        onEditPostTemplate={() => setPostTemplateEditorOpen(true)}
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
              onMove={moveTemplate}
              onApply={onApplyTemplate}
              onRemove={onRemoveTemplate}
              onClone={onCloneTemplate}
              onSave={updateTemplate}
              userLogin={users?.[0]?.login}
              postTemplate={postTemplate}
            />
          ) : (
            searchQuery.trim() && (
              <div className="w-full text-center py-8 text-slate-500">
                {t("template.noResults")}
              </div>
            )
          )}
          <AddTemplateButton onAdd={addTemplate} />
        </div>
      </div>
      <PostTemplateEditor
        open={postTemplateEditorOpen}
        postTemplate={postTemplate}
        onSave={setPostTemplate}
        onClose={() => setPostTemplateEditorOpen(false)}
      />
    </div>
  );
};
