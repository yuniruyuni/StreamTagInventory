import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { SYNC_LIMITS } from "./constraints";
import { LiveTemplateDoc } from "./live";

// --- helpers ---

function makeDoc(mutate?: (doc: Y.Doc) => void): {
  state: Uint8Array;
  sv: Uint8Array;
  update: Uint8Array;
} {
  const doc = new Y.Doc();
  if (mutate) mutate(doc);
  return {
    state: Y.encodeStateAsUpdate(doc),
    sv: Y.encodeStateVector(doc),
    update: Y.encodeStateAsUpdate(doc),
  };
}

// --- Factory ---

describe("LiveTemplateDoc.fromPersisted", () => {
  test("hydrates persisted state", () => {
    const { state } = makeDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t1");
      m.set("title", "hello");
      arr.push([m]);
    });

    const live = LiveTemplateDoc.fromPersisted({
      userId: "u1",
      state,
      sizeBytes: state.byteLength,
      updatedAt: new Date(),
    });

    const persisted = live.toPersisted(new Date());
    const check = new Y.Doc();
    Y.applyUpdate(check, persisted.state);
    expect(check.getArray("templates").length).toBe(1);
  });
});

describe("LiveTemplateDoc.empty", () => {
  test("creates empty doc", () => {
    const live = LiveTemplateDoc.empty("u1");
    expect(live.userId).toBe("u1");
    const persisted = live.toPersisted(new Date());
    expect(persisted.sizeBytes).toBeGreaterThan(0);
  });
});

// --- validateUpdateSize ---

describe("LiveTemplateDoc.validateUpdateSize", () => {
  test("accepts sizes at or below MAX_UPDATE_BYTES", () => {
    expect(LiveTemplateDoc.validateUpdateSize(new Uint8Array(0))).toBeNull();
    expect(
      LiveTemplateDoc.validateUpdateSize(
        new Uint8Array(SYNC_LIMITS.MAX_UPDATE_BYTES),
      ),
    ).toBeNull();
  });

  test("rejects sizes just above MAX_UPDATE_BYTES", () => {
    const f = LiveTemplateDoc.validateUpdateSize(
      new Uint8Array(SYNC_LIMITS.MAX_UPDATE_BYTES + 1),
    );
    expect(f).not.toBeNull();
    expect(f?.code).toBe("UPDATE_TOO_LARGE");
  });
});

// --- applyClientUpdate ---

describe("applyClientUpdate", () => {
  test("applies valid update", () => {
    const { update } = makeDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t1");
      arr.push([m]);
    });

    const live = LiveTemplateDoc.empty("u1");
    expect(live.applyClientUpdate(update)).toBeNull();
  });

  test("returns INVALID_INPUT for corrupt binary", () => {
    const live = LiveTemplateDoc.empty("u1");
    const corrupt = new Uint8Array([0xff, 0xfe, 0xfd]);
    const f = live.applyClientUpdate(corrupt);
    expect(f?.code).toBe("INVALID_INPUT");
  });
});

// --- validate (shape + state size) ---

describe("validate", () => {
  test("accepts an empty doc", () => {
    const live = LiveTemplateDoc.empty("u1");
    expect(live.validate()).toBeNull();
  });

  test("accepts allowed top-level keys (templates / settings)", () => {
    const { update } = makeDoc((doc) => {
      doc.getArray("templates");
      doc.getMap("settings");
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);
    expect(live.validate()).toBeNull();
  });

  test("rejects a disallowed top-level key", () => {
    const { update } = makeDoc((doc) => {
      doc.getMap("evil").set("x", "y");
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);
    const f = live.validate();
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("evil");
  });

  test("rejects too many templates", () => {
    const { update } = makeDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      for (let i = 0; i < SYNC_LIMITS.MAX_TEMPLATES + 1; i++) {
        const m = new Y.Map<unknown>();
        m.set("id", `t${i}`);
        arr.push([m]);
      }
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);
    const f = live.validate();
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("too many templates");
  });

  test("rejects a template with disallowed field", () => {
    const { update } = makeDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t1");
      m.set("evil", "x");
      arr.push([m]);
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);
    const f = live.validate();
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("evil");
  });

  test("rejects oversized title", () => {
    const { update } = makeDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("title", "a".repeat(SYNC_LIMITS.MAX_TITLE_LEN + 1));
      arr.push([m]);
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);
    const f = live.validate();
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("title");
  });

  test("rejects tags over the limit", () => {
    const { update } = makeDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      const tags = new Y.Array<string>();
      for (let i = 0; i < SYNC_LIMITS.MAX_TAGS_PER_TEMPLATE + 1; i++) {
        tags.push([`tag-${i}`]);
      }
      m.set("tags", tags);
      arr.push([m]);
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);
    const f = live.validate();
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("too many");
  });

  test("rejects oversized postTemplate in settings", () => {
    const { update } = makeDoc((doc) => {
      const settings = doc.getMap("settings");
      settings.set(
        "postTemplate",
        "a".repeat(SYNC_LIMITS.MAX_POST_TEMPLATE_LEN + 1),
      );
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);
    const f = live.validate();
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("postTemplate");
  });

  test("rejects disallowed settings key", () => {
    const { update } = makeDoc((doc) => {
      const settings = doc.getMap("settings");
      settings.set("rogue", "x");
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);
    const f = live.validate();
    expect(f?.code).toBe("INVALID_DOC_SHAPE");
    expect(f?.message).toContain("rogue");
  });
});

// --- computeDiff ---

describe("computeDiff", () => {
  test("returns diff for empty client state vector", () => {
    const { update } = makeDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t1");
      arr.push([m]);
    });
    const live = LiveTemplateDoc.empty("u1");
    live.applyClientUpdate(update);

    const emptySv = Y.encodeStateVector(new Y.Doc());
    const result = live.computeDiff(emptySv);
    expect("serverUpdate" in result).toBe(true);
    if (!("serverUpdate" in result)) return;
    expect(result.serverUpdate.byteLength).toBeGreaterThan(0);
    expect(result.serverStateVector.byteLength).toBeGreaterThan(0);
  });

  test("returns INVALID_INPUT for malformed state vector", () => {
    const live = LiveTemplateDoc.empty("u1");
    const result = live.computeDiff(new Uint8Array(0));
    expect("code" in result).toBe(true);
    if (!("code" in result)) return;
    expect(result.code).toBe("INVALID_INPUT");
  });
});

// --- toPersisted ---

describe("toPersisted", () => {
  test("round-trips through fromPersisted", () => {
    const { update } = makeDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t1");
      m.set("title", "round-trip");
      arr.push([m]);
    });

    const live1 = LiveTemplateDoc.empty("u1");
    live1.applyClientUpdate(update);
    const now = new Date();
    const persisted = live1.toPersisted(now);

    expect(persisted.userId).toBe("u1");
    expect(persisted.updatedAt).toBe(now);
    expect(persisted.sizeBytes).toBe(persisted.state.byteLength);

    const live2 = LiveTemplateDoc.fromPersisted(persisted);
    const persisted2 = live2.toPersisted(now);
    expect(persisted2.sizeBytes).toBe(persisted.sizeBytes);
  });
});
