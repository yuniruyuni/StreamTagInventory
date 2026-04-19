import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";

import { Entrance } from "./Entrance";
import { MainScreen } from "./MainScreen";
import { MigrationPrompt } from "./Migration";
import { NotificationContainer, NotificationProvider } from "./Notification";
import { TemplateDocProvider } from "./sync/TemplateDocProvider";
import { TwitchAuthProvider } from "./TwitchAuth";
import { TRPCProvider } from "./trpc/provider";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <TRPCProvider>
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
            <TemplateDocProvider>
              <MigrationPrompt />
              <MainScreen />
            </TemplateDocProvider>
          </TwitchAuthProvider>
        </NotificationProvider>
      </TRPCProvider>
    </React.StrictMode>,
  );
}
