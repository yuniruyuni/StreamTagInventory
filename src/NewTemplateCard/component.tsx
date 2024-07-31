import React from "react";
import type { FC } from "react";
import type { Template } from "~/model/template";

import { CategorySelector } from "~/CategorySelector";
import { InputTags } from "~/InputTags";

type Props = {
  onAdd: (template: Template) => void;
};

function validateTemplate(template: Partial<Template>): template is Template {
  return template.title !== undefined && template.category !== undefined && template.tags !== undefined;
}


// TODO: refine UI design.
export const NewTemplateCard: FC<Props> = ({ onAdd }) => {
  const [template, setTemplate] = React.useState<Partial<Template>>({});

  return (
    <div className="card w-96 bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">New Template</h2>
        Title <input type="text" onChange={(e) => setTemplate({ ...template, title: e.target.value })} className="border border-slate-300 rounded" />
        Category
        <CategorySelector value={template.category} onChange={(category) => setTemplate({ ...template, category })} />
        Tags <InputTags tags={template.tags ?? []} onChange={(tags) => setTemplate({ ...template, tags })} />

        <div className="card-actions justify-end">
          <button type="button" className="btn btn-primary" onClick={() => {
            if( !validateTemplate(template) ) return;
            onAdd(template);
          }}>Add</button>
        </div>
      </div>
    </div>
  );
};
