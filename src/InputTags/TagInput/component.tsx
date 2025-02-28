import type React from "react";

type Props = {
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
};

export const TagInput: React.FC<Props> = ({ onKeyDown, onFocus, onBlur }) => {
  return (
    <input
      type="text"
      className="flex-grow border-0 mb-1 outline-none"
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
};
