import { expect, test } from "bun:test";
import type { Template } from "~/model/template";
import { validateImportedTemplates } from "./templateIO";

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
