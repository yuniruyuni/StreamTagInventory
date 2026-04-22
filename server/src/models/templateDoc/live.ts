import * as Y from "yjs";
import { type Fail, fail } from "@/models/common";
import {
  ALLOWED_SETTING_KEYS,
  ALLOWED_TEMPLATE_FIELDS,
  ALLOWED_TOP_LEVEL_KEYS,
  SYNC_LIMITS,
} from "./constraints";
import type { TemplateDoc } from "./templateDoc";

/**
 * Y.Doc を hydrate した活性ドメインオブジェクト。
 * ビジネスロジック（検証ルール、CRDT 操作、制約チェック）の担い手。
 *
 * bytes からは shape 検証も差分計算もできない（Y.Doc に hydrate が必須）ため、
 * 永続形式 `TemplateDoc` (interface) と活性形式 `LiveTemplateDoc` (class) を分離する。
 */
export class LiveTemplateDoc {
  readonly userId: string;
  private readonly doc: Y.Doc;

  private constructor(userId: string, doc: Y.Doc) {
    this.userId = userId;
    this.doc = doc;
  }

  // --- Factory ---

  static fromPersisted(persisted: TemplateDoc): LiveTemplateDoc {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, persisted.state);
    return new LiveTemplateDoc(persisted.userId, doc);
  }

  static empty(userId: string): LiveTemplateDoc {
    return new LiveTemplateDoc(userId, new Y.Doc());
  }

  // --- 入力ガード (static、インスタンス不要) ---

  static validateUpdateSize(update: Uint8Array): Fail | null {
    if (update.byteLength > SYNC_LIMITS.MAX_UPDATE_BYTES) {
      return fail(
        "UPDATE_TOO_LARGE",
        `update exceeds ${SYNC_LIMITS.MAX_UPDATE_BYTES} bytes`,
      );
    }
    return null;
  }

  // --- Mutation ---

  applyClientUpdate(update: Uint8Array): Fail | null {
    try {
      Y.applyUpdate(this.doc, update);
    } catch (err) {
      return fail(
        "INVALID_INPUT",
        `clientUpdate could not be applied: ${String(err)}`,
      );
    }
    return null;
  }

  // --- Validation (apply 後に呼ぶ) ---

  validate(): Fail | null {
    return this.validateShape() ?? this.validateStateSize();
  }

  private validateShape(): Fail | null {
    return validateDocShape(this.doc);
  }

  private validateStateSize(): Fail | null {
    const state = Y.encodeStateAsUpdate(this.doc);
    if (state.byteLength > SYNC_LIMITS.MAX_STATE_BYTES) {
      return fail(
        "STATE_TOO_LARGE",
        `state exceeds ${SYNC_LIMITS.MAX_STATE_BYTES} bytes`,
      );
    }
    return null;
  }

  // --- Query ---

  computeDiff(
    clientStateVector: Uint8Array,
  ): { serverUpdate: Uint8Array; serverStateVector: Uint8Array } | Fail {
    let serverUpdate: Uint8Array;
    try {
      serverUpdate = Y.encodeStateAsUpdate(this.doc, clientStateVector);
    } catch (err) {
      return fail(
        "INVALID_INPUT",
        `clientStateVector is malformed: ${String(err)}`,
      );
    }
    return {
      serverUpdate,
      serverStateVector: Y.encodeStateVector(this.doc),
    };
  }

  // --- Persistence 変換 ---

  toPersisted(now: Date): TemplateDoc {
    const state = Y.encodeStateAsUpdate(this.doc);
    return {
      userId: this.userId,
      state,
      sizeBytes: state.byteLength,
      updatedAt: now,
    };
  }
}

// --- module-private helpers ---

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

/**
 * applyUpdate 後の Y.Doc を走査して許容される形かを判断する。
 */
function validateDocShape(doc: Y.Doc): Fail | null {
  for (const key of doc.share.keys()) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return fail("INVALID_DOC_SHAPE", `disallowed top-level key: ${key}`);
    }
  }

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
