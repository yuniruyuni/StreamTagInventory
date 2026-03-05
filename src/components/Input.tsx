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
          "border border-border rounded-lg px-3 py-2 transition-colors focus:outline-none focus:border-border-focus",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
          className,
        )}
      />
    );
  },
);
