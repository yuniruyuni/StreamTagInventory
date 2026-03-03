import type React from "react";
import { useTranslation } from "~/i18n";
import type { Category } from "~/model/category";
import type { ChannelInfo } from "~/model/channel";

type Props = {
  channelInfo: ChannelInfo | undefined;
  category: Category | undefined;
  isLoading: boolean;
  onImportAsTemplate: () => void;
};

export const CurrentStreamInfo: React.FC<Props> = ({
  channelInfo,
  category,
  isLoading,
  onImportAsTemplate,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="w-full bg-base-200 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-base-300 rounded h-5 w-28" />
            <div className="bg-base-300 rounded h-8 w-36" />
          </div>
          <div className="flex gap-4 items-start">
            <div className="bg-base-300 rounded w-13 h-18" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="bg-base-300 rounded h-4 w-1/3" />
              <div className="bg-base-300 rounded h-3 w-1/4" />
              <div className="bg-base-300 rounded h-4 w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!channelInfo) return null;

  const title = channelInfo.title || t("stream.noTitle");
  const categoryName = channelInfo.game_name || t("stream.noCategory");

  return (
    <div className="w-full bg-base-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">{t("stream.currentInfo")}</h2>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={onImportAsTemplate}
        >
          {t("stream.importAsTemplate")}
        </button>
      </div>
      <div className="flex gap-4 items-start">
        {category?.box_art_url && (
          <img
            src={category.box_art_url
              .replace("{width}", "52")
              .replace("{height}", "72")}
            alt={categoryName}
            className="rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{title}</p>
          <p className="text-sm opacity-70">{categoryName}</p>
          {channelInfo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {channelInfo.tags.map((tag) => (
                <span key={tag} className="badge badge-sm badge-outline">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
