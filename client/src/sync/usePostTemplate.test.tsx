import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type * as Y from "yjs";
import { TemplateDocContext } from "./TemplateDocContext";
import { createTemplateDoc, writePostTemplate } from "./templateDoc";
import { usePostTemplate } from "./usePostTemplate";

function wrap(doc: Y.Doc | null) {
  return ({ children }: { children: ReactNode }) => (
    <TemplateDocContext.Provider value={{ doc, isReady: true }}>
      {children}
    </TemplateDocContext.Provider>
  );
}

describe("usePostTemplate", () => {
  test("returns empty string when doc is null", () => {
    const { result } = renderHook(() => usePostTemplate(), {
      wrapper: wrap(null),
    });
    expect(result.current.postTemplate).toBe("");
  });

  test("setPostTemplate writes to doc and state updates", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => usePostTemplate(), {
      wrapper: wrap(doc),
    });
    act(() => result.current.setPostTemplate("hello {title}"));
    expect(result.current.postTemplate).toBe("hello {title}");
  });

  test("external changes (other client) propagate via observe", () => {
    const doc = createTemplateDoc();
    const { result } = renderHook(() => usePostTemplate(), {
      wrapper: wrap(doc),
    });
    act(() => writePostTemplate(doc, "external"));
    expect(result.current.postTemplate).toBe("external");
  });

  test("setPostTemplate is no-op when doc is null", () => {
    const { result } = renderHook(() => usePostTemplate(), {
      wrapper: wrap(null),
    });
    act(() => result.current.setPostTemplate("x"));
    expect(result.current.postTemplate).toBe("");
  });
});
