import { describe, expect, test } from "bun:test";
import { sql } from "@/infra/db/sql";
import { orderByClause, sortDirection } from "@/infra/db/sql-helpers";

describe("sortDirection", () => {
  test('returns ASC/DESC for "asc"/"desc"', () => {
    expect(sortDirection("asc").query).toBe("ASC");
    expect(sortDirection("desc").query).toBe("DESC");
  });

  test("throws when an unexpected string is cast in (fail-closed against dynamic input)", () => {
    // TypeScript では "asc" | "desc" のみ受けるが、runtime では任意文字列が流入しうる
    expect(() => sortDirection("asc; DROP TABLE" as "asc" | "desc")).toThrow();
    expect(() => sortDirection("DESC" as unknown as "asc" | "desc")).toThrow();
  });
});

describe("orderByClause", () => {
  type K = "createdAt" | "id";
  const columnFor = (k: K) => {
    switch (k) {
      case "createdAt":
        return sql.raw("created_at");
      case "id":
        return sql.raw("id");
    }
  };

  test("builds ORDER BY with multiple keys", () => {
    const fragment = orderByClause(
      { keys: ["createdAt", "id"], order: "desc" },
      columnFor,
    );
    expect(fragment.query).toBe("created_at DESC, id DESC");
    expect(fragment.params).toEqual([]);
  });

  test("throws if sort.order has been cast from untrusted value", () => {
    expect(() =>
      orderByClause(
        { keys: ["id"], order: "desc; DROP TABLE" as "asc" | "desc" },
        columnFor,
      ),
    ).toThrow();
  });

  test("throws if sort.keys contains an unknown key (columnFor's default guard)", () => {
    // 型的には起きないが、JSON デシリアライズ等で不正値が入るケース
    const unsafeColumnFor = (k: K) => {
      switch (k) {
        case "createdAt":
          return sql.raw("created_at");
        case "id":
          return sql.raw("id");
      }
      throw new Error(`Invalid sort key: ${String(k)}`);
    };
    expect(() =>
      orderByClause(
        { keys: ["nonexistent" as K], order: "asc" },
        unsafeColumnFor,
      ),
    ).toThrow();
  });

  test("never embeds dynamic key/order strings verbatim into SQL", () => {
    // sort.order に injection payload を突っ込んでも query 文字列に出てこない
    // (throw するので catch してから検査する)
    let threw = false;
    try {
      orderByClause(
        { keys: ["id"], order: "asc -- evil" as "asc" | "desc" },
        columnFor,
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
