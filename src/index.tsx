import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { Entrance } from "./Entrance";
import { ErrorNotification } from "./ErrorNotification";
import { MainScreen } from "./MainScreen";
import { TwitchAuthProvider } from "./TwitchAuth";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorNotification.Root />
      <TwitchAuthProvider
        scope={[
          "user:edit:broadcast",
          "channel:manage:broadcast",
          "channel_editor",
        ]}
        entrance={(uri) => <Entrance uri={uri} />}
      >
        <MainScreen />
      </TwitchAuthProvider>
    </React.StrictMode>,
  );
}
