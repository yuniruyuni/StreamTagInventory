import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "~/components/Button";
import { Modal } from "~/components/Modal";
import { Textarea } from "~/components/Textarea";
import { useTranslation } from "~/i18n";
import { DEFAULT_POST_TEMPLATE, formatPostText } from "~/utils/postTemplate";

type Props = {
  open: boolean;
  postTemplate: string;
  onSave: (template: string) => void;
  onClose: () => void;
};

const SAMPLE_PARAMS = {
  title: "Sample Stream Title",
  category: "Apex Legends",
  tags: ["FPS", "Ranked", "Stream"],
  url: "https://twitch.tv/username",
};

export const PostTemplateEditor: React.FC<Props> = ({
  open,
  postTemplate,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(postTemplate);

  useEffect(() => {
    if (open) {
      setDraft(postTemplate);
    }
  }, [open, postTemplate]);

  const preview = formatPostText(draft, SAMPLE_PARAMS);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_POST_TEMPLATE);
  };

  const handleClose = () => {
    setDraft(postTemplate);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={t("settings.postTemplate")}>
      <p className="text-sm text-slate-400 mb-2">
        {t("settings.postTemplateDescription")}
      </p>
      <p className="text-xs text-slate-400 mb-4 font-mono">
        {t("settings.postTemplatePlaceholders")}
      </p>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full h-32 mb-4 font-mono text-sm"
        aria-label={t("settings.postTemplate")}
      />

      <div className="mb-4">
        <p className="text-sm font-medium mb-1">{t("settings.preview")}</p>
        <pre className="bg-slate-100 rounded-lg p-3 text-sm whitespace-pre-wrap break-words">
          {preview}
        </pre>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={handleReset}>
          {t("settings.resetToDefault")}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSave}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
