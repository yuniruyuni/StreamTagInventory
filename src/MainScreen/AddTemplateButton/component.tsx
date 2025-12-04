import type React from "react";
import { useTranslation } from "~/i18n";
import { newTemplate, type Template } from "~/model/template";

type Props = {
  onAdd: (template: Template) => void;
};

export const AddTemplateButton: React.FC<Props> = ({ onAdd }) => {
  const { t } = useTranslation();

  return (
    <div className="w-96 min-h-64 outline-dashed rounded outline-2 outline-slate-400 flex flex-col items-center place-content-center">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => onAdd(newTemplate())}
      >
        {t("template.addTemplate")}
      </button>
    </div>
  );
};
