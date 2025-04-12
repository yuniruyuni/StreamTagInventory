import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import React, { useState, useMemo } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { ulid } from "ulid";
import { ErrorNotification } from "~/ErrorNotification";
import { Menu } from "~/Menu";
import { TwitchAuthContext } from "~/TwitchAuth";
import { dep, twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
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
  const { t, i18n } = useTranslation();
  const { token } = React.useContext(TwitchAuthContext);
  const [templates, setTemplates] = useStorage<Template[]>("templates", []);
  const [searchQuery, setSearchQuery] = useState("");

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
          title: t("errors.twitchError"),
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

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return templates;
    }

    const query = searchQuery.toLowerCase().trim();
    return templates.filter(
      (template) =>
        template.title.toLowerCase().includes(query) ||
        template.category.name.toLowerCase().includes(query) ||
        template.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [templates, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

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
        broadcaster_language: i18n.language,
        game_id: template.category.id,
        title: template.title,
        tags: template.tags,
      });

      createMarker({
        user_id: users?.[0]?.id,
        description: template.title,
      });
    },
    [applyTemplate, createMarker, users, i18n],
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
      const clone = { ...cloned, id: ulid() };
      const newTemplates = [...templates];
      const index = newTemplates.findIndex((t) => t.id === cloned.id);
      newTemplates.splice(index + 1, 0, clone);
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

  const handleImportTemplates = React.useCallback(
    (importedTemplates: Template[]) => {
      // Avoid duplicates by checking IDs
      const existingIds = new Set(templates.map(t => t.id));
      const newTemplates = importedTemplates.filter(t => !existingIds.has(t.id));

      if (newTemplates.length > 0) {
        setTemplates([...templates, ...newTemplates]);
      }
    },
    [templates, setTemplates],
  );

  return (
    <div className="container mx-auto">
      {isLoading && <div className="skelton">{t("common.loading")}</div>}
      {users && (
        <Menu
          user={users[0]}
          onSearch={handleSearch}
          templates={templates}
          onImportTemplates={handleImportTemplates}
        />
      )}
      <div className="p-16">
        <div className="flex flex-wrap gap-4">
          {filteredTemplates.length > 0 ? (
            <TemplateList
              templates={filteredTemplates}
              onDragEnd={handleDragEnd}
              onApply={handleApplyTemplate}
              onRemove={handleRemoveTemplate}
              onClone={handleCloneTemplate}
              onSave={handleSaveTemplate}
            />
          ) : (
            searchQuery.trim() && (
              <div className="w-full text-center py-8 text-gray-500">
                {t("template.noResults")}
              </div>
            )
          )}
          <AddTemplateButton
            templates={templates}
            setTemplates={setTemplates}
          />
        </div>
      </div>
    </div>
  );
};
