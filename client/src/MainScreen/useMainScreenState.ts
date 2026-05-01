import { useCallback, useContext, useState } from "react";
import useSWR from "swr";
import { ulid } from "ulid";
import { twitch } from "~/fetcher";
import {
  useChannelInfo,
  useTemplateOperations,
  useTemplateSearch,
} from "~/hooks";
import { useTranslation } from "~/i18n";
import { newCategory } from "~/model/category";
import type { Template } from "~/model/template";
import type { User } from "~/model/user";
import { useNotification } from "~/Notification";
import { usePostTemplate } from "~/sync/usePostTemplate";
import { useTemplates } from "~/sync/useTemplates";
import { TwitchAuthContext } from "~/TwitchAuth";

export function useMainScreenState() {
  const { i18n, t } = useTranslation();
  const { token } = useContext(TwitchAuthContext);
  const { templates } = useTemplates();
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

  const {
    onAddTemplate,
    onMoveTemplate,
    onApplyTemplate,
    onRemoveTemplate,
    onCloneTemplate,
    onSaveTemplate,
    onImportTemplates,
    onExportTemplates,
  } = useTemplateOperations({ users });

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

  return {
    users,
    isLoading,
    channelInfo,
    channelCategory,
    isChannelLoading,
    searchQuery,
    setSearchQuery,
    filteredTemplates,
    postTemplate,
    setPostTemplate,
    postTemplateEditorOpen,
    setPostTemplateEditorOpen,
    onImportCurrentAsTemplate,
    onAddTemplate,
    onMoveTemplate,
    onApplyTemplate,
    onRemoveTemplate,
    onCloneTemplate,
    onSaveTemplate,
    onImportTemplates,
    onExportTemplates,
  };
}
