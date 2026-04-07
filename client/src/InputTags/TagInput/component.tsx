import React from "react";

type Props = {
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
};

export const TagInput = React.forwardRef<HTMLInputElement, Props>(
  ({ onKeyDown, onFocus, onBlur }, ref) => {
    return (
      <input
        ref={ref}
        type="text"
        className="flex-grow border-0 mb-1 outline-none"
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    );
  },
);

TagInput.displayName = "TagInput";
