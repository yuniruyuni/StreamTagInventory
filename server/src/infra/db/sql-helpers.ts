import type { Comp, Sort } from "@/models/common";
import { isCompLogical } from "@/models/common";
import { type SQLFragment, sql } from "./sql";

export function compToSQL<T>(
  spec: Comp<T>,
  convert: (s: T) => SQLFragment,
): SQLFragment {
  if (isCompLogical(spec)) {
    switch (spec.type) {
      case "and": {
        if (spec.children.length === 0) return sql.empty();
        const fragments = spec.children.map((c) => compToSQL(c, convert));
        return sql`(${sql.join(fragments, " AND ")})`;
      }
      case "or": {
        if (spec.children.length === 0) return sql`1=0`;
        const fragments = spec.children.map((c) => compToSQL(c, convert));
        return sql`(${sql.join(fragments, " OR ")})`;
      }
      case "not": {
        const child = compToSQL(spec.child, convert);
        return sql`NOT (${child})`;
      }
    }
  }
  return convert(spec as T);
}

export function dateFromSQL(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function dateToSQL(value: Date): string {
  return value.toISOString();
}

/**
 * `Sort.order` を SQLFragment に安全変換する。`"asc" | "desc"` 以外の値が runtime
 * で入ってきた場合 (外部入力を型キャストしたケースなど) は throw して fail-closed。
 * `sql.raw` の引数は常にコード上のリテラル文字列で、動的値が流入しない。
 */
export function sortDirection(order: "asc" | "desc"): SQLFragment {
  if (order === "asc") return sql.raw("ASC");
  if (order === "desc") return sql.raw("DESC");
  throw new Error(`Invalid sort order: ${String(order)}`);
}

/**
 * `Sort<K>` から ORDER BY 句の SQLFragment を組み立てる。`columnFor` は各 entity の
 * `common.ts` が提供する key → SQLFragment マッピング関数で、switch + throw で
 * 安全化されている前提。動的な `sort.keys` / `sort.order` は **必ずこの経路を通して**
 * 個別の安全な SQLFragment に変換される。
 */
export function orderByClause<K extends string>(
  sort: Sort<K>,
  columnFor: (k: K) => SQLFragment,
): SQLFragment {
  const direction = sortDirection(sort.order);
  const fragments = sort.keys.map((k) => sql`${columnFor(k)} ${direction}`);
  return sql.join(fragments, ", ");
}
