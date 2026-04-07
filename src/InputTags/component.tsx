import clsx from "clsx";
import React from "react";
import { useTranslation } from "~/i18n";
import { TagInput } from "./TagInput";
import { TagList } from "./TagList";

export const MAX_TAGS = 10;

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
  if (tags.length >= MAX_TAGS) return;
  const newTags = [...tags, value.trim()];
  onChange(newTags);
  e.currentTarget.value = "";
  e.preventDefault();
}

export const InputTags: React.FC<Props> = ({ tags, onChange }) => {
  const [active, setActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const atLimit = tags.length >= MAX_TAGS;
  const nearLimit = tags.length >= MAX_TAGS - 2;

  function onRemove(index: number) {
    const newTags = [...tags];
    newTags.splice(index, 1);
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
    <div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: クリックはフォーカスを移動するだけなのでキーボードイベントは不要 */}
      <fieldset
        className={clsx(
          "flex flex-wrap border rounded leading-tight pt-3 pb-2 px-4 transition-all cursor-text",
          atLimit
            ? "border-error"
            : active
              ? "border-on-surface"
              : "border-on-surface/20",
        )}
        onClick={handleFieldsetClick}
      >
        <TagList tags={tags} onRemove={onRemove} />
        {!atLimit && (
          <TagInput
            ref={inputRef}
            onFocus={() => setActive(true)}
            onBlur={() => setActive(false)}
            onKeyDown={handleKeyDown}
          />
        )}
      </fieldset>
      <div
        className={clsx(
          "text-xs mt-1 text-right",
          atLimit
            ? "text-error"
            : nearLimit
              ? "text-warning"
              : "text-text-muted",
        )}
      >
        <span data-testid="tag-counter">
          {t("template.tagCount", {
            current: tags.length,
            max: MAX_TAGS,
          })}
        </span>
        {atLimit && <span className="ml-2">{t("template.maxTagsError")}</span>}
      </div>
    </div>
  );
};
