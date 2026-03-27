import { arrayMove } from "@dnd-kit/sortable";
import { type Dispatch, useCallback, useContext } from "react";
import useSWRMutation from "swr/mutation";
import { ulid } from "ulid";
import { dep, twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
import type { Template } from "~/model/template";
import type { User } from "~/model/user";
import { useNotification } from "~/Notification";
import { TwitchAuthContext } from "~/TwitchAuth";
import { exportTemplates, importTemplates } from "~/utils/templateIO";

type UseTemplateOperationsProps = {
  templates: Template[];
  setTemplates: Dispatch<Template[]>;
  users?: User[];
};

type UseTemplateOperationsResult = {
  onMoveTemplate: (sourceId: string, destinationId: string) => void;
  onApplyTemplate: (template: Template) => Promise<void>;
  onRemoveTemplate: (template: Template) => void;
  onCloneTemplate: (template: Template) => void;
  onSaveTemplate: (template: Template) => void;
  onImportTemplates: () => void;
  onExportTemplates: () => void;
  onAddTemplate: (template: Template) => void;
  onPostToX: (template: Template) => void;
};

/**
 * カスタムフック: テンプレート操作機能（移動、適用、削除、複製、保存、インポート、エクスポート、追加）を提供する
 *
 * @param props テンプレート配列、テンプレート更新関数、ユーザー情報
 * @returns テンプレート操作用のハンドラー関数群
 */
export const useTemplateOperations = ({
  templates,
  setTemplates,
  users,
}: UseTemplateOperationsProps): UseTemplateOperationsResult => {
  const { i18n, t } = useTranslation();
  const { token } = useContext(TwitchAuthContext);
  const { addNotification } = useNotification();

  const { trigger: applyTemplate } = useSWRMutation(
    () => [
      dep`https://api.twitch.tv/helix/channels?broadcaster_id=${users?.[0]?.id}`,
      token,
      i18n.language,
    ],
    twitch.patch,
    {
      onError: (error) => {
        addNotification({
          type: "error",
          title: t("error.template.apply.title"),
          message: t("error.template.apply.message", { error: error.message }),
          autoClose: true,
        });
      },
    },
  );

  const { trigger: createMarker } = useSWRMutation(
    () => [
      dep`https://api.twitch.tv/helix/streams/markers`,
      token,
      i18n.language,
    ],
    twitch.post,
  );

  const onMoveTemplate = useCallback(
    (sourceId: string, destinationId: string) => {
      // Find the corresponding indices in the templates array
      const sourceIndex = templates.findIndex((t) => t.id === sourceId);
      const destinationIndex = templates.findIndex(
        (t) => t.id === destinationId,
      );

      // Only proceed if both templates were found
      if (
        sourceIndex !== -1 &&
        destinationIndex !== -1 &&
        sourceIndex !== destinationIndex
      ) {
        const moved = arrayMove(templates, sourceIndex, destinationIndex);
        setTemplates(moved);
      }
    },
    [templates, setTemplates],
  );

  const onApplyTemplate = useCallback(
    async (template: Template) => {
      await applyTemplate({
        broadcaster_language: i18n.language,
        game_id: template.category.id,
        title: template.title,
        tags: template.tags,
      });

      // 配信開始前にはエラーになるが、それは正常な動作として無視する必要がある
      createMarker({
        user_id: users?.[0]?.id,
        description: template.title,
      });

      addNotification({
        type: "success",
        title: t("template.applySuccess"),
        message: `${template.title} - ${template.category.name}`,
        autoClose: true,
      });
    },
    [applyTemplate, createMarker, users, addNotification, i18n, t],
  );

  const onRemoveTemplate = useCallback(
    (removed: Template) => {
      const newTemplates = [...templates];
      const index = newTemplates.findIndex((t) => t.id === removed.id);
      newTemplates.splice(index, 1);
      setTemplates(newTemplates);
    },
    [templates, setTemplates],
  );

  const onCloneTemplate = useCallback(
    (cloned: Template) => {
      const clone = { ...cloned, id: ulid() };
      const newTemplates = [...templates];
      const index = newTemplates.findIndex((t) => t.id === cloned.id);
      newTemplates.splice(index + 1, 0, clone);
      setTemplates(newTemplates);
    },
    [templates, setTemplates],
  );

  const onSaveTemplate = useCallback(
    (saved: Template) => {
      const newTemplates = [...templates];
      const index = newTemplates.findIndex((t) => t.id === saved.id);
      newTemplates[index] = saved;
      setTemplates(newTemplates);
    },
    [templates, setTemplates],
  );

  const processImportedTemplates = useCallback(
    (importedTemplates: Template[]) => {
      // Avoid duplicates by checking IDs
      const existingIds = new Set(templates.map((t) => t.id));
      const newTemplates = importedTemplates.filter(
        (t) => !existingIds.has(t.id),
      );

      if (newTemplates.length > 0) {
        setTemplates([...templates, ...newTemplates]);

        // Show a notification when templates are imported
        addNotification({
          type: "success",
          title: t("template.importTemplates"),
          message: `${t("template.importTemplates")}: ${newTemplates.length} templates`,
          autoClose: true,
        });
      }
      return importedTemplates;
    },
    [templates, setTemplates, addNotification, t],
  );

  const onExportTemplates = useCallback(() => {
    exportTemplates(templates);
  }, [templates]);

  const onImportTemplates = useCallback(async () => {
    try {
      const importedTemplates = await importTemplates();
      processImportedTemplates(importedTemplates);
    } catch (error) {
      // Show error notification if import fails
      addNotification({
        type: "error",
        title: t("error.template.import.title"),
        message: t("error.template.import.message", {
          error: (error as Error).message,
        }),
        autoClose: true,
      });
    }
  }, [processImportedTemplates, addNotification, t]);

  const onAddTemplate = useCallback(
    (template: Template) => {
      setTemplates([...templates, template]);
    },
    [templates, setTemplates],
  );

  const onPostToX = useCallback(
    (template: Template) => {
      const login = users?.[0]?.login;
      const twitchUrl = login ? `https://twitch.tv/${login}` : "";
      const tags = template.tags.map((tag) => `#${tag}`).join(" ");
      const lines = [
        template.title,
        template.category.name,
        tags,
        twitchUrl,
      ].filter(Boolean);
      const text = lines.join("\n");
      const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [users],
  );

  return {
    onMoveTemplate,
    onApplyTemplate,
    onRemoveTemplate,
    onCloneTemplate,
    onSaveTemplate,
    onImportTemplates,
    onExportTemplates,
    onAddTemplate,
    onPostToX,
  };
};
