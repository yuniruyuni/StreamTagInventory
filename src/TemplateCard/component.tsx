import React from "react";
import type { FC } from "react";
import { type Template, validateTemplate } from "~/model/template";

import { CCLSelector } from "~/CCLSelector";
import { CategorySelector } from "~/CategorySelector";
import { InputTags } from "~/InputTags";

type Props = {
  template: Template;
  onApply: (template: Template) => void;
  onRemove: (template: Template) => void;
  onClone: (template: Template) => void;
  onSave: (template: Template) => void;
};

// TODO: refine UI design.
export const TemplateCard: FC<Props> = ({ template, onRemove, onApply, onClone, onSave }) => {
  const [temp, setTemp] = React.useState<Template>(template);
  const changed = JSON.stringify(template) !== JSON.stringify(temp);
  const valid = validateTemplate(temp);

  return (
    <div className="card w-96 bg-base-100 shadow-xl">
      <div className="card-body">
        <label>Title</label>
        <input
          type="text"
          className="p-2 border border-slate-300 rounded"
          onChange={(e) => setTemp({ ...temp, title: e.target.value })}
          value={temp.title}
        />

        <label>Category</label>
        <CategorySelector value={temp.category} onChange={(category) => setTemp({ ...temp, category })} />

        <label>Tags</label>
        <InputTags tags={temp.tags} onChange={(tags) => setTemp({ ...temp, tags })} />

        <label>ContentClassificationLabels</label>
        <CCLSelector selections={temp.ccls} onChange={(ccls) => setTemp({ ...temp, ccls })} />

        <div className="card-actions justify-end">
          {
            changed && (<>
              <button type="button" className="btn btn-error" onClick={() => setTemp(template)}>Revert</button>
              <button type="button" className="btn btn-primary" onClick={() => onSave(temp)}>Save</button>
            </>)
          }
          {
            !changed && (<>
              <button type="button" className="btn btn-secondary" onClick={() => {
                onClone(template);
              }}>Clone</button>
              <button type="button" className="btn btn-error" onClick={() => {
                onRemove(template);
              }}>Remove</button>
              {!valid && <button type="button" className="btn btn-disabled">Apply</button>}
              {valid && <button type="button" className="btn btn-primary" onClick={() => {
                onApply(template);
              }}>Apply</button>}
            </>)
          }
        </div>
      </div>
    </div>
  );
};
