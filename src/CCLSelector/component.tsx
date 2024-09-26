import clsx from "clsx";
import React from "react";
import type { FC } from "react";
import useSWR from "swr";
import { Tag } from "~/Tag";
import { TwitchAuthContext } from "~/TwitchAuth";
import { twitch } from "~/fetcher";
import type { CCL, CCLSelection } from '~/model/ccl';

export type Props = {
  selections?: CCLSelection[];
  onChange: (selections: CCLSelection[]) => void;
};

export const CCLSelector: FC<Props> = ({ selections, onChange }) => {
  const { token } = React.useContext(TwitchAuthContext);
  const [open, setOpen] = React.useState(false);
  const { data: ccls, isLoading } = useSWR(
    ["https://api.twitch.tv/helix/content_classification_labels?locale=ja", token],
    twitch.get<CCL[]>,
  );
  if( isLoading ) return <></>;

  return (
    <div
      className="h-8 relative rounded border border-1 border-slate-300"
      onClick={() => setOpen(true)}
      onKeyDown={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {
        ccls?.
          filter((ccl) => selections?.find((id) => id === ccl.id)).
          map((ccl) => (
            <Tag key={ccl.id}>{ccl.name}</Tag>
          ))
      }

      <div
        className={clsx(
          open ? "visible" : "invisible",
          "absolute top-0",
          "w-full h-fit",
          "border border-slate-300",
          "outline outline-slate-200",
          "bg-base-100",
          "rounded",
        )}
      >
        <ul
          className={clsx(
            "menu",
            "w-full max-h-80 py-0 p-2",
            "flex-nowrap overflow-auto",
          )}
        >
          {ccls?.map((ccl) => {
            const checked = selections?.find((s) => s === ccl.id) !== undefined;
            return (
              <li key={ccl.id}>
                <div
                  className="form-control flex flex-row"
                  onClick={() => {
                    const newSelection = [...(selections ?? [])];
                    const found = newSelection.indexOf(ccl.id);
                    if( found !== -1 ) newSelection.splice(found, 1);
                    if( !checked ) {
                      newSelection.push(ccl.id);
                    }
                    onChange(newSelection);
                  }}
                  onKeyDown={() => {
                    const newSelection = [...(selections ?? [])];
                    const found = newSelection.indexOf(ccl.id);
                    if( found !== -1 ) newSelection.splice(found, 1);
                    if( !checked ) {
                      newSelection.push(ccl.id);
                    }
                    onChange(newSelection);
                  }}
                >
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={checked}
                  />
                  <div className="flex flex-col">
                    <label>
                      <span className="label-text">{ccl.name}</span>
                    </label>
                    <span>{ccl.description}</span>
                  </div>
                </div>
              </li>
          );
          })}
        </ul>
      </div>
    </div>
  );
}
