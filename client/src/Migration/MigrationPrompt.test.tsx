import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "~/i18n";
import { NotificationProvider } from "~/Notification";
import { TemplateDocContext } from "~/sync/TemplateDocContext";
import {
  createTemplateDoc,
  getTemplatesArray,
  readPostTemplate,
  templateToYMap,
  yMapToTemplate,
} from "~/sync/templateDoc";
import {
  LEGACY_POST_TEMPLATE_KEY,
  LEGACY_TEMPLATES_KEY,
  MIGRATED_AT_KEY,
} from "./legacyStorage";
import { MigrationPrompt } from "./MigrationPrompt";

const sample = [
  {
    id: "t1",
    title: "First",
    category: { id: "1", name: "A", box_art_url: "" },
    tags: ["x"],
  },
];

function wrap(doc: ReturnType<typeof createTemplateDoc> | null) {
  return ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <NotificationProvider>
        <TemplateDocContext.Provider value={{ doc, isReady: true }}>
          {children}
        </TemplateDocContext.Provider>
      </NotificationProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe("MigrationPrompt", () => {
  test("does not render when no legacy data", () => {
    const doc = createTemplateDoc();
    const { queryByRole } = render(<MigrationPrompt />, { wrapper: wrap(doc) });
    expect(queryByRole("button", { name: /Migrate|移行する/i })).toBeNull();
  });

  test("renders Modal when legacy templates present", () => {
    localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(sample));
    const doc = createTemplateDoc();
    const { getByRole } = render(<MigrationPrompt />, { wrapper: wrap(doc) });
    expect(getByRole("button", { name: /Migrate|移行する/i })).toBeTruthy();
  });

  test("does not show prompt when Y.Doc already has templates (synced from another device)", () => {
    localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(sample));
    const doc = createTemplateDoc();
    getTemplatesArray(doc).push([
      templateToYMap({
        id: "existing",
        title: "Existing",
        category: { id: "x", name: "X", box_art_url: "" },
        tags: [],
      }),
    ]);
    const { queryByRole } = render(<MigrationPrompt />, { wrapper: wrap(doc) });
    expect(queryByRole("button", { name: /Migrate|移行する/i })).toBeNull();
  });

  test("Migrate button bulk-replaces Y.Doc + writes MIGRATED_AT_KEY", () => {
    localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(sample));
    localStorage.setItem(
      LEGACY_POST_TEMPLATE_KEY,
      JSON.stringify("custom {title}"),
    );
    const doc = createTemplateDoc();
    const { getByRole } = render(<MigrationPrompt />, { wrapper: wrap(doc) });

    act(() => {
      fireEvent.click(getByRole("button", { name: /Migrate|移行する/i }));
    });

    const arr = getTemplatesArray(doc);
    expect(arr.length).toBe(1);
    expect(yMapToTemplate(arr.get(0))).toEqual(sample[0]);
    expect(readPostTemplate(doc)).toBe("custom {title}");
    expect(localStorage.getItem(MIGRATED_AT_KEY)).not.toBeNull();
  });

  test("Later button dismisses without setting MIGRATED_AT_KEY", () => {
    localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(sample));
    const doc = createTemplateDoc();
    const { getByRole } = render(<MigrationPrompt />, { wrapper: wrap(doc) });

    act(() => {
      fireEvent.click(getByRole("button", { name: /Later|あとで/i }));
    });

    expect(localStorage.getItem(MIGRATED_AT_KEY)).toBeNull();
    // legacy data も保持されている (rollback 余地)
    expect(localStorage.getItem(LEGACY_TEMPLATES_KEY)).not.toBeNull();
  });
});
