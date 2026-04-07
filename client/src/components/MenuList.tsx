import clsx from "clsx";
import { forwardRef, type Ref } from "react";

type Props = {
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
};

const sizeStyles: Record<NonNullable<Props["size"]>, string> = {
  sm: "[&_li>button]:px-2 [&_li>button]:py-1 [&_li>button]:text-sm [&_li>a]:px-2 [&_li>a]:py-1 [&_li>a]:text-sm",
  md: "[&_li>button]:px-3 [&_li>button]:py-2 [&_li>a]:px-3 [&_li>a]:py-2",
};

export const MenuList = forwardRef(
  ({ size = "md", children, className }: Props, ref: Ref<HTMLUListElement>) => {
    return (
      <ul
        ref={ref}
        className={clsx(
          "flex flex-col",
          "[&_li>button]:w-full [&_li>button]:text-left [&_li>button]:rounded [&_li>button]:cursor-pointer [&_li>button]:transition-colors [&_li>button]:hover:bg-slate-100",
          "[&_li>button]:focus-visible:outline-none [&_li>button]:focus-visible:ring-2 [&_li>button]:focus-visible:ring-sky-500 [&_li>button]:focus-visible:ring-offset-2",
          "[&_li>a]:block [&_li>a]:rounded [&_li>a]:cursor-pointer [&_li>a]:transition-colors [&_li>a]:hover:bg-slate-100",
          "[&_li>a]:focus-visible:outline-none [&_li>a]:focus-visible:ring-2 [&_li>a]:focus-visible:ring-sky-500 [&_li>a]:focus-visible:ring-offset-2",
          sizeStyles[size],
          className,
        )}
      >
        {children}
      </ul>
    );
  },
);
