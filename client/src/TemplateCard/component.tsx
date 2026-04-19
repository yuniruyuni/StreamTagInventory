import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FC } from "react";
import React, { memo } from "react";
import { Card, CardBody } from "~/components/Card";
import { isTemplateEqual, type Template } from "~/model/template";

import { DragHandle } from "./DragHandle";
import { TemplateActions } from "./TemplateActions";
import { TemplateForm } from "./TemplateForm";

type Props = {
  template: Template;
  onApply: (template: Template) => void;
  onRemove: (template: Template) => void;
  onClone: (template: Template) => void;
  onSave: (template: Template) => void;
  userLogin?: string;
  postTemplate?: string;
};

// TODO: refine UI design.
export const TemplateCard: FC<Props> = memo(
  ({
    template,
    onRemove,
    onApply,
    onClone,
    onSave,
    userLogin,
    postTemplate,
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: template.id });

    // dnd-kit sets role="button" in attributes, which overrides <article>'s
    // implicit role. Destructure it out so the Card keeps role="article".
    const { role: _role, ...restAttributes } = attributes;

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const [temp, setTemp] = React.useState<Template>(template);
    const changed = !isTemplateEqual(template, temp);

    return (
      <Card
        data-testid={`template-card-${template.id}`}
        className="w-96 bg-white shadow-xl"
        ref={setNodeRef}
        {...restAttributes}
        style={style}
      >
        <CardBody>
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
            userLogin={userLogin}
            postTemplate={postTemplate}
          />
        </CardBody>
      </Card>
    );
  },
);
