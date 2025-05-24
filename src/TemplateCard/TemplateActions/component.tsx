import type React from "react";
import { useTranslation } from "~/i18n";
import { type Template, validateTemplate } from "~/model/template";

type Props = {
  template: Template;
  changed: boolean;
  onRevert: () => void;
  onSave: (template: Template) => void;
  onClone: (template: Template) => void;
  onRemove: (template: Template) => void;
  onApply: (template: Template) => void;
};

export const TemplateActions: React.FC<Props> = ({
  template,
  changed,
  onRevert,
  onSave,
  onClone,
  onRemove,
  onApply,
}) => {
  const { t } = useTranslation();
  const valid = validateTemplate(template);

  return (
    <div className="card-actions justify-end">
      {changed && (
        <>
          <button
            aria-label="revert template"
            type="button"
            className="btn btn-error"
            onClick={onRevert}
          >
            {t("common.revert")}
          </button>
          <button
            aria-label="save template"
            type="button"
            className="btn btn-primary"
            onClick={() => onSave(template)}
          >
            {t("common.save")}
          </button>
        </>
      )}
      {!changed && (
        <>
          <button
            aria-label="clone template"
            type="button"
            className="btn btn-secondary"
            onClick={() => onClone(template)}
          >
            {t("common.clone")}
          </button>
          <button
            aria-label="remove template"
            type="button"
            className="btn btn-error"
            onClick={() => onRemove(template)}
          >
            {t("common.delete")}
          </button>
          {!valid && (
            <button
              aria-label="apply template"
              type="button"
              className="btn"
              disabled
            >
              {t("common.apply")}
            </button>
          )}
          {valid && (
            <button
              aria-label="apply template"
              type="button"
              className="btn btn-primary"
              onClick={() => onApply(template)}
            >
              {t("common.apply")}
            </button>
          )}
        </>
      )}
    </div>
  );
};
