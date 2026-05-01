import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import {
  applyRemoteUpdate,
  createTemplateDoc,
  encodeStateAsUpdate,
  encodeStateVector,
  fromBase64,
  getSettingsMap,
  getTemplatesArray,
  REMOTE_ORIGIN,
  readPostTemplate,
  readSchemaVersion,
  templateToYMap,
  toBase64,
  writePostTemplate,
  yMapToTemplate,
} from "./templateDoc";

const sampleTemplate = {
  id: "tmpl-1",
  title: "Stream Title",
  category: {
    id: "509658",
    name: "Just Chatting",
    box_art_url:
      "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg",
  },
  tags: ["English", "Gaming"],
};

describe("templateDoc Y.Doc structure", () => {
  test("getTemplatesArray / getSettingsMap return root types", () => {
    const doc = createTemplateDoc();
    expect(getTemplatesArray(doc)).toBeInstanceOf(Y.Array);
    expect(getSettingsMap(doc)).toBeInstanceOf(Y.Map);
  });

  test("createTemplateDoc writes the current schema version", () => {
    const doc = createTemplateDoc();
    expect(readSchemaVersion(doc)).toBe(1);
  });
});

describe("templateToYMap / yMapToTemplate", () => {
  test("round-trips fields including category snake_case", () => {
    // Y.Map は doc に attach しないと読めないので、Array.push で attach する
    const doc = createTemplateDoc();
    getTemplatesArray(doc).push([templateToYMap(sampleTemplate)]);
    const restored = yMapToTemplate(getTemplatesArray(doc).get(0));
    expect(restored).toEqual(sampleTemplate);
  });

  test("yMapToTemplate handles missing fields with defaults", () => {
    const doc = createTemplateDoc();
    getTemplatesArray(doc).push([new Y.Map<unknown>()]);
    const restored = yMapToTemplate(getTemplatesArray(doc).get(0));
    expect(restored).toEqual({
      id: "",
      title: "",
      category: { id: "", name: "", box_art_url: "" },
      tags: [],
    });
  });

  test("templateToYMap stores tags as Y.Array (CRDT-friendly)", () => {
    const doc = createTemplateDoc();
    getTemplatesArray(doc).push([templateToYMap(sampleTemplate)]);
    expect(getTemplatesArray(doc).get(0).get("tags")).toBeInstanceOf(Y.Array);
  });
});

describe("postTemplate roundtrip", () => {
  test("read returns empty string when unset", () => {
    const doc = createTemplateDoc();
    expect(readPostTemplate(doc)).toBe("");
  });

  test("write then read", () => {
    const doc = createTemplateDoc();
    writePostTemplate(doc, "hello {title}");
    expect(readPostTemplate(doc)).toBe("hello {title}");
  });
});

describe("Yjs sync primitives", () => {
  test("client → server (encode update) → server applies → state matches", () => {
    const client = createTemplateDoc();
    const server = createTemplateDoc();

    getTemplatesArray(client).push([templateToYMap(sampleTemplate)]);
    const update = encodeStateAsUpdate(client);
    Y.applyUpdate(server, update);

    const serverArr = getTemplatesArray(server);
    expect(serverArr.length).toBe(1);
    expect(yMapToTemplate(serverArr.get(0))).toEqual(sampleTemplate);
  });

  test("applyRemoteUpdate tags origin as REMOTE_ORIGIN to suppress echo", () => {
    const doc = createTemplateDoc();
    const observed: unknown[] = [];
    doc.on("update", (_update: Uint8Array, origin: unknown) => {
      observed.push(origin);
    });

    const otherDoc = createTemplateDoc();
    getTemplatesArray(otherDoc).push([templateToYMap(sampleTemplate)]);
    applyRemoteUpdate(doc, encodeStateAsUpdate(otherDoc));

    expect(observed).toContain(REMOTE_ORIGIN);
  });

  test("encodeStateAsUpdate(since) returns only operations not seen by since", () => {
    // sv1 を取った後の差分を sv1 を持つ peer に適用すると、後から追加した分だけが
    // 反映される (CRDT の標準的な incremental sync 動作)。
    const sender = createTemplateDoc();
    getTemplatesArray(sender).push([templateToYMap(sampleTemplate)]);
    const peer = createTemplateDoc();
    Y.applyUpdate(peer, encodeStateAsUpdate(sender));
    const sv = encodeStateVector(peer);

    // sender 側で 2 件目を追加
    getTemplatesArray(sender).push([
      templateToYMap({ ...sampleTemplate, id: "tmpl-2", title: "Second" }),
    ]);

    // sv 以降の差分を peer に適用 → peer は 1 件目 + 2 件目になる
    Y.applyUpdate(peer, encodeStateAsUpdate(sender, sv));

    const arr = getTemplatesArray(peer);
    expect(arr.length).toBe(2);
    const ids = arr.toArray().map((m) => yMapToTemplate(m).id);
    expect(ids).toContain("tmpl-1");
    expect(ids).toContain("tmpl-2");
  });
});

describe("base64 helpers", () => {
  test("toBase64 / fromBase64 roundtrip arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 13, 10]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  test("empty array roundtrips to empty string", () => {
    expect(toBase64(new Uint8Array())).toBe("");
    expect(fromBase64("").length).toBe(0);
  });
});
