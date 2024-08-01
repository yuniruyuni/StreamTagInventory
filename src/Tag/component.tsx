import clsx from 'clsx';
import type React from 'react';

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
    {onClose && (
      <button
        type="button"
        className={clsx(
          "inline-flex items-center",
          "rounded-sm",
          "p-1 ms-2",
          "text-sm",
          "text-blue-400 bg-transparent",
          "hover:bg-blue-200 hover:text-blue-900",
          "dark:hover:bg-blue-800 dark:hover:text-blue-300",
        )}
        data-dismiss-target="#badge-dismiss-default"
        aria-label="Remove"
        onClick={onClose}
      >
        <svg className="w-2 h-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
        </svg>
        <span className="sr-only">Remove tag</span>
      </button>
    )}
  </span>
);

