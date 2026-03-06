import clsx from "clsx";
import type React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export const Navbar: React.FC<Props> = ({ children, className }) => {
  return (
    <nav
      aria-label="main"
      className={clsx("navbar flex items-center px-4 py-2 min-h-16", className)}
    >
      {children}
    </nav>
  );
};
