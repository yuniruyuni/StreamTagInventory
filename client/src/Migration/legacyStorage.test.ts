import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DEFAULT_POST_TEMPLATE } from "~/utils/postTemplate";
import {
  cleanupLegacyStorage,
  LEGACY_POST_TEMPLATE_KEY,
  LEGACY_RETENTION_MS,
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

describe("cleanupLegacyStorage", () => {
  const sample = [
    {
      id: "t1",
      title: "First",
      category: { id: "1", name: "A", box_art_url: "" },
      tags: ["x"],
    },
  ];

  function seedLegacy() {
    localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(sample));
    localStorage.setItem(
      LEGACY_POST_TEMPLATE_KEY,
      JSON.stringify("custom {title}"),
    );
  }

  test("no-op when MIGRATED_AT_KEY is absent", () => {
    seedLegacy();
    cleanupLegacyStorage();
    expect(localStorage.getItem(LEGACY_TEMPLATES_KEY)).not.toBeNull();
    expect(localStorage.getItem(LEGACY_POST_TEMPLATE_KEY)).not.toBeNull();
  });

  test("no-op when retention has not expired", () => {
    seedLegacy();
    const migrated = new Date("2026-04-01T00:00:00.000Z");
    markMigrated(migrated);
    const now = new Date(migrated.getTime() + LEGACY_RETENTION_MS - 1000);
    cleanupLegacyStorage(now);
    expect(localStorage.getItem(LEGACY_TEMPLATES_KEY)).not.toBeNull();
    expect(localStorage.getItem(MIGRATED_AT_KEY)).not.toBeNull();
  });

  test("clears legacy + MIGRATED_AT after retention", () => {
    seedLegacy();
    const migrated = new Date("2026-04-01T00:00:00.000Z");
    markMigrated(migrated);
    const now = new Date(migrated.getTime() + LEGACY_RETENTION_MS + 1);
    cleanupLegacyStorage(now);
    expect(localStorage.getItem(LEGACY_TEMPLATES_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_POST_TEMPLATE_KEY)).toBeNull();
    expect(localStorage.getItem(MIGRATED_AT_KEY)).toBeNull();
  });

  test("corrupted MIGRATED_AT_KEY (non-date) is removed but legacy kept", () => {
    seedLegacy();
    localStorage.setItem(MIGRATED_AT_KEY, "not-a-date");
    cleanupLegacyStorage();
    // 破損値は消すが、旧データは残して次回 migration prompt で回復させる
    expect(localStorage.getItem(MIGRATED_AT_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_TEMPLATES_KEY)).not.toBeNull();
  });
});
