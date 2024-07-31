import React from "react";
import ReactDOM from "react-dom/client";
import useSWR from "swr";
import "./index.css";

import { NewTemplateCard } from "~/NewTemplateCard";
import { useStorage } from "~/useStorage";
import { TwitchAuthContext, TwitchAuthProvider } from "./TwitchAuth";
import { twitch } from "./fetcher";
import type { Template } from "./model/template";

function MainScreen() {
  const token = React.useContext(TwitchAuthContext);
  const [templates, setTemplates] = useStorage<Template[]>("templates", []);

  const {
    data: users,
    isLoading,
    error,
  } = useSWR(["https://api.twitch.tv/helix/users", token], twitch.get);

  if (isLoading) return <div>loading...</div>;
  if (error) return <div>failed to load</div>;

  return (
    <div className="p-16">
      <span>user: {users.data[0].display_name}</span>
      {
        templates.map((template) => (
          <div key={template.title}>
            <span>{template.title}</span>
            <span>{template.category.name}</span>
            <span>{template.tags}</span>
          </div>
        ))
      }
      <NewTemplateCard onAdd={(template) => setTemplates([...templates, template])} />
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <TwitchAuthProvider>
        <MainScreen />
      </TwitchAuthProvider>
    </React.StrictMode>,
  );
}
