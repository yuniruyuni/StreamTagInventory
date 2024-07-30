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

export const CategorySelector: FC<Props> = ({value, onChange}) => {
    const token = React.useContext(TwitchAuthContext);
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");

    const { data, isLoading } = useSWR([`https://api.twitch.tv/helix/search/categories?query=${query}`, token], twitch.get);
    const categories: Category[] = data?.data ?? [];

    return (
        <div>
            <div className="dropdown w-full">
                <label htmlFor="text" className="relative text-gray-400 focus-within:text-gray-600 block w-full h-32">
                    {value && (<span className="pointer-events-none w-8 h-8 absolute top-1/2 transform -translate-y-1/2 left-3">
                        <img src={value.box_art_url} alt={value.name} />
                    </span>)}
                    {isLoading && <span className="loading loading-spinner loading-sm" />}
                    <input
                        type="text"
                        className="input input-bordered form-input w-full h-full"
                        placeholder="Pick a category"
                        value={query}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </label>
                <ul className={
                    clsx(
                        "dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 max-h-80 flex-nowrap overflow-auto",
                        open && categories.length !== 0 ? "visible" : "invisible",
                    )
                }>
                    {categories.map((item) => (
                        <li key={item.id}>
                            <button type="button" onClick={(e) => {
                                e.preventDefault();
                                onChange(item);
                                setQuery(item.name);
                            }}>
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