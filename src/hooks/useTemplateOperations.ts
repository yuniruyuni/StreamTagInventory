import { useCallback, useContext, type Dispatch } from "react";
import { ulid } from "ulid";
import useSWRMutation from "swr/mutation";
import { arrayMove } from "@dnd-kit/sortable";

import { TwitchAuthContext } from "~/TwitchAuth";
import { dep, twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
import type { Template } from "~/model/template";
import type { User } from "~/model/user";
import { exportTemplates, importTemplates } from "~/utils/templateIO";
import { ErrorNotification } from "~/ErrorNotification";

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

  const { trigger: applyTemplate } = useSWRMutation(
    () => [
      dep`https://api.twitch.tv/helix/channels?broadcaster_id=${users?.[0]?.id}`,
      token,
    ],
    twitch.patch,
    {
      onError: async (error) => {
        await ErrorNotification.call({
          title: t("error.template.apply.title"),
          message: t("error.template.apply.message", { error: error.message }),
        });
      },
    }
  );

  const { trigger: createMarker } = useSWRMutation(
    () => [dep`https://api.twitch.tv/helix/streams/markers`, token],
    twitch.post,
  );

  const onMoveTemplate = useCallback(
    (sourceId: string, destinationId: string) => {
      // Find the corresponding indices in the templates array
      const sourceIndex = templates.findIndex((t) => t.id === sourceId);
      const destinationIndex = templates.findIndex((t) => t.id === destinationId);

      // Only proceed if both templates were found
      if (sourceIndex !== -1 && destinationIndex !== -1 && sourceIndex !== destinationIndex) {
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
    },
    [applyTemplate, createMarker, users, i18n],
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
      const existingIds = new Set(templates.map(t => t.id));
      const newTemplates = importedTemplates.filter(t => !existingIds.has(t.id));

      if (newTemplates.length > 0) {
        setTemplates([...templates, ...newTemplates]);
      }
      return importedTemplates;
    },
    [templates, setTemplates],
  );

  const onExportTemplates = useCallback(() => {
    exportTemplates(templates);
  }, [templates]);

  const onImportTemplates = useCallback(async () => {
    const importedTemplates = await importTemplates();
    processImportedTemplates(importedTemplates);
  }, [processImportedTemplates]);

  const onAddTemplate = useCallback(
    (template: Template) => {
      setTemplates([...templates, template]);
    },
    [templates, setTemplates],
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
