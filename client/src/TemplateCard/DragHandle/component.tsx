import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type React from "react";

type Props = {
  listeners: SyntheticListenerMap | undefined;
};

export const DragHandle: React.FC<Props> = ({ listeners }) => (
  <button
    {...listeners}
    className="absolute top-0 right-0 p-4 cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded"
  >
    <svg viewBox="0 0 20 20" width="20">
      <title>drag handle</title>
      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z">
        drag
      </path>
    </svg>
  </button>
);
