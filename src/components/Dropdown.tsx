import clsx from "clsx";
import type React from "react";

type DropdownProps = {
  align?: "end" | "start";
  children: React.ReactNode;
  className?: string;
};

export const Dropdown: React.FC<DropdownProps> = ({
  align = "start",
  children,
  className,
}) => {
  return (
    <div
      className={clsx(
        "relative",
        align === "end" && "[&>:nth-child(2)]:right-0",
        className,
      )}
    >
      {children}
    </div>
  );
};

type DropdownContentProps = {
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">;

export const DropdownContent: React.FC<DropdownContentProps> = ({
  children,
  className,
  ...rest
}) => {
  return (
    <div
      {...rest}
      className={clsx(
        "dropdown-content absolute z-[1] hidden [*:focus-within>&]:block",
        className,
      )}
    >
      {children}
    </div>
  );
};
