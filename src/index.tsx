import React from "react";
import ReactDOM from "react-dom/client";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import "./index.css";

import { NewTemplateCard } from "~/NewTemplateCard";
import { useStorage } from "~/useStorage";
import { TemplateCard } from "./TemplateCard";
import { TwitchAuthContext, TwitchAuthProvider } from "./TwitchAuth";
import { twitch } from "./fetcher";
import type { Template } from "./model/template";

function MainScreen() {
  const { token, logout } = React.useContext(TwitchAuthContext);
  const [templates, setTemplates] = useStorage<Template[]>("templates", []);

  const {
    data: users,
    isLoading,
    error,
  } = useSWR(["https://api.twitch.tv/helix/users", token], twitch.get);

  const { trigger: applyTemplate } = useSWRMutation(() => [`https://api.twitch.tv/helix/channels?broadcaster_id=${users.data[0].id}`, token], twitch.patch);

  if (isLoading) return <div>loading...</div>;
  if (error) return <div>failed to load</div>;

  return (
    <div className="container mx-auto">
      <div className="navbar bg-base-100">
        <div className="flex-1">
          <a href="/" className="btn btn-ghost text-xl">Twitch Stream Tag Inventory</a>
        </div>
        <div className="flex-none gap-2">
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full">
                <img
                  alt={`${users.data[0].display_name} icon`}
                  src={users.data[0].profile_image_url}
                />
              </div>
            </div>
            <button type="button" tabIndex={0}>
              <ul
                className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
                <li><button type="button" onClick={() => logout()}>Logout</button></li>
              </ul>
            </button>
          </div>
        </div>
      </div>

      <div className="p-16 grid grid-cols-4 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onUse={(template) => {
              const args = {
                broadcaster_language: "ja",
                game_id: template.category.id,
                title: template.title,
                tags: template.tags,
              };
              applyTemplate(args);
            }}
            onRemove={(removed) => {
              const newTemplates = [...templates];
              const index = newTemplates.findIndex((t) => t.id === removed.id);
              newTemplates.splice(index, 1);
              setTemplates(newTemplates);
            }}
          />
        ))}
        <NewTemplateCard onAdd={(template) => setTemplates([...templates, template])} />
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <TwitchAuthProvider
        scope={[
          "user:edit:broadcast",
          "channel:manage:broadcast",
          "channel_editor",
        ]}
        entrance={(uri) => <a href={uri}>Login with Twitch</a>}
      >
        <MainScreen />
      </TwitchAuthProvider>
    </React.StrictMode>,
  );
}
