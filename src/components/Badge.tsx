import clsx from "clsx";
import type React from "react";

type Props = {
  size?: "sm" | "md";
  variant?: "outline" | "default";
  children: React.ReactNode;
  className?: string;
};

const sizeStyles: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2.5 py-0.5",
};

export const Badge: React.FC<Props> = ({
  size = "md",
  variant = "default",
  className,
  children,
}) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium",
        sizeStyles[size],
        variant === "outline"
          ? "border border-current bg-transparent"
          : "bg-gray-100 text-gray-800",
        className,
      )}
    >
      {children}
    </span>
  );
};
