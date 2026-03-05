import type React from "react";
import { Button } from "~/components/Button";
import { CardActions } from "~/components/Card";
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
    <CardActions className="justify-end">
      {changed && (
        <>
          <Button
            aria-label="revert template"
            type="button"
            variant="error"
            onClick={onRevert}
          >
            {t("common.revert")}
          </Button>
          <Button
            aria-label="save template"
            type="button"
            variant="primary"
            onClick={() => onSave(template)}
          >
            {t("common.save")}
          </Button>
        </>
      )}
      {!changed && (
        <>
          <Button
            aria-label="clone template"
            type="button"
            variant="secondary"
            onClick={() => onClone(template)}
          >
            {t("common.clone")}
          </Button>
          <Button
            aria-label="remove template"
            type="button"
            variant="error"
            onClick={() => onRemove(template)}
          >
            {t("common.delete")}
          </Button>
          {!valid && (
            <Button aria-label="apply template" type="button" disabled>
              {t("common.apply")}
            </Button>
          )}
          {valid && (
            <Button
              aria-label="apply template"
              type="button"
              variant="primary"
              onClick={() => onApply(template)}
            >
              {t("common.apply")}
            </Button>
          )}
        </>
      )}
    </CardActions>
  );
};
