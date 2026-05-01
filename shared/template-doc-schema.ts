export const TEMPLATE_DOC_KEYS = {
  templates: "templates",
  settings: "settings",
  postTemplate: "postTemplate",
  schemaVersion: "schemaVersion",
  template: {
    id: "id",
    title: "title",
    categoryId: "categoryId",
    categoryName: "categoryName",
    categoryBoxArtUrl: "categoryBoxArtUrl",
    tags: "tags",
  },
} as const;

export const TEMPLATE_DOC_SCHEMA_VERSION = 1;

export const TEMPLATE_DOC_ALLOWED_TOP_LEVEL_KEYS = [
  TEMPLATE_DOC_KEYS.templates,
  TEMPLATE_DOC_KEYS.settings,
] as const;

export const TEMPLATE_DOC_ALLOWED_TEMPLATE_FIELDS = [
  TEMPLATE_DOC_KEYS.template.id,
  TEMPLATE_DOC_KEYS.template.title,
  TEMPLATE_DOC_KEYS.template.categoryId,
  TEMPLATE_DOC_KEYS.template.categoryName,
  TEMPLATE_DOC_KEYS.template.categoryBoxArtUrl,
  TEMPLATE_DOC_KEYS.template.tags,
] as const;

export const TEMPLATE_DOC_ALLOWED_SETTING_KEYS = [
  TEMPLATE_DOC_KEYS.postTemplate,
  TEMPLATE_DOC_KEYS.schemaVersion,
] as const;
