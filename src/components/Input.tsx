import clsx from "clsx";
import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, Props>(
  ({ className, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        {...rest}
        className={clsx(
          "border border-gray-300 rounded-lg px-3 py-2 transition-colors focus:outline-none focus:border-gray-500",
          className,
        )}
      />
    );
  },
);
