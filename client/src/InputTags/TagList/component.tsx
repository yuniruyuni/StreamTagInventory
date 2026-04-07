import type React from "react";
import { Tag } from "~/Tag";

type Props = {
  tags: string[];
  onRemove: (index: number) => void;
  onEdit: (index: number, newValue: string) => void;
};

export const TagList: React.FC<Props> = ({ tags, onRemove, onEdit }) => {
  return (
    // display: contents により ul 自体をレイアウトから外し、
    // 子 li が親 fieldset の flex item として直接扱われるようにする
    // (TagInput と同じ行に flow して右側スペースを有効活用する)
    <ul className="contents">
      {tags.map((tag, i) => (
        <Tag
          // biome-ignore lint/suspicious/noArrayIndexKey: tags are plain strings without unique IDs; using index preserves component identity during edit
          key={i}
          value={tag}
          onRemove={() => onRemove(i)}
          onEdit={(newValue) => onEdit(i, newValue)}
        />
      ))}
    </ul>
  );
};
