import { describe, expect, test } from "bun:test";
import { finalize } from "./pg-client";
import { sql } from "./sql";

describe("sql tagged template", () => {
  test("creates parameterized query", () => {
    const fragment = sql`SELECT * FROM users WHERE id = ${1} AND name = ${"test"}`;
    expect(fragment.query).toBe(
      "SELECT * FROM users WHERE id = ? AND name = ?",
    );
    expect(fragment.params).toEqual([1, "test"]);
  });

  test("nests fragments", () => {
    const where = sql`status = ${"active"}`;
    const query = sql`SELECT * FROM users WHERE ${where}`;
    expect(query.query).toBe("SELECT * FROM users WHERE status = ?");
    expect(query.params).toEqual(["active"]);
  });
});

describe("sql.join", () => {
  test("joins fragments with separator", () => {
    const fragments = [sql`a = ${1}`, sql`b = ${2}`];
    const joined = sql.join(fragments, " AND ");
    expect(joined.query).toBe("a = ? AND b = ?");
    expect(joined.params).toEqual([1, 2]);
  });

  test("handles empty array", () => {
    const joined = sql.join([], " AND ");
    expect(joined.query).toBe("");
    expect(joined.params).toEqual([]);
  });
});

describe("sql.raw", () => {
  test("creates raw SQL without params", () => {
    const fragment = sql.raw("ORDER BY id");
    expect(fragment.query).toBe("ORDER BY id");
    expect(fragment.params).toEqual([]);
  });
});

describe("sql.list", () => {
  test("creates parameter list", () => {
    const fragment = sql.list([1, 2, 3]);
    expect(fragment.query).toBe("?, ?, ?");
    expect(fragment.params).toEqual([1, 2, 3]);
  });
});

describe("finalize", () => {
  test("converts ? placeholders to $N", () => {
    const fragment = sql`SELECT * FROM t WHERE a = ${1} AND b = ${2}`;
    const result = finalize(fragment);
    expect(result.query).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
    expect(result.params).toEqual([1, 2]);
  });
});

describe("brand protection", () => {
  test("structural fake { query, params } is not recognized as SQLFragment", () => {
    // 外部から素オブジェクトで SQLFragment を偽装しようとしても Brand symbol が
    // 無いため、sql タグの中では「値としてのパラメータ」として扱われる
    // (= `?` に置き換わり params に push される)。
    const fake = { query: "DROP TABLE users", params: [] };
    const wrapped = sql`SELECT ${fake as unknown}`;
    expect(wrapped.query).toBe("SELECT ?");
    // query 文字列は素通しで interpolate されない
    expect(wrapped.query).not.toContain("DROP TABLE");
    expect(wrapped.params).toEqual([fake]);
  });

  test("sql.raw is the only documented escape hatch for raw strings", () => {
    // 安全な用途 (ORDER BY など placeholder で書けない構文) の明示
    const raw = sql.raw("ORDER BY created_at DESC");
    const composed = sql`SELECT * FROM t ${raw}`;
    expect(composed.query).toBe("SELECT * FROM t ORDER BY created_at DESC");
    expect(composed.params).toEqual([]);
  });
});
