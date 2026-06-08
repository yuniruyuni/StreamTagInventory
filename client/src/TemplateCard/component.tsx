import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FC } from "react";
import React, { memo, useEffect, useRef } from "react";
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
  onKeyboardMove?: (templateId: string, direction: -1 | 1) => void;
  userLogin?: string;
  postTemplate?: string;
};

export const TemplateCard: FC<Props> = memo(
  ({
    template,
    onRemove,
    onApply,
    onClone,
    onSave,
    onKeyboardMove,
    userLogin,
    postTemplate,
  }) => {
    const {
      attributes,
      listeners,
      setActivatorNodeRef,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: template.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const [temp, setTemp] = React.useState<Template>(template);
    const previousTemplateRef = useRef(template);
    useEffect(() => {
      const previousTemplate = previousTemplateRef.current;
      previousTemplateRef.current = template;
      setTemp((current) =>
        isTemplateEqual(previousTemplate, current) ? template : current,
      );
    }, [template]);
    const changed = !isTemplateEqual(template, temp);

    return (
      <Card
        data-testid={`template-card-${template.id}`}
        className="w-full max-w-96 bg-white shadow-xl shadow-slate-200/70 ring-1 ring-slate-200/80"
        ref={setNodeRef}
        style={style}
      >
        <CardBody className="gap-4">
          <DragHandle
            attributes={attributes}
            listeners={listeners}
            onKeyboardMove={(direction) =>
              onKeyboardMove?.(template.id, direction)
            }
            setActivatorNodeRef={setActivatorNodeRef}
          />

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
