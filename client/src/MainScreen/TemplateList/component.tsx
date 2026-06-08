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
import type { Template } from "~/model/template";
import { TemplateCard } from "~/TemplateCard";

type Props = {
  templates: Template[];
  onMove: (sourceId: string, destinationId: string) => void;
  onApply: (template: Template) => void;
  onRemove: (template: Template) => void;
  onClone: (template: Template) => void;
  onSave: (template: Template) => void;
  userLogin?: string;
  postTemplate?: string;
};

export const TemplateList: React.FC<Props> = ({
  templates,
  onMove,
  onApply,
  onRemove,
  onClone,
  onSave,
  userLogin,
  postTemplate,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      onMove(active.id.toString(), over.id.toString());
    }
  };

  const handleKeyboardMove = (templateId: string, direction: -1 | 1) => {
    const sourceIndex = templates.findIndex(({ id }) => id === templateId);
    if (sourceIndex < 0) return;
    const destinationIndex = sourceIndex + direction;
    if (destinationIndex < 0 || destinationIndex >= templates.length) return;
    onMove(templateId, templates[destinationIndex].id);
  };

  return (
    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
      <SortableContext items={templates}>
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onApply={onApply}
            onRemove={onRemove}
            onClone={onClone}
            onSave={onSave}
            onKeyboardMove={handleKeyboardMove}
            userLogin={userLogin}
            postTemplate={postTemplate}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
};
