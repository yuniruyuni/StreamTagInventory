import React from "react";

type Props = {
  id?: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
};

export const TagInput = React.forwardRef<HTMLInputElement, Props>(
  ({ id, onKeyDown, onFocus, onBlur }, ref) => {
    return (
      <input
        id={id}
        ref={ref}
        type="text"
        // size=1 + min-w-[6ch] で input の intrinsic width を縮め、
        // flex item の min-width: auto による改行発生を回避する。
        // flex-grow で残り幅を埋めるので、十分なスペースがある行では広く表示される。
        size={1}
        className="flex-grow min-w-[6ch] border-0 mb-1 outline-none"
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    );
  },
);

TagInput.displayName = "TagInput";
