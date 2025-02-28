import clsx from "clsx";
import React from "react";
import { TagInput } from "./TagInput";
import { TagList } from "./TagList";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

export const InputTags: React.FC<Props> = ({ tags, onChange }) => {
  const [active, setActive] = React.useState(false);

  function onClose(index: number) {
    const newTags = [...tags];
    newTags.splice(index, 1);
    onChange(newTags);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;

    const value = e.currentTarget.value;
    if (e.key === "Backspace" && !value.length && tags.length > 0) {
      onClose(tags.length - 1);
      return;
    }

    if (e.key !== "Enter" || !value.trim()) return;
    const newTags = [...tags, value];
    onChange(newTags);
    e.currentTarget.value = "";
    e.preventDefault();
  }

  return (
    <div
      className={clsx(
        "flex flex-wrap text-gray-700 border leading-tight pt-3 pb-2 px-4 rounded",
        active && "outline outline-slate-200",
      )}
    >
      <TagList tags={tags} onClose={onClose} />
      <TagInput
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};
