import type React from "react";
import { CategorySelector } from "~/CategorySelector";
import { InputTags } from "~/InputTags";
import type { Template } from "~/model/template";

type Props = {
  template: Template;
  onChange: (template: Template) => void;
};

export const TemplateForm: React.FC<Props> = ({ template, onChange }) => {
  return (
    <>
      <label>Title</label>
      <input
        type="text"
        className="p-2 border border-slate-300 rounded"
        onChange={(e) => onChange({ ...template, title: e.target.value })}
        value={template.title}
      />

      <label>Category</label>
      <CategorySelector
        value={template.category}
        onChange={(category) => onChange({ ...template, category })}
      />

      <label>Tags</label>
      <InputTags
        tags={template.tags ?? []}
        onChange={(tags) => onChange({ ...template, tags })}
      />
    </>
  );
};
