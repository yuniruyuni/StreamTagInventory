import clsx from "clsx";
import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RemoveButton } from "./RemoveButton";

type Props = {
  value: string;
  onEdit?: (newValue: string) => void;
  onRemove?: () => void;
};

export const Tag: React.FC<Props> = ({ value, onEdit, onRemove }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);

  // value が親から変わった場合に draft を同期
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // 編集モードに入ったら自動フォーカス・全選択
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // draft 変更に合わせて input 幅を sizer の実測値に追従させる
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft は sizer の DOM 更新を経由して offsetWidth に反映されるため、明示的に依存に含める必要がある
  useLayoutEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    const sizer = sizerRef.current;
    if (!input || !sizer) return;
    input.style.width = `${sizer.offsetWidth}px`;
  }, [draft, editing]);

  const startEdit = () => {
    if (!onEdit) return;
    setDraft(value);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(value);
    setEditing(false);
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onEdit?.(trimmed);
    }
    setEditing(false);
  };

  const liClassName = clsx(
    "inline-flex items-center",
    "rounded",
    "px-2 py-1 me-2",
    "text-sm font-medium",
    "text-sky-700 bg-sky-100",
    onEdit && !editing && "hover:bg-sky-200 transition-colors",
  );

  if (editing) {
    return (
      <li className={liClassName}>
        {/* hidden sizer: 親 li のフォント継承で描画幅を計算する */}
        <span
          ref={sizerRef}
          aria-hidden="true"
          className="absolute -z-10 invisible whitespace-pre pointer-events-none"
        >
          {draft || "\u00A0"}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={commitEdit}
          // font: inherit で親 li の text-sm/font-medium/font-family を継承し、
          // sizer span とピクセル単位で一致させる (ブラウザデフォルトの input フォント回避)
          style={{ font: "inherit" }}
          className="min-w-[2ch] bg-transparent border-0 outline-none p-0 m-0 text-sky-700"
          aria-label="edit tag"
        />
      </li>
    );
  }

  return (
    <li className={liClassName}>
      {onEdit ? (
        <button
          type="button"
          onClick={startEdit}
          className="bg-transparent border-0 p-0 m-0 text-sm font-medium text-sky-700 cursor-pointer"
          aria-label={`edit tag ${value}`}
        >
          {value}
        </button>
      ) : (
        value
      )}
      {onRemove && <RemoveButton onClick={onRemove} />}
    </li>
  );
};
