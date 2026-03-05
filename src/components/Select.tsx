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
        "rounded-lg transition-colors focus:outline-none focus:border-gray-500 cursor-pointer",
        sizeStyles[size],
        bordered && "border border-gray-300",
        className,
      )}
    />
  );
};
