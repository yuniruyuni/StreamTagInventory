import type React from "react";
import { useTranslation } from "~/i18n";
import { type Template, newTemplate } from "~/model/template";

type Props = {
  templates: Template[];
  setTemplates: (templates: Template[]) => void;
};

export const AddTemplateButton: React.FC<Props> = ({
  templates,
  setTemplates,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-96 min-h-64 outline-dashed rounded outline-2 outline-slate-400 flex flex-col items-center place-content-center">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setTemplates([...templates, newTemplate()])}
      >
        {t("template.addTemplate")}
      </button>
    </div>
  );
};
