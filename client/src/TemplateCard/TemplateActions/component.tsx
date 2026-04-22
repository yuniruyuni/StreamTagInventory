import type React from "react";
import { Button } from "~/components/Button";
import { CardActions } from "~/components/Card";
import { useTranslation } from "~/i18n";
import { type Template, validateTemplate } from "~/model/template";
import {
  buildTweetIntentUrl,
  DEFAULT_POST_TEMPLATE,
  formatPostText,
} from "~/utils/postTemplate";

type Props = {
  template: Template;
  changed: boolean;
  onRevert: () => void;
  onSave: (template: Template) => void;
  onClone: (template: Template) => void;
  onRemove: (template: Template) => void;
  onApply: (template: Template) => void;
  userLogin?: string;
  postTemplate?: string;
};

export const TemplateActions: React.FC<Props> = ({
  template,
  changed,
  onRevert,
  onSave,
  onClone,
  onRemove,
  onApply,
  userLogin,
  postTemplate,
}) => {
  const { t } = useTranslation();
  const valid = validateTemplate(template);

  return (
    <CardActions className="justify-between">
      <div>
        {userLogin && !changed && (
          <button
            aria-label="announce on x"
            type="button"
            className="inline-flex items-center gap-1.5 bg-slate-950 text-white rounded-full px-3 py-1.5 text-sm font-bold hover:opacity-80 transition-opacity cursor-pointer"
            onClick={() => {
              const text = formatPostText(
                postTemplate || DEFAULT_POST_TEMPLATE,
                {
                  title: template.title,
                  category: template.category.name,
                  tags: template.tags,
                  url: `https://twitch.tv/${userLogin}`,
                },
              );
              window.open(buildTweetIntentUrl(text), "_blank");
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <title>X</title>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {changed && (
          <>
            <Button
              aria-label="revert template"
              type="button"
              variant="error"
              onClick={onRevert}
            >
              {t("common.revert")}
            </Button>
            <Button
              aria-label="save template"
              type="button"
              variant="primary"
              onClick={() => onSave(template)}
            >
              {t("common.save")}
            </Button>
          </>
        )}
        {!changed && (
          <>
            <Button
              aria-label="clone template"
              type="button"
              variant="secondary"
              onClick={() => onClone(template)}
            >
              {t("common.clone")}
            </Button>
            <Button
              aria-label="remove template"
              type="button"
              variant="error"
              onClick={() => onRemove(template)}
            >
              {t("common.delete")}
            </Button>
            {!valid && (
              <Button aria-label="apply template" type="button" disabled>
                {t("common.apply")}
              </Button>
            )}
            {valid && (
              <Button
                aria-label="apply template"
                type="button"
                variant="primary"
                onClick={() => onApply(template)}
              >
                {t("common.apply")}
              </Button>
            )}
          </>
        )}
      </div>
    </CardActions>
  );
};
