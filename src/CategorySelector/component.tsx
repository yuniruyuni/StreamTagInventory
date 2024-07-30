import clsx from "clsx";
import React, { type FC } from "react";
import useSWR from "swr";

import { TwitchAuthContext } from "~/TwitchAuth";
import { twitch } from "~/fetcher";
import type { Category } from "~/model/category";

type Props = {
  value?: Category;
  onChange: (category?: Category) => void;
};

export const CategorySelector: FC<Props> = ({ value, onChange }) => {
  const token = React.useContext(TwitchAuthContext);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);

  const ref = React.useRef<HTMLUListElement>(null);

  const { data } = useSWR(
    [`https://api.twitch.tv/helix/search/categories?query=${query}`, token],
    twitch.get,
    {
      onSuccess: ({ data: categories }: { data: Category[] }) => {
        setCursor(0);

        const foundIndex = categories.findIndex((item) => item.name === query);
        if (foundIndex === -1) return;
        const found = categories[foundIndex];
        setCursor(foundIndex);
        onChange(found);
      },
    },
  );
  const categories: Category[] = data?.data ?? [];

  const moveCursor = React.useCallback(
    (diff: number) => {
      if (categories.length === 0) {
        setCursor(0);
        return;
      }

      let next = cursor;
      next += diff;
      next %= categories.length;
      if (next < 0) next = categories.length + next;
      setCursor(next);

      ref.current?.children[next]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    },
    [cursor, categories],
  );

  return (
    <div className="dropdown relative">
      <label htmlFor="text" className="relative w-full h-24">
        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
          {value && <img src={value.box_art_url} alt={value.name} />}
        </div>

        <input
          type="text"
          placeholder="Pick a category"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery(value?.name ?? "");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            const found = categories.find(
              (item) => item.name === e.target.value,
            );
            if (!found) return;
            onChange(found);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;

            setOpen(true);

            if (e.key === "ArrowUp") {
              moveCursor(-1);
              return;
            }

            if (e.key === "ArrowDown") {
              moveCursor(+1);
              return;
            }

            if (e.key === "Tab") {
              e.preventDefault();

              if (categories.length === 0) return;

              const index = categories.findIndex((item) =>
                item.name.startsWith(query),
              );
              const next = (index + 1) % categories.length;
              const selected = categories[next];

              onChange(selected);
              setQuery(selected.name);

              return;
            }

            if (e.key === "Enter") {
              e.preventDefault();
              const current = categories[cursor];
              if (!current) return;
              if (current !== value) onChange(current);
              setQuery(current.name);
              setOpen(false);
              return;
            }
          }}
          className={clsx(
            "w-full h-24 ps-24",
            "input input-bordered form-input",
            "focus:outline-none",
            open && "border-b-0 rounded-b-none",
          )}
        />
      </label>

      <div
        className={clsx(
          open ? "visible" : "invisible",
          "absolute top-0",
          "w-full h-fit -z-10",
          "border border-slate-300",
          "outline outline-slate-200",
          "bg-base-100",
          "rounded",
        )}
      >
        <ul
          ref={ref}
          className={clsx(
            "menu",
            "mt-24",
            "w-full max-h-80 py-0 p-2 -z-10",
            "flex-nowrap overflow-auto",
          )}
        >
          {categories.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={clsx(index === cursor && "bg-slate-100")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(item.name);
                  setOpen(false);
                  onChange(item);
                }}
                onMouseEnter={() => setCursor(index)}
              >
                <img src={item.box_art_url} alt={item.name} />
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
