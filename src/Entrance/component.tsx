import type React from "react";

type Props = {
  uri: string;
};

export const Entrance: React.FC<Props> = ({ uri }) => (
  <div className="h-screen w-screen flex flex-col items-center justify-center">
    <h1 className="text-4xl">Stream Tag Inventory</h1>
    <a
      className="link text-2xl pt-4 text-blue-400 hover:text-blue-700 visited:text-purple-500"
      href={uri}
    >
      Login with Twitch
    </a>
  </div>
);
