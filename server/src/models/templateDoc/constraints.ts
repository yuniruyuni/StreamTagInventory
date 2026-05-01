import {
  TEMPLATE_DOC_ALLOWED_SETTING_KEYS,
  TEMPLATE_DOC_ALLOWED_TEMPLATE_FIELDS,
  TEMPLATE_DOC_ALLOWED_TOP_LEVEL_KEYS,
} from "@shared/template-doc-schema";

/**
 * Y.Doc の shape / サイズ制約定数。
 * 攻撃者や壊れたクライアントが送りつけてくる「巨大」「定義外」「型が違う」
 * update を検出するための制限値を集約する。
 *
 * 制限値は後で env 化する余地を残して定数で集約する。
 */
export const SYNC_LIMITS = {
  /** 1 回の update バイナリ上限 (64 KiB)。base64 膨張後の router 側制限はこの 4/3 + α */
  MAX_UPDATE_BYTES: 64 * 1024,
  /** 保存後の state バイナリ上限 (1 MiB)。schema の CHECK 制約と一致 */
  MAX_STATE_BYTES: 1024 * 1024,
  /** テンプレート件数上限 */
  MAX_TEMPLATES: 500,
  MAX_TITLE_LEN: 200,
  MAX_TAG_LEN: 50,
  MAX_TAGS_PER_TEMPLATE: 20,
  MAX_CATEGORY_ID_LEN: 40,
  MAX_CATEGORY_NAME_LEN: 140,
  MAX_CATEGORY_BOX_ART_URL_LEN: 500,
  MAX_TEMPLATE_ID_LEN: 80,
  MAX_POST_TEMPLATE_LEN: 5000,
} as const;

/** トップレベルで許可するキー。定義外は reject */
export const ALLOWED_TOP_LEVEL_KEYS = new Set<string>(
  TEMPLATE_DOC_ALLOWED_TOP_LEVEL_KEYS,
);

/** templates 配列の各要素で許可するフィールド */
export const ALLOWED_TEMPLATE_FIELDS = new Set<string>(
  TEMPLATE_DOC_ALLOWED_TEMPLATE_FIELDS,
);

/** settings Map で許可するキー */
export const ALLOWED_SETTING_KEYS = new Set<string>(
  TEMPLATE_DOC_ALLOWED_SETTING_KEYS,
);
