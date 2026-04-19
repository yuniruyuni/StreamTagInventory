import { type FC, useCallback, useContext, useEffect, useState } from "react";
import { Button } from "~/components/Button";
import { Modal } from "~/components/Modal";
import { useTranslation } from "~/i18n";
import { useNotification } from "~/Notification";
import { TemplateDocContext } from "~/sync/TemplateDocContext";
import { usePostTemplate } from "~/sync/usePostTemplate";
import { useTemplates } from "~/sync/useTemplates";
import { type LegacyData, markMigrated, readLegacyData } from "./legacyStorage";

/**
 * 旧 localStorage に templates / postTemplate が残っているユーザーに、Y.Doc 経由
 * (= サーバ同期) への移行を促す Modal (PR 7 commit 4)。
 *
 * 動作:
 *  - mount 時 + isReady (IndexedDB ロード済) 時に `readLegacyData()` で legacy 検出
 *  - 既存 Y.Doc にテンプレートが既にあれば「マージ済」と判断して prompt 抑止
 *  - 承諾: bulkReplace + writePostTemplate → MIGRATED_AT_KEY を立てて prompt 終了
 *  - 拒否: 何もしない (MIGRATED_AT_KEY も立てないので次回再表示)
 *
 * ※ localStorage の旧データは削除しない (1 ヶ月の rollback 余地。cleanup は PR 8)。
 */
export const MigrationPrompt: FC = () => {
  const { t } = useTranslation();
  const { isReady } = useContext(TemplateDocContext);
  const { templates, bulkReplace } = useTemplates();
  const { setPostTemplate } = usePostTemplate();
  const { addNotification } = useNotification();
  const [legacy, setLegacy] = useState<LegacyData | null>(null);

  useEffect(() => {
    if (!isReady) return;
    // Y.Doc に既にテンプレートが入っているなら別端末から sync 済 → 移行不要。
    // `templates` は useTemplates が observe → state で遅れて入るため、length を
    // deps に入れて mount 直後 + 到達時の 2 フェーズで判定する必要がある。
    if (templates.length > 0) {
      setLegacy(null);
      return;
    }
    setLegacy(readLegacyData());
  }, [isReady, templates.length]);

  const hasPostTemplate =
    legacy !== null &&
    legacy.postTemplate !== null &&
    legacy.postTemplate !== "";

  const handleAccept = useCallback(() => {
    if (!legacy) return;
    bulkReplace(legacy.templates);
    if (hasPostTemplate && legacy.postTemplate) {
      setPostTemplate(legacy.postTemplate);
    }
    markMigrated();
    setLegacy(null);
    addNotification({
      type: "success",
      title: t("migration.successTitle"),
      message: t("migration.successMessage", {
        count: legacy.templates.length,
      }),
      autoClose: true,
    });
  }, [
    legacy,
    hasPostTemplate,
    bulkReplace,
    setPostTemplate,
    addNotification,
    t,
  ]);

  const handleDismiss = useCallback(() => {
    // 旧 data は残したまま「今は移行しない」。MIGRATED_AT_KEY は立てない。
    setLegacy(null);
  }, []);

  return (
    <Modal
      open={legacy !== null}
      onClose={handleDismiss}
      title={t("migration.title")}
    >
      <p className="mb-4 text-slate-700">{t("migration.description")}</p>
      {legacy && (
        <ul className="mb-4 text-sm text-slate-600 list-disc list-inside">
          <li>
            {t("migration.detectedTemplates", {
              count: legacy.templates.length,
            })}
          </li>
          {hasPostTemplate && <li>{t("migration.detectedPostTemplate")}</li>}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={handleDismiss}>
          {t("migration.later")}
        </Button>
        <Button variant="primary" onClick={handleAccept}>
          {t("migration.accept")}
        </Button>
      </div>
    </Modal>
  );
};
