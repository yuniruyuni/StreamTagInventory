import type * as Y from "yjs";
import { type Fail, fail } from "@/models/common";

/**
 * Y.Doc の shape / サイズ検証。攻撃者や壊れたクライアントが送りつけてくる
 * 「巨大」「定義外」「型が違う」update を applyUpdate 後に検出して trx rollback
 * させる。**業務ルール検証ではない** (title が空等は編集途中として許容)。
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
const ALLOWED_TOP_LEVEL_KEYS = new Set(["templates", "settings"]);

/** templates 配列の各要素で許可するフィールド */
const ALLOWED_TEMPLATE_FIELDS = new Set([
  "id",
  "title",
  "categoryId",
  "categoryName",
  "categoryBoxArtUrl",
  "tags",
]);

/** settings Map で許可するキー */
const ALLOWED_SETTING_KEYS = new Set(["postTemplate"]);

export function validateUpdateSize(update: Uint8Array): Fail | null {
  if (update.byteLength > SYNC_LIMITS.MAX_UPDATE_BYTES) {
    return fail(
      "UPDATE_TOO_LARGE",
      `update exceeds ${SYNC_LIMITS.MAX_UPDATE_BYTES} bytes`,
    );
  }
  return null;
}

export function validateStateSize(state: Uint8Array): Fail | null {
  if (state.byteLength > SYNC_LIMITS.MAX_STATE_BYTES) {
    return fail(
      "STATE_TOO_LARGE",
      `state exceeds ${SYNC_LIMITS.MAX_STATE_BYTES} bytes`,
    );
  }
  return null;
}

/**
 * applyUpdate 後の Y.Doc を走査して許容される形かを判断する。
 * shape 検証は applyUpdate **後** に行う必要がある (update は opaque binary)。
 */
export function validateDocShape(doc: Y.Doc): Fail | null {
  // トップレベルキー (= doc.share の key) のホワイトリスト確認
  for (const key of doc.share.keys()) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return fail("INVALID_DOC_SHAPE", `disallowed top-level key: ${key}`);
    }
  }

  // templates の検証
  const templates = doc.getArray("templates");
  if (templates.length > SYNC_LIMITS.MAX_TEMPLATES) {
    return fail(
      "INVALID_DOC_SHAPE",
      `too many templates (max ${SYNC_LIMITS.MAX_TEMPLATES})`,
    );
  }
  for (let i = 0; i < templates.length; i++) {
    const v = validateTemplateMap(templates.get(i), i);
    if (v) return v;
  }

  // settings Map の検証
  const settings = doc.getMap("settings");
  for (const key of settings.keys()) {
    if (!ALLOWED_SETTING_KEYS.has(key)) {
      return fail("INVALID_DOC_SHAPE", `disallowed settings key: ${key}`);
    }
  }
  const postTemplate = settings.get("postTemplate");
  if (postTemplate != null) {
    if (typeof postTemplate !== "string") {
      return fail("INVALID_DOC_SHAPE", "settings.postTemplate must be string");
    }
    if (postTemplate.length > SYNC_LIMITS.MAX_POST_TEMPLATE_LEN) {
      return fail(
        "INVALID_DOC_SHAPE",
        `settings.postTemplate too long (max ${SYNC_LIMITS.MAX_POST_TEMPLATE_LEN})`,
      );
    }
  }

  return null;
}

/**
 * templates 配列の各要素 (Y.Map 想定) を検証する。
 * `item` は Yjs の public API 上 `unknown` 相当なので、Y.Map メソッドが
 * 叩けるかで判別する (instanceof Y.Map は循環 import を招くので避ける)。
 */
function validateTemplateMap(item: unknown, index: number): Fail | null {
  if (!isYMapLike(item)) {
    return fail("INVALID_DOC_SHAPE", `templates[${index}] must be a Y.Map`);
  }
  for (const key of item.keys()) {
    if (!ALLOWED_TEMPLATE_FIELDS.has(key)) {
      return fail(
        "INVALID_DOC_SHAPE",
        `templates[${index}] has disallowed field: ${key}`,
      );
    }
  }

  const stringField = (key: string, max: number): Fail | null => {
    const v = item.get(key);
    if (v == null) return null;
    if (typeof v !== "string") {
      return fail(
        "INVALID_DOC_SHAPE",
        `templates[${index}].${key} must be string`,
      );
    }
    if (v.length > max) {
      return fail(
        "INVALID_DOC_SHAPE",
        `templates[${index}].${key} too long (max ${max})`,
      );
    }
    return null;
  };

  const checks: Array<Fail | null> = [
    stringField("id", SYNC_LIMITS.MAX_TEMPLATE_ID_LEN),
    stringField("title", SYNC_LIMITS.MAX_TITLE_LEN),
    stringField("categoryId", SYNC_LIMITS.MAX_CATEGORY_ID_LEN),
    stringField("categoryName", SYNC_LIMITS.MAX_CATEGORY_NAME_LEN),
    stringField("categoryBoxArtUrl", SYNC_LIMITS.MAX_CATEGORY_BOX_ART_URL_LEN),
  ];
  for (const c of checks) if (c) return c;

  // tags は Y.Array<string> を想定 (Y.Array は length + get(i) を持つ)
  const tags = item.get("tags");
  if (tags != null) {
    if (!isYArrayLike(tags)) {
      return fail(
        "INVALID_DOC_SHAPE",
        `templates[${index}].tags must be a Y.Array`,
      );
    }
    if (tags.length > SYNC_LIMITS.MAX_TAGS_PER_TEMPLATE) {
      return fail(
        "INVALID_DOC_SHAPE",
        `templates[${index}].tags too many (max ${SYNC_LIMITS.MAX_TAGS_PER_TEMPLATE})`,
      );
    }
    for (let i = 0; i < tags.length; i++) {
      const t = tags.get(i);
      if (typeof t !== "string") {
        return fail(
          "INVALID_DOC_SHAPE",
          `templates[${index}].tags[${i}] must be string`,
        );
      }
      if (t.length > SYNC_LIMITS.MAX_TAG_LEN) {
        return fail(
          "INVALID_DOC_SHAPE",
          `templates[${index}].tags[${i}] too long (max ${SYNC_LIMITS.MAX_TAG_LEN})`,
        );
      }
    }
  }

  return null;
}

interface YMapLike {
  keys(): IterableIterator<string>;
  get(key: string): unknown;
}

interface YArrayLike {
  length: number;
  get(index: number): unknown;
}

function isYMapLike(x: unknown): x is YMapLike {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { keys?: unknown }).keys === "function" &&
    typeof (x as { get?: unknown }).get === "function"
  );
}

function isYArrayLike(x: unknown): x is YArrayLike {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { length?: unknown }).length === "number" &&
    typeof (x as { get?: unknown }).get === "function"
  );
}
