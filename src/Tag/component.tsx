import type React from 'react';

type Props = {
  onClose?: () => void;
  children: React.ReactNode;
};

export const Tag: React.FC<Props> = ({ onClose, children }) => (
  <span className='font-medium rounded inline-flex items-center bg-green-500 text-white'>
    <span className='py-1 px-1 text-sm mr-1 mb-1'>{children}</span>
    {onClose && (
      <button
        type="button"
        className="inline-flex items-center border-l h-full w-hull cursor-pointer py-1 px-1 text-sm"
        onClick={onClose}
      >
        x
      </button>
    )}
  </span>
);
