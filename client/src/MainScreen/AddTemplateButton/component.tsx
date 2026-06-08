import type React from "react";
import { Button } from "~/components/Button";
import { useTranslation } from "~/i18n";
import { newTemplate, type Template } from "~/model/template";

type Props = {
  onAdd: (template: Template) => void;
};

export const AddTemplateButton: React.FC<Props> = ({ onAdd }) => {
  const { t } = useTranslation();

  return (
    <div
      data-testid="add-template-card"
      className="w-full max-w-96 min-h-64 outline-dashed rounded outline-2 outline-slate-300 flex flex-col items-center place-content-center"
    >
      <Button
        type="button"
        variant="primary"
        onClick={() => onAdd(newTemplate())}
      >
        {t("template.addTemplate")}
      </Button>
    </div>
  );
};
