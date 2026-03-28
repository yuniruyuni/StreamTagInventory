import clsx from "clsx";
import type React from "react";
import { RemoveButton } from "./RemoveButton";

type Props = {
  onRemove?: () => void;
  children: React.ReactNode;
};

export const Tag: React.FC<Props> = ({ onRemove, children }) => (
  <li
    className={clsx(
      "inline-flex items-center",
      "rounded",
      "px-2 py-1 me-2",
      "text-sm font-medium",
      "text-blue-800 bg-blue-100",
    )}
  >
    {children}
    {onRemove && <RemoveButton onClick={onRemove} />}
  </li>
);
