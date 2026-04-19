import { useCallback, useContext } from "react";
import useSWRMutation from "swr/mutation";
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
  onApplyTemplate: (template: Template) => Promise<void>;
  onImportTemplates: () => void;
  onExportTemplates: () => void;
};

/**
 * Twitch API 呼出 (channel 適用 + stream marker) と import/export を束ねる hook。
 *
 * テンプレート CRUD (add / update / remove / move) は `useTemplates()` を呼出側で
 * 直接使う。旧 useTemplateOperations は薄い passthrough が大半だったため、
 * 本 hook を Twitch 依存操作と I/O 操作に絞って整理した (PR 7 review)。
 *
 * export だけ `templates` を読み取るのでここで `useTemplates()` を再度呼んでいる。
 * 追加の observer が立つが、refresh は React の batching で同居の観測と共に
 * 処理されるので実コスト差はほぼ無し。
 */
export const useTemplateOperations = ({
  users,
}: UseTemplateOperationsProps): UseTemplateOperationsResult => {
  const { i18n, t } = useTranslation();
  const { token } = useContext(TwitchAuthContext);
  const { addNotification } = useNotification();
  const { templates, bulkReplace } = useTemplates();

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

  const onExportTemplates = useCallback(() => {
    exportTemplates(templates);
  }, [templates]);

  const onImportTemplates = useCallback(async () => {
    try {
      const imported = await importTemplates();
      // 既存 id と被らない分だけ append する。bulkReplace で「既存 + 新規」を
      // 1 op にまとめて echo / server sync を 1 回に絞る。
      const existingIds = new Set(templates.map((t) => t.id));
      const newOnes = imported.filter((t) => !existingIds.has(t.id));
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
          error: (error as Error).message,
        }),
        autoClose: true,
      });
    }
  }, [templates, bulkReplace, addNotification, t]);

  return {
    onApplyTemplate,
    onImportTemplates,
    onExportTemplates,
  };
};
