import clsx from "clsx";
import type React from "react";

type Props = {
  variant?: "primary" | "secondary" | "error" | "ghost" | "default";
  size?: "sm" | "md";
  shape?: "circle" | "default";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const variantStyles: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "bg-primary border-primary-border text-on-primary hover:bg-primary-hover",
  secondary:
    "bg-secondary border-secondary-border text-on-secondary hover:bg-secondary-hover",
  error: "bg-error border-error-border text-on-error hover:bg-error-hover",
  ghost: "bg-transparent border-transparent hover:bg-hover-bg",
  default:
    "bg-neutral border-neutral-border text-on-neutral hover:bg-neutral-hover",
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
        variantStyles[variant],
        shape === "circle" ? "rounded-full p-0" : sizeStyles[size],
        className,
      )}
    />
  );
};
