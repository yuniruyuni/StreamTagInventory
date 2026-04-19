import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import * as Y from "yjs";
import type { Template } from "~/model/template";
import { TemplateDocContext } from "./TemplateDocContext";
import { createTemplateDoc, getTemplatesArray } from "./templateDoc";
import { useTemplates } from "./useTemplates";

const T1: Template = {
  id: "t1",
  title: "First",
  category: { id: "1", name: "Cat A", box_art_url: "" },
  tags: ["a"],
};
const T2: Template = {
  id: "t2",
  title: "Second",
  category: { id: "2", name: "Cat B", box_art_url: "" },
  tags: ["b"],
};
const T3: Template = {
  id: "t3",
  title: "Third",
  category: { id: "3", name: "Cat C", box_art_url: "" },
  tags: ["c"],
};

function wrap(doc: Y.Doc | null) {
  return ({ children }: { children: ReactNode }) => (
    <TemplateDocContext.Provider value={{ doc, isReady: true }}>
      {children}
    </TemplateDocContext.Provider>
  );
}

describe("useTemplates", () => {
  test("returns empty array when doc is null", () => {
    const { result } = renderHook(() => useTemplates(), {
      wrapper: wrap(null),
    });
    expect(result.current.templates).toEqual([]);
    expect(result.current.isReady).toBe(true);
  });

  test("addTemplate appends and React state updates via observeDeep", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => useTemplates(), { wrapper: wrap(doc) });
    act(() => result.current.addTemplate(T1));
    expect(result.current.templates).toEqual([T1]);
  });

  test("updateTemplate edits an existing entry by id", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => useTemplates(), { wrapper: wrap(doc) });
    act(() => result.current.addTemplate(T1));
    act(() => {
      result.current.updateTemplate({
        ...T1,
        title: "Updated",
        tags: ["x", "y"],
      });
    });
    expect(result.current.templates).toEqual([
      { ...T1, title: "Updated", tags: ["x", "y"] },
    ]);
  });

  test("removeTemplate drops the entry", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => useTemplates(), { wrapper: wrap(doc) });
    act(() => result.current.addTemplate(T1));
    act(() => result.current.addTemplate(T2));
    act(() => result.current.removeTemplate(T1.id));
    expect(result.current.templates).toEqual([T2]);
  });

  test("moveTemplate reorders source to destination position", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => useTemplates(), { wrapper: wrap(doc) });
    act(() => result.current.addTemplate(T1));
    act(() => result.current.addTemplate(T2));
    act(() => result.current.addTemplate(T3));
    // [T1, T2, T3] → move T1 to T3's position → [T2, T3, T1]
    act(() => result.current.moveTemplate(T1.id, T3.id));
    expect(result.current.templates.map((t) => t.id)).toEqual([
      T2.id,
      T3.id,
      T1.id,
    ]);
  });

  test("bulkReplace overwrites entire array (used by import / migration)", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => useTemplates(), { wrapper: wrap(doc) });
    act(() => result.current.addTemplate(T1));
    act(() => result.current.bulkReplace([T2, T3]));
    expect(result.current.templates).toEqual([T2, T3]);
  });

  test("does not crash when removeTemplate / updateTemplate target missing id", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => useTemplates(), { wrapper: wrap(doc) });
    act(() => result.current.removeTemplate("nonexistent"));
    act(() => result.current.updateTemplate({ ...T1, id: "nonexistent" }));
    expect(result.current.templates).toEqual([]);
  });

  test("changes from outside the hook (other client) propagate via observeDeep", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => useTemplates(), { wrapper: wrap(doc) });
    // 別の経路で push (本来は別 client の sync 経由) → hook の state が追従
    act(() => {
      doc.transact(() => {
        getTemplatesArray(doc).push([
          // helper を直接使うと import ループするので Y.Map を組み立てる
          (() => {
            const m = new Y.Map<unknown>();
            m.set("id", T1.id);
            m.set("title", T1.title);
            m.set("categoryId", T1.category.id);
            m.set("categoryName", T1.category.name);
            m.set("categoryBoxArtUrl", T1.category.box_art_url);
            const tags = new Y.Array<string>();
            tags.push(T1.tags);
            m.set("tags", tags);
            return m;
          })(),
        ]);
      });
    });
    expect(result.current.templates).toEqual([T1]);
  });
});
