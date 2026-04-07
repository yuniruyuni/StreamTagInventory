import type React from "react";
import { Tag } from "~/Tag";

type Props = {
  tags: string[];
  onRemove: (index: number) => void;
};

export const TagList: React.FC<Props> = ({ tags, onRemove }) => {
  return (
    <ul>
      {tags.map((tag, i) => (
        <Tag key={tag} onRemove={() => onRemove(i)}>
          {tag}
        </Tag>
      ))}
    </ul>
  );
};
