import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DEFAULT_POST_TEMPLATE } from "~/utils/postTemplate";
import {
  LEGACY_POST_TEMPLATE_KEY,
  LEGACY_TEMPLATES_KEY,
  MIGRATED_AT_KEY,
  markMigrated,
  readLegacyData,
} from "./legacyStorage";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

const sample = [
  {
    id: "t1",
    title: "First",
    category: { id: "1", name: "A", box_art_url: "" },
    tags: ["x"],
  },
];

describe("readLegacyData", () => {
  test("returns null when nothing in localStorage", () => {
    expect(readLegacyData()).toBeNull();
  });

  test("returns null when MIGRATED_AT_KEY is set (already migrated)", () => {
    localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(sample));
    localStorage.setItem(MIGRATED_AT_KEY, "2026-01-01T00:00:00.000Z");
    expect(readLegacyData()).toBeNull();
  });

  test("returns null when only DEFAULT_POST_TEMPLATE (= no value worth migrating)", () => {
    localStorage.setItem(
      LEGACY_POST_TEMPLATE_KEY,
      JSON.stringify(DEFAULT_POST_TEMPLATE),
    );
    expect(readLegacyData()).toBeNull();
  });

  test("picks up legacy templates", () => {
    localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(sample));
    const data = readLegacyData();
    expect(data?.templates).toEqual(sample);
    expect(data?.postTemplate).toBeNull();
  });

  test("picks up custom postTemplate", () => {
    localStorage.setItem(
      LEGACY_POST_TEMPLATE_KEY,
      JSON.stringify("custom {title}"),
    );
    const data = readLegacyData();
    expect(data?.postTemplate).toBe("custom {title}");
    expect(data?.templates).toEqual([]);
  });

  test("filters malformed template entries gracefully", () => {
    const mixed = [
      sample[0],
      { id: 123, title: "bad" },
      { title: "no id" },
      "not an object",
    ];
    localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(mixed));
    const data = readLegacyData();
    expect(data?.templates).toEqual(sample);
  });

  test("returns null for invalid JSON (both templates + postTemplate)", () => {
    localStorage.setItem(LEGACY_TEMPLATES_KEY, "{not json");
    localStorage.setItem(LEGACY_POST_TEMPLATE_KEY, "}also bad{");
    // 両方 parse 失敗 → 全体として「migrate する価値の無いデータ」と判定
    expect(readLegacyData()).toBeNull();
  });
});

describe("markMigrated", () => {
  test("writes ISO timestamp to MIGRATED_AT_KEY", () => {
    const t = new Date("2026-04-19T16:00:00.000Z");
    markMigrated(t);
    expect(localStorage.getItem(MIGRATED_AT_KEY)).toBe(t.toISOString());
  });
});
