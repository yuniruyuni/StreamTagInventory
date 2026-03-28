import clsx from "clsx";
import type React from "react";

type Props = {
  variant?: "primary" | "secondary" | "error" | "ghost" | "default";
  size?: "sm" | "md";
  shape?: "circle" | "default";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const variantStyles: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-blue-200 border-blue-300 text-blue-800 hover:bg-blue-300",
  secondary:
    "bg-violet-200 border-violet-300 text-violet-800 hover:bg-violet-300",
  error: "bg-red-200 border-red-300 text-red-800 hover:bg-red-300",
  ghost: "bg-transparent border-transparent hover:bg-slate-50",
  default: "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200",
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
        "inline-flex items-center justify-center font-semibold border rounded-lg transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2",
        variantStyles[variant],
        shape === "circle" ? "rounded-full p-0" : sizeStyles[size],
        className,
      )}
    />
  );
};
