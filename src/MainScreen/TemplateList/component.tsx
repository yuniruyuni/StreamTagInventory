import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type React from "react";
import { TemplateCard } from "~/TemplateCard";
import type { Template } from "~/model/template";

type Props = {
  templates: Template[];
  onDragEnd: (event: DragEndEvent) => void;
  onApply: (template: Template) => void;
  onRemove: (template: Template) => void;
  onClone: (template: Template) => void;
  onSave: (template: Template) => void;
};

export const TemplateList: React.FC<Props> = ({
  templates,
  onDragEnd,
  onApply,
  onRemove,
  onClone,
  onSave,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext onDragEnd={onDragEnd} sensors={sensors}>
      <SortableContext items={templates}>
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onApply={onApply}
            onRemove={onRemove}
            onClone={onClone}
            onSave={onSave}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
};
