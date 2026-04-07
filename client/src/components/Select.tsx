import clsx from "clsx";
import type React from "react";

type Props = {
  size?: "sm" | "md";
  bordered?: boolean;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">;

const sizeStyles: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-8 px-2 text-xs",
  md: "h-10 px-3 text-sm",
};

export const Select: React.FC<Props> = ({
  size = "md",
  bordered = false,
  className,
  ...rest
}) => {
  return (
    <select
      {...rest}
      className={clsx(
        "rounded-lg transition-colors focus:outline-none focus:border-slate-500 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
        sizeStyles[size],
        bordered && "border border-slate-200",
        className,
      )}
    />
  );
};
