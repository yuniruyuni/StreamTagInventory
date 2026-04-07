import type React from "react";
import { CategorySelector } from "~/CategorySelector";
import { Input } from "~/components/Input";
import { InputTags } from "~/InputTags";
import { useTranslation } from "~/i18n";
import type { Template } from "~/model/template";

type Props = {
  template: Template;
  onChange: (template: Template) => void;
};

export const TemplateForm: React.FC<Props> = ({ template, onChange }) => {
  const { t } = useTranslation();

  return (
    <>
      <label htmlFor="title">{t("template.title")}</label>
      <Input
        id="title"
        name="title"
        type="text"
        className="w-full"
        onChange={(e) => onChange({ ...template, title: e.target.value })}
        value={template.title}
      />

      <label htmlFor="category">{t("template.category")}</label>
      <CategorySelector
        value={template.category}
        onChange={(category) => onChange({ ...template, category })}
      />

      <label htmlFor="tags">{t("template.tags")}</label>
      <InputTags
        tags={template.tags ?? []}
        onChange={(tags) => onChange({ ...template, tags })}
      />
    </>
  );
};
