import clsx from "clsx";
import React from "react";
import { TagInput } from "./TagInput";
import { TagList } from "./TagList";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

// テスト用にエクスポート
export function handleTagKeyDown(
  e:
    | React.KeyboardEvent<HTMLInputElement>
    | {
        key: string;
        currentTarget: { value: string };
        preventDefault: () => void;
        nativeEvent: { isComposing: boolean };
      },
  tags: string[],
  onChange: (tags: string[]) => void,
) {
  if (e.nativeEvent.isComposing) return;

  const value = e.currentTarget.value;
  if (e.key === "Backspace" && !value.length && tags.length > 0) {
    const newTags = [...tags];
    newTags.splice(tags.length - 1, 1);
    onChange(newTags);
    return;
  }

  if (e.key !== "Enter" || !value.trim()) return;
  const newTags = [...tags, value.trim()];
  onChange(newTags);
  e.currentTarget.value = "";
  e.preventDefault();
}

export const InputTags: React.FC<Props> = ({ tags, onChange }) => {
  const [active, setActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function onRemove(index: number) {
    const newTags = [...tags];
    newTags.splice(index, 1);
    onChange(newTags);
  }

  function onEdit(index: number, newValue: string) {
    const newTags = [...tags];
    newTags[index] = newValue;
    onChange(newTags);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    handleTagKeyDown(e, tags, onChange);
  }

  function handleFieldsetClick(e: React.MouseEvent<HTMLFieldSetElement>) {
    // フィールドセット内のクリックでinputにフォーカスを当てる
    // ただし、タグやボタンをクリックした場合は除外
    const target = e.target as HTMLElement;
    if (
      target.tagName !== "INPUT" &&
      !target.closest("li") &&
      !target.closest("button")
    ) {
      inputRef.current?.focus();
    }
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: クリックはフォーカスを移動するだけなのでキーボードイベントは不要
    <fieldset
      className={clsx(
        "flex flex-wrap border rounded leading-tight pt-3 pb-2 px-4 transition-all cursor-text",
        active ? "border-slate-900" : "border-slate-900/20",
      )}
      onClick={handleFieldsetClick}
    >
      <TagList tags={tags} onRemove={onRemove} onEdit={onEdit} />
      <TagInput
        ref={inputRef}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        onKeyDown={handleKeyDown}
      />
    </fieldset>
  );
};
