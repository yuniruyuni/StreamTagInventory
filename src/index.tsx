import React from "react";
import ReactDOM from "react-dom/client";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import "./index.css";
import { ulid } from "ulid";

import { type Template, newTemplate } from "~/model/template";
import { useStorage } from "~/useStorage";
import { TemplateCard } from "./TemplateCard";
import { TwitchAuthContext, TwitchAuthProvider } from "./TwitchAuth";
import { dep, twitch } from "./fetcher";

type User = {
  id: string;
  display_name: string;
  profile_image_url: string;
};

const Menu: React.FC<{user: User}> = ({user}) => {
  const { logout } = React.useContext(TwitchAuthContext);

  return (
    <div className="navbar bg-base-100">
      <div className="flex-1">
        <a href="/" className="btn btn-ghost text-xl">Stream Tag Inventory</a>
      </div>
      <div className="flex-none gap-2">
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
            <div className="w-10 rounded-full">
              <img
                alt={`${user.display_name} icon`}
                src={user.profile_image_url}
              />
            </div>
          </div>
          <ul
            className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
            <li><button type="button" onClick={() => logout()}>Logout</button></li>
          </ul>
        </div>
      </div>
    </div>
  );
};


function MainScreen() {
  const { token } = React.useContext(TwitchAuthContext);
  const [templates, setTemplates] = useStorage<Template[]>("templates", []);

  const {data: users, isLoading} = useSWR(["https://api.twitch.tv/helix/users", token], twitch.get<User[]>);
  const { trigger: applyTemplate } = useSWRMutation(() => [dep`https://api.twitch.tv/helix/channels?broadcaster_id=${users?.[0]?.id}`, token], twitch.patch);

  return (
    <div className="container mx-auto">
      {isLoading && <div className="skelton" />}
      {users && <Menu user={users[0]} />}
      <div className="p-16 grid grid-cols-4 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onApply={(template) => {
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
            onClone={(cloned) => {
              const newTemplates = [...templates, { ...cloned, id: ulid() }];
              setTemplates(newTemplates);
            }}
            onSave={(saved) => {
              const newTemplates = [...templates];
              const index = newTemplates.findIndex((t) => t.id === saved.id);
              newTemplates[index] = saved;
              setTemplates(newTemplates);
            }}
          />
        ))}

        <div className="w-min-96 outline-dashed rounded outline-2 outline-slate-400 flex flex-col items-center place-content-center">
          <button type="button" className="btn btn-primary" onClick={() => setTemplates([...templates, newTemplate()])}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

const Entrance: React.FC<{uri: string}> = ({uri}) => (
  <div className="h-screen w-screen flex flex-col items-center justify-center">
    <h1 className="text-4xl">Stream Tag Inventory</h1>
    <a className="link text-2xl pt-4 text-blue-400 hover:text-blue-700 visited:text-purple-500" href={uri}>
      Login with Twitch
    </a>
  </div>
);

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
        entrance={(uri) => <Entrance uri={uri} />}
      >
        <MainScreen />
      </TwitchAuthProvider>
    </React.StrictMode>,
  );
}
