import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import {
  SYNC_LIMITS,
  validateDocShape,
  validateStateSize,
  validateUpdateSize,
} from "./shape";

describe("validateUpdateSize", () => {
  test("accepts sizes at or below MAX_UPDATE_BYTES", () => {
    expect(validateUpdateSize(new Uint8Array(0))).toBeNull();
    expect(
      validateUpdateSize(new Uint8Array(SYNC_LIMITS.MAX_UPDATE_BYTES)),
    ).toBeNull();
  });

  test("rejects sizes just above MAX_UPDATE_BYTES", () => {
    const f = validateUpdateSize(
      new Uint8Array(SYNC_LIMITS.MAX_UPDATE_BYTES + 1),
    );
    expect(f).not.toBeNull();
    expect(f?.code).toBe("UPDATE_TOO_LARGE");
  });
});

describe("validateStateSize", () => {
  test("boundary (max ok, max+1 fail)", () => {
    expect(
      validateStateSize(new Uint8Array(SYNC_LIMITS.MAX_STATE_BYTES)),
    ).toBeNull();
    expect(
      validateStateSize(new Uint8Array(SYNC_LIMITS.MAX_STATE_BYTES + 1))?.code,
    ).toBe("STATE_TOO_LARGE");
  });
});

describe("validateDocShape", () => {
  test("accepts an empty Y.Doc", () => {
    const doc = new Y.Doc();
    expect(validateDocShape(doc)).toBeNull();
  });

  test("accepts allowed top-level keys (templates / settings)", () => {
    const doc = new Y.Doc();
    doc.getArray("templates");
    doc.getMap("settings");
    expect(validateDocShape(doc)).toBeNull();
  });

  test("rejects a disallowed top-level key", () => {
    const doc = new Y.Doc();
    doc.getMap("evil"); // materialise the shared type to force it into doc.share
    const f = validateDocShape(doc);
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("evil");
  });

  test("rejects too many templates", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>("templates");
    for (let i = 0; i < SYNC_LIMITS.MAX_TEMPLATES + 1; i++) {
      const m = new Y.Map<unknown>();
      m.set("id", `t${i}`);
      arr.push([m]);
    }
    const f = validateDocShape(doc);
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("too many templates");
  });

  test("rejects a template with disallowed field", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>("templates");
    const m = new Y.Map<unknown>();
    m.set("id", "t1");
    m.set("evil", "x");
    arr.push([m]);
    const f = validateDocShape(doc);
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("evil");
  });

  test("rejects oversized title", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>("templates");
    const m = new Y.Map<unknown>();
    m.set("title", "a".repeat(SYNC_LIMITS.MAX_TITLE_LEN + 1));
    arr.push([m]);
    const f = validateDocShape(doc);
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("title");
  });

  test("rejects tags over the limit", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>("templates");
    const m = new Y.Map<unknown>();
    const tags = new Y.Array<string>();
    for (let i = 0; i < SYNC_LIMITS.MAX_TAGS_PER_TEMPLATE + 1; i++) {
      tags.push([`tag-${i}`]);
    }
    m.set("tags", tags);
    arr.push([m]);
    const f = validateDocShape(doc);
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("too many");
  });

  test("rejects oversized postTemplate in settings", () => {
    const doc = new Y.Doc();
    const settings = doc.getMap("settings");
    settings.set(
      "postTemplate",
      "a".repeat(SYNC_LIMITS.MAX_POST_TEMPLATE_LEN + 1),
    );
    const f = validateDocShape(doc);
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("postTemplate");
  });

  test("rejects disallowed settings key", () => {
    const doc = new Y.Doc();
    const settings = doc.getMap("settings");
    settings.set("rogue", "x");
    const f = validateDocShape(doc);
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("rogue");
  });
});
