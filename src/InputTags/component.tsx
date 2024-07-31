import clsx from 'clsx';
import React from 'react';

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

type BadgeProps = {
  onClose: () => void;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ onClose, children }) => {
  return (
    <span className='font-medium rounded inline-flex items-center bg-green-500 text-white'>
      <span className='py-1 px-1 text-sm mr-1 mb-1'>{children}</span>
      <button
        type="button"
        className="inline-flex items-center border-l h-full w-hull cursor-pointer py-1 px-1 text-sm"
        onClick={onClose}
      >
        x
      </button>
    </span>
  );
}

export const InputTags: React.FC<Props> = ({ tags, onChange }) => {
  const [active, setActive] = React.useState(false);

  function onClose(index: number) {
    const newTags = [...tags];
    newTags.splice(index, 1);
    onChange(newTags);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return

    const value = e.currentTarget.value
    if (e.key === 'Backspace' && !value.length && tags.length > 0) {
      onClose(tags.length - 1)
      return
    }

    if (e.key !== 'Enter' || !value.trim()) return
    const newTags = [...tags, value]
    onChange(newTags)
    e.currentTarget.value = ''
    e.preventDefault()
  }

  return (
    <div
      className={clsx(
        'flex flex-wrap text-gray-700 border leading-tight pt-3 pb-2 px-4 rounded',
        active && 'outline outline-slate-200',
      )}
    >
      {tags.map((tag, i) => {
        return (
          <Badge key={tag} onClose={() => onClose(i)}>
            {tag}
          </Badge>
        )
      })}
      <input
        type="text"
        className="flex-grow border-0 mb-1 outline-none"
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
