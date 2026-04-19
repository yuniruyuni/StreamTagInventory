import { useCallback, useContext } from "react";
import useSWRMutation from "swr/mutation";
import { ulid } from "ulid";
import { dep, twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
import type { Template } from "~/model/template";
import type { User } from "~/model/user";
import { useNotification } from "~/Notification";
import { useTemplates } from "~/sync/useTemplates";
import { TwitchAuthContext } from "~/TwitchAuth";
import { exportTemplates, importTemplates } from "~/utils/templateIO";

type UseTemplateOperationsProps = {
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
};

/**
 * テンプレート操作 (移動, 適用, 削除, 複製, 保存, インポート, エクスポート, 追加) を提供する。
 *
 * PR 7: テンプレート CRUD は `useTemplates` (Y.Doc) に委譲する。Twitch API 呼出
 * (apply / marker) は無変更。Import/Export はファイル I/O 経由のため Y.Doc とは
 * 独立して動かす (imported list を bulk merge する)。
 */
export const useTemplateOperations = ({
  users,
}: UseTemplateOperationsProps): UseTemplateOperationsResult => {
  const { i18n, t } = useTranslation();
  const { token } = useContext(TwitchAuthContext);
  const { addNotification } = useNotification();
  const {
    templates,
    addTemplate,
    updateTemplate,
    removeTemplate,
    moveTemplate,
    bulkReplace,
  } = useTemplates();

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
    (sourceId: string, destinationId: string) =>
      moveTemplate(sourceId, destinationId),
    [moveTemplate],
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
    (removed: Template) => removeTemplate(removed.id),
    [removeTemplate],
  );

  const onCloneTemplate = useCallback(
    (cloned: Template) => addTemplate({ ...cloned, id: ulid() }),
    [addTemplate],
  );

  const onSaveTemplate = useCallback(
    (saved: Template) => updateTemplate(saved),
    [updateTemplate],
  );

  const processImportedTemplates = useCallback(
    (importedTemplates: Template[]) => {
      // 既存 id と被らない分だけ append する。bulkReplace ではなく既存 + 新規を
      // bulkReplace する形 (Y.Array に append でも良いが、CRDT 的に一括 op の
      // ほうが echo 1 回で済む)
      const existingIds = new Set(templates.map((t) => t.id));
      const newOnes = importedTemplates.filter((t) => !existingIds.has(t.id));

      if (newOnes.length > 0) {
        bulkReplace([...templates, ...newOnes]);
        addNotification({
          type: "success",
          title: t("template.importTemplates"),
          message: `${t("template.importTemplates")}: ${newOnes.length} templates`,
          autoClose: true,
        });
      }
      return importedTemplates;
    },
    [templates, bulkReplace, addNotification, t],
  );

  const onExportTemplates = useCallback(() => {
    exportTemplates(templates);
  }, [templates]);

  const onImportTemplates = useCallback(async () => {
    try {
      const importedTemplates = await importTemplates();
      processImportedTemplates(importedTemplates);
    } catch (error) {
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
    (template: Template) => addTemplate(template),
    [addTemplate],
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
  };
};
