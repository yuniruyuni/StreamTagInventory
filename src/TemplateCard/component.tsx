import type { FC } from "react";
import { Tag } from "~/Tag";
import type { Template } from "~/model/template";

type Props = {
  template: Template;
  onApply: (template: Template) => void;
  onRemove: (template: Template) => void;
  onClone: (template: Template) => void;
};

export const TemplateCard: FC<Props> = ({ template, onApply, onRemove, onClone }) => (
  <div className="card w-max-96 bg-base-100 shadow-xl">
    <div className="card-body">
      <h2 className="card-title">{template.title}</h2>
      <div className="flex flex-cols align-middle">
        <img className="h-fit w-16" alt={template.category.name} src={template.category.box_art_url} />
        <div className="flex-1">{template.category.name}</div>
      </div>
      {template.tags.map((tag) => (<Tag key={tag}>{tag}</Tag>))}
      <div className="card-actions justify-end">
        <button type="button" className="btn btn-error" onClick={() => {
          onRemove(template);
        }}>Remove</button>
        <button type="button" className="btn btn-primary" onClick={() => {
          onApply(template);
        }}>Apply</button>
        <button type="button" className="btn btn-secondary" onClick={() => {
          onClone(template);
        }}>Clone</button>
      </div>
    </div>
  </div>
);
