import clsx from "clsx";
import type React from "react";
import { CloseButton } from "./CloseButton";

type Props = {
  onClose?: () => void;
  children: React.ReactNode;
};

export const Tag: React.FC<Props> = ({ onClose, children }) => (
  <span
    id="badge-dismiss-default"
    className={clsx(
      "inline-flex items-center",
      "rounded",
      "px-2 py-1 me-2",
      "text-sm font-medium",
      "text-blue-800 bg-blue-100",
      "dark:bg-blue-900 dark:text-blue-300",
    )}
  >
    {children}
    {onClose && <CloseButton onClick={onClose} />}
  </span>
);
