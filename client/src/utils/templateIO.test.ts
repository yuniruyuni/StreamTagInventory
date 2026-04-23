import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { Template } from "~/model/template";
import { exportTemplates, validateImportedTemplates } from "./templateIO";

const validTemplate: Template = {
  id: "t1",
  title: "Title 1",
  category: {
    id: "c1",
    name: "Category 1",
    box_art_url: "https://example.com/c1.jpg",
  },
  tags: ["tag1", "tag2"],
};

test("validateImportedTemplates returns true for valid template array", () => {
  const validTemplates: Template[] = [
    {
      id: "test-id-1",
      title: "Test Template 1",
      category: {
        id: "category-id-1",
        name: "Test Category 1",
        box_art_url: "https://example.com/image1.jpg",
      },
      tags: ["tag1", "tag2"],
    },
    {
      id: "test-id-2",
      title: "Test Template 2",
      category: {
        id: "category-id-2",
        name: "Test Category 2",
        box_art_url: "https://example.com/image2.jpg",
      },
      tags: ["tag3", "tag4", "tag5"],
    },
  ];

  expect(validateImportedTemplates(validTemplates)).toBe(true);
});

test("validateImportedTemplates returns false for non-array input", () => {
  const invalidInput = {
    id: "test-id",
    title: "Test Template",
    category: {
      id: "category-id",
      name: "Test Category",
      box_art_url: "https://example.com/image.jpg",
    },
    tags: ["tag1", "tag2"],
  };

  expect(validateImportedTemplates(invalidInput)).toBe(false);
});

test("validateImportedTemplates returns false for array with invalid template", () => {
  const invalidTemplates = [
    {
      id: "test-id-1",
      title: "Test Template 1",
      category: {
        id: "category-id-1",
        name: "Test Category 1",
        box_art_url: "https://example.com/image1.jpg",
      },
      tags: ["tag1", "tag2"],
    },
    {
      id: "test-id-2",
      // Missing title property
      category: {
        id: "category-id-2",
        name: "Test Category 2",
        box_art_url: "https://example.com/image2.jpg",
      },
      tags: ["tag3", "tag4"],
    },
  ];

  expect(validateImportedTemplates(invalidTemplates)).toBe(false);
});

test("validateImportedTemplates returns false for array with invalid category", () => {
  const invalidTemplates = [
    {
      id: "test-id-1",
      title: "Test Template 1",
      category: {
        id: "category-id-1",
        name: "Test Category 1",
        // Missing box_art_url property
      },
      tags: ["tag1", "tag2"],
    },
  ];

  expect(validateImportedTemplates(invalidTemplates)).toBe(false);
});

test("validateImportedTemplates returns false for array with invalid tags", () => {
  const invalidTemplates = [
    {
      id: "test-id-1",
      title: "Test Template 1",
      category: {
        id: "category-id-1",
        name: "Test Category 1",
        box_art_url: "https://example.com/image1.jpg",
      },
      tags: [123, "tag2"], // Non-string tag
    },
  ];

  expect(validateImportedTemplates(invalidTemplates)).toBe(false);
});

// ---- exportTemplates ----

let urlCreateMock: ReturnType<typeof mock>;
let urlRevokeMock: ReturnType<typeof mock>;
let originalCreateObjectURL: typeof URL.createObjectURL;
let originalRevokeObjectURL: typeof URL.revokeObjectURL;

beforeEach(() => {
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  urlCreateMock = mock(() => "blob:mock-url");
  urlRevokeMock = mock(() => undefined);
  URL.createObjectURL = urlCreateMock as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = urlRevokeMock as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

test("exportTemplates writes JSON blob and triggers download with given filename", async () => {
  let capturedBlob: Blob | null = null;
  urlCreateMock = mock((blob: Blob) => {
    capturedBlob = blob;
    return "blob:mock-url";
  });
  URL.createObjectURL = urlCreateMock as unknown as typeof URL.createObjectURL;

  const clickSpy = mock(() => undefined);
  const origCreateElement = document.createElement.bind(document);
  const createElementSpy = mock((tag: string) => {
    const el = origCreateElement(tag) as HTMLAnchorElement;
    if (tag === "a") el.click = clickSpy as unknown as typeof el.click;
    return el;
  });
  document.createElement =
    createElementSpy as unknown as typeof document.createElement;

  try {
    exportTemplates([validTemplate], "custom.json");

    expect(urlCreateMock).toHaveBeenCalledTimes(1);
    expect(capturedBlob).not.toBeNull();
    expect((capturedBlob as unknown as Blob).type).toBe("application/json");

    const text = await (capturedBlob as unknown as Blob).text();
    expect(JSON.parse(text)).toEqual([validTemplate]);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(urlRevokeMock).toHaveBeenCalledWith("blob:mock-url");
  } finally {
    document.createElement = origCreateElement;
  }
});

test("exportTemplates defaults filename to templates.json", () => {
  const origCreateElement = document.createElement.bind(document);
  let capturedDownload = "";
  const createElementSpy = mock((tag: string) => {
    const el = origCreateElement(tag) as HTMLAnchorElement;
    if (tag === "a") {
      el.click = mock(() => undefined) as unknown as typeof el.click;
      Object.defineProperty(el, "download", {
        set(v: string) {
          capturedDownload = v;
        },
        get() {
          return capturedDownload;
        },
      });
    }
    return el;
  });
  document.createElement =
    createElementSpy as unknown as typeof document.createElement;

  try {
    exportTemplates([]);
    expect(capturedDownload).toBe("templates.json");
  } finally {
    document.createElement = origCreateElement;
  }
});

// Note: importTemplates tests were attempted but the interaction between
// happy-dom's FileReader and bun:test's async handling was unreliable
// (intermittent hangs). Since importTemplates is largely a thin wrapper over
// FileReader + validateImportedTemplates (both covered separately), we skip
// its integration-style test for now. If needed, a full-DOM e2e or a Playwright
// test would be a better fit than mocking FileReader here.
