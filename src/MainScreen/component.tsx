import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import React from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { ulid } from "ulid";
import { ErrorNotification } from "~/ErrorNotification";
import { Menu } from "~/Menu";
import { TwitchAuthContext } from "~/TwitchAuth";
import { dep, twitch } from "~/fetcher";
import type { Template } from "~/model/template";
import { useStorage } from "~/useStorage";
import { AddTemplateButton } from "./AddTemplateButton";
import { TemplateList } from "./TemplateList";

type User = {
  id: string;
  display_name: string;
  profile_image_url: string;
};

export const MainScreen: React.FC = () => {
  const { token } = React.useContext(TwitchAuthContext);
  const [templates, setTemplates] = useStorage<Template[]>("templates", []);

  const { data: users, isLoading } = useSWR(
    ["https://api.twitch.tv/helix/users", token],
    twitch.get<User[]>,
  );

  const { trigger: applyTemplate } = useSWRMutation(
    () => [
      dep`https://api.twitch.tv/helix/channels?broadcaster_id=${users?.[0]?.id}`,
      token,
    ],
    twitch.patch,
    {
      onError: async (error) => {
        await ErrorNotification.call({
          // TODO: make it i18n.
          title: "Twitchでエラーが生じたようです",
          message: error.message,
        });
      },
    },
  );

  // Ignore errors for createMarker.
  // 1. It's not critical error.
  // 2. It will always fail until stream opened and checking it is not worth.
  const { trigger: createMarker } = useSWRMutation(
    () => [dep`https://api.twitch.tv/helix/streams/markers`, token],
    twitch.post,
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (active.id !== over?.id) {
        const oldIndex = templates.findIndex((t) => t.id === active.id);
        const newIndex = templates.findIndex((t) => t.id === over?.id);

        const moved = arrayMove(templates, oldIndex, newIndex);

        setTemplates(moved);
      }
    },
    [templates, setTemplates],
  );

  const handleApplyTemplate = React.useCallback(
    async (template: Template) => {
      applyTemplate({
        // TODO: make it i18n.
        broadcaster_language: "ja",
        game_id: template.category.id,
        title: template.title,
        tags: template.tags,
      });

      createMarker({
        user_id: users?.[0]?.id,
        description: template.title,
      });
    },
    [applyTemplate, createMarker, users],
  );

  const handleRemoveTemplate = React.useCallback(
    (removed: Template) => {
      const newTemplates = [...templates];
      const index = newTemplates.findIndex((t) => t.id === removed.id);
      newTemplates.splice(index, 1);
      setTemplates(newTemplates);
    },
    [templates, setTemplates],
  );

  const handleCloneTemplate = React.useCallback(
    (cloned: Template) => {
      const newTemplates = [...templates, { ...cloned, id: ulid() }];
      setTemplates(newTemplates);
    },
    [templates, setTemplates],
  );

  const handleSaveTemplate = React.useCallback(
    (saved: Template) => {
      const newTemplates = [...templates];
      const index = newTemplates.findIndex((t) => t.id === saved.id);
      newTemplates[index] = saved;
      setTemplates(newTemplates);
    },
    [templates, setTemplates],
  );

  return (
    <div className="container mx-auto">
      {isLoading && <div className="skelton" />}
      {users && <Menu user={users[0]} />}
      <div className="p-16 flex flex-wrap gap-4">
        <TemplateList
          templates={templates}
          onDragEnd={handleDragEnd}
          onApply={handleApplyTemplate}
          onRemove={handleRemoveTemplate}
          onClone={handleCloneTemplate}
          onSave={handleSaveTemplate}
        />
        <AddTemplateButton templates={templates} setTemplates={setTemplates} />
      </div>
    </div>
  );
};
