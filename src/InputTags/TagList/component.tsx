import type React from "react";
import { Tag } from "~/Tag";

type Props = {
  tags: string[];
  onClose: (index: number) => void;
};

export const TagList: React.FC<Props> = ({ tags, onClose }) => {
  return (
    <>
      {tags.map((tag, i) => (
        <Tag key={tag} onClose={() => onClose(i)}>
          {tag}
        </Tag>
      ))}
    </>
  );
};
