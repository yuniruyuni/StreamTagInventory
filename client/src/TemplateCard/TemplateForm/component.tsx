import clsx from "clsx";
import type React from "react";
import { CategorySelector } from "~/CategorySelector";
import { Input } from "~/components/Input";
import { InputTags, MAX_TAGS } from "~/InputTags";
import { useTranslation } from "~/i18n";
import type { Template } from "~/model/template";

type Props = {
  template: Template;
  onChange: (template: Template) => void;
};

export const TemplateForm: React.FC<Props> = ({ template, onChange }) => {
  const { t } = useTranslation();
  const tagCount = template.tags?.length ?? 0;
  const atLimit = tagCount >= MAX_TAGS;
  const titleId = `title-${template.id}`;
  const categoryId = `category-${template.id}`;
  const tagsId = `tags-${template.id}`;

  return (
    <>
      <label htmlFor={titleId}>{t("template.title")}</label>
      <Input
        id={titleId}
        name="title"
        type="text"
        className="w-full"
        onChange={(e) => onChange({ ...template, title: e.target.value })}
        value={template.title}
      />

      <label htmlFor={categoryId}>{t("template.category")}</label>
      <CategorySelector
        id={categoryId}
        value={template.category}
        onChange={(category) => onChange({ ...template, category })}
      />

      <div className="flex items-baseline justify-between">
        <label htmlFor={tagsId}>{t("template.tags")}</label>
        <span
          data-testid="tag-counter"
          className={clsx(
            "text-xs",
            atLimit ? "text-amber-600" : "text-slate-500",
          )}
        >
          {t("template.tagCount", {
            current: tagCount,
            max: MAX_TAGS,
          })}
        </span>
      </div>
      <InputTags
        id={tagsId}
        tags={template.tags ?? []}
        onChange={(tags) => onChange({ ...template, tags })}
      />
    </>
  );
};
