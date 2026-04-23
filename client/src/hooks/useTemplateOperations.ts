import { useCallback, useContext } from "react";
import useSWRMutation from "swr/mutation";
import { dep, twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
import { cloneTemplate, type Template } from "~/model/template";
import type { User } from "~/model/user";
import { useNotification } from "~/Notification";
import { useTemplates } from "~/sync/useTemplates";
import { TwitchAuthContext } from "~/TwitchAuth";
import { exportTemplates, importTemplates } from "~/utils/templateIO";

type UseTemplateOperationsProps = {
  users?: User[];
};

type UseTemplateOperationsResult = {
  onAddTemplate: (template: Template) => void;
  onMoveTemplate: (sourceId: string, destinationId: string) => void;
  onApplyTemplate: (template: Template) => Promise<void>;
  onRemoveTemplate: (template: Template) => void;
  onCloneTemplate: (template: Template) => void;
  onSaveTemplate: (template: Template) => void;
  onImportTemplates: () => void;
  onExportTemplates: () => void;
};

/**
 * テンプレートに対して行える UX 操作の総目録。ここを見れば「templates に対して
 * 画面から行える操作」が一覧できる、という単一の catalog を維持する。
 *
 * 内部的には:
 *  - CRUD (add / update / remove / move / clone) は `useTemplates` (Y.Doc) に委譲
 *  - Twitch API 操作 (channel apply + stream marker) は SWR mutation
 *  - import / export はファイル I/O と `bulkReplace`
 *
 * TemplateCard 形状 (`(template: Template) => void`) と useTemplates setter 形状
 * (`(id)` / `(template)`) のインピーダンスマッチ (onRemove で id 抽出 /
 * onClone で id 振り直し) もここで吸収する。
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
    (template: Template) => removeTemplate(template.id),
    [removeTemplate],
  );

  const onCloneTemplate = useCallback(
    (template: Template) => addTemplate(cloneTemplate(template)),
    [addTemplate],
  );

  const onExportTemplates = useCallback(() => {
    exportTemplates(templates);
  }, [templates]);

  const onImportTemplates = useCallback(async () => {
    try {
      const imported = await importTemplates();
      // 既存 id と被らない分だけ append。bulkReplace で「既存 + 新規」を 1 op に
      // まとめて echo / server sync を 1 回に絞る。
      const existingIds = new Set(templates.map((tpl) => tpl.id));
      const newOnes = imported.filter((tpl) => !existingIds.has(tpl.id));
      if (newOnes.length > 0) {
        bulkReplace([...templates, ...newOnes]);
        addNotification({
          type: "success",
          title: t("template.importTemplates"),
          message: `${t("template.importTemplates")}: ${newOnes.length} templates`,
          autoClose: true,
        });
      }
    } catch (error) {
      addNotification({
        type: "error",
        title: t("error.template.import.title"),
        message: t("error.template.import.message", {
          error: error instanceof Error ? error.message : String(error),
        }),
        autoClose: true,
      });
    }
  }, [templates, bulkReplace, addNotification, t]);

  return {
    onAddTemplate: addTemplate,
    onMoveTemplate: moveTemplate,
    onSaveTemplate: updateTemplate,
    onApplyTemplate,
    onRemoveTemplate,
    onCloneTemplate,
    onImportTemplates,
    onExportTemplates,
  };
};
