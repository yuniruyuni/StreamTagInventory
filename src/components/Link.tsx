import clsx from "clsx";
import type React from "react";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement>;

export const Link: React.FC<Props> = ({ className, ...rest }) => {
  return (
    <a
      {...rest}
      className={clsx(
        "underline hover:no-underline transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded",
        className,
      )}
    />
  );
};
