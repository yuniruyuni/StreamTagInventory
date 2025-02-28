import type React from "react";
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
  const valid = validateTemplate(template);

  return (
    <div className="card-actions justify-end">
      {changed && (
        <>
          <button type="button" className="btn btn-error" onClick={onRevert}>
            Revert
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave(template)}
          >
            Save
          </button>
        </>
      )}
      {!changed && (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onClone(template)}
          >
            Clone
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={() => onRemove(template)}
          >
            Remove
          </button>
          {!valid && (
            <button type="button" className="btn btn-disabled">
              Apply
            </button>
          )}
          {valid && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onApply(template)}
            >
              Apply
            </button>
          )}
        </>
      )}
    </div>
  );
};
