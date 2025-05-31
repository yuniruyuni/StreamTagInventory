import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React, { memo } from "react";
import type { FC } from "react";
import type { Template } from "~/model/template";

import { DragHandle } from "./DragHandle";
import { TemplateActions } from "./TemplateActions";
import { TemplateForm } from "./TemplateForm";

type Props = {
  template: Template;
  onApply: (template: Template) => void;
  onRemove: (template: Template) => void;
  onClone: (template: Template) => void;
  onSave: (template: Template) => void;
};

// TODO: refine UI design.
export const TemplateCard: FC<Props> = memo(
  ({ template, onRemove, onApply, onClone, onSave }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: template.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const [temp, setTemp] = React.useState<Template>(template);
    const changed = JSON.stringify(template) !== JSON.stringify(temp);

    return (
      <div
        data-testid={`template-card-${template.id}`}
        className="card w-96 bg-base-100 shadow-xl"
        ref={setNodeRef}
        {...attributes}
        style={style}
      >
        <div className="card-body">
          <DragHandle listeners={listeners} />

          <TemplateForm template={temp} onChange={setTemp} />

          <TemplateActions
            template={temp}
            changed={changed}
            onRevert={() => setTemp(template)}
            onSave={() => onSave(temp)}
            onClone={onClone}
            onRemove={onRemove}
            onApply={onApply}
          />
        </div>
      </div>
    );
  },
);
