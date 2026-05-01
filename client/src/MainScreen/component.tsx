import type { FC } from "react";
import { CurrentStreamInfo } from "~/CurrentStreamInfo";
import { useTranslation } from "~/i18n";
import { Menu } from "~/Menu";
import { PostTemplateEditor } from "~/PostTemplateEditor";

import { AddTemplateButton } from "./AddTemplateButton";
import { TemplateList } from "./TemplateList";
import { useMainScreenState } from "./useMainScreenState";

export const MainScreen: FC = () => {
  const { t } = useTranslation();
  const {
    users,
    isLoading,
    channelInfo,
    channelCategory,
    isChannelLoading,
    searchQuery,
    setSearchQuery,
    filteredTemplates,
    postTemplate,
    setPostTemplate,
    postTemplateEditorOpen,
    setPostTemplateEditorOpen,
    onImportCurrentAsTemplate,
    onAddTemplate,
    onMoveTemplate,
    onApplyTemplate,
    onRemoveTemplate,
    onCloneTemplate,
    onSaveTemplate,
    onImportTemplates,
    onExportTemplates,
  } = useMainScreenState();

  return (
    <div className="container mx-auto">
      <Menu
        user={users?.[0]}
        isLoading={isLoading}
        onSearch={setSearchQuery}
        onImport={onImportTemplates}
        onExport={onExportTemplates}
        onEditPostTemplate={() => setPostTemplateEditorOpen(true)}
      />
      <div className="flex flex-col gap-4 p-16 pt-24">
        <CurrentStreamInfo
          channelInfo={channelInfo}
          category={channelCategory}
          isLoading={isLoading || isChannelLoading}
          onImportAsTemplate={onImportCurrentAsTemplate}
        />
        <div className="flex flex-wrap gap-4">
          {filteredTemplates.length > 0 ? (
            <TemplateList
              templates={filteredTemplates}
              onMove={onMoveTemplate}
              onApply={onApplyTemplate}
              onRemove={onRemoveTemplate}
              onClone={onCloneTemplate}
              onSave={onSaveTemplate}
              userLogin={users?.[0]?.login}
              postTemplate={postTemplate}
            />
          ) : (
            searchQuery.trim() && (
              <div className="w-full text-center py-8 text-slate-500">
                {t("template.noResults")}
              </div>
            )
          )}
          <AddTemplateButton onAdd={onAddTemplate} />
        </div>
      </div>
      <PostTemplateEditor
        open={postTemplateEditorOpen}
        postTemplate={postTemplate}
        onSave={setPostTemplate}
        onClose={() => setPostTemplateEditorOpen(false)}
      />
    </div>
  );
};
