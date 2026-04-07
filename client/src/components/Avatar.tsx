import clsx from "clsx";
import type React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export const Avatar: React.FC<Props> = ({ children, className }) => {
  return (
    <div
      className={clsx(
        "avatar inline-flex relative align-middle",
        "[&>div]:block [&>div]:aspect-square [&>div]:overflow-hidden",
        "[&_img]:object-cover [&_img]:w-full [&_img]:h-full",
        className,
      )}
    >
      {children}
    </div>
  );
};
