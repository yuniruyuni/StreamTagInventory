import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n";

import { Entrance } from "./Entrance";
import { MainScreen } from "./MainScreen";
import { NotificationContainer, NotificationProvider } from "./Notification";
import { TwitchAuthProvider } from "./TwitchAuth";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <NotificationProvider>
        <NotificationContainer />
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
      </NotificationProvider>
    </React.StrictMode>,
  );
}
