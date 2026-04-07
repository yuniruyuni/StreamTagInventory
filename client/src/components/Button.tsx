import clsx from "clsx";
import type React from "react";

type Props = {
  variant?: "primary" | "secondary" | "error" | "ghost" | "default";
  size?: "sm" | "md";
  shape?: "circle" | "default";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const variantStyles: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-sky-600 text-white hover:bg-sky-700",
  secondary: "bg-purple-600 text-white hover:bg-purple-700",
  error: "bg-red-600 text-white hover:bg-red-700",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900",
  default: "bg-slate-300 text-slate-900 hover:bg-slate-200",
};

const sizeStyles: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-2 py-1 text-sm",
  md: "px-4 py-2",
};

export const Button: React.FC<Props> = ({
  variant = "default",
  size = "md",
  shape = "default",
  className,
  ...rest
}) => {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center font-semibold rounded-lg transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
        variantStyles[variant],
        shape === "circle" ? "rounded-full p-0" : sizeStyles[size],
        className,
      )}
    />
  );
};
