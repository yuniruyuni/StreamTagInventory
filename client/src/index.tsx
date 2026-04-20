import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";

import { Entrance } from "./Entrance";
import { MainScreen } from "./MainScreen";
import { cleanupLegacyStorage, MigrationPrompt } from "./Migration";
import { NotificationContainer, NotificationProvider } from "./Notification";
import { TemplateDocProvider } from "./sync/TemplateDocProvider";
import { TwitchAuthProvider } from "./TwitchAuth";
import { TRPCProvider } from "./trpc/provider";

// PR 8: 移行から LEGACY_RETENTION_MS (30 日) 経過した旧 localStorage データを
// 起動時に一括削除する。React mount 前に呼べば MigrationPrompt が旧データを
// 誤検出することもない。
cleanupLegacyStorage();

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
