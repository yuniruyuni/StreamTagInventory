/**
 * `SQLFragment` は **`sql\`\`` タグ / `sql.raw` / `sql.empty` / `sql.list` /
 * `sql.join` 経由でしか生成できない**。`Brand` symbol はこのモジュール外に
 * export しないため、外部コードが `{ query, params }` の素オブジェクトを
 * `SQLFragment` として渡そうとしても構造互換が成立しない。
 *
 * `db.queryXxx` に渡す SQL はすべてこのファクトリを通す必要があり、
 * 生文字列を混ぜたいときは **`sql.raw(...)` を使うことで「ここは
 * 安全性を呼出側が保証した」ことが視覚的に宣言される**。
 */
const Brand: unique symbol = Symbol("stream-tag-inventory.SQLFragment");

export interface SQLFragment {
  readonly [Brand]: true;
  readonly query: string;
  readonly params: readonly unknown[];
}

/** モジュール内部専用のファクトリ。外部から呼べないよう export しない。 */
function make(query: string, params: readonly unknown[]): SQLFragment {
  return { [Brand]: true, query, params };
}

function isFragment(value: unknown): value is SQLFragment {
  return (
    typeof value === "object" &&
    value !== null &&
    Brand in value &&
    (value as Record<symbol, unknown>)[Brand] === true
  );
}

export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SQLFragment {
  const queryParts: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    queryParts.push(strings[i]);
    if (i < values.length) {
      const value = values[i];
      if (isFragment(value)) {
        queryParts.push(value.query);
        params.push(...value.params);
      } else {
        queryParts.push("?");
        params.push(value);
      }
    }
  }
  return make(queryParts.join(""), params);
}

export namespace sql {
  export function join(
    fragments: SQLFragment[],
    separator: string,
  ): SQLFragment {
    if (fragments.length === 0) return make("", []);
    const queries: string[] = [];
    const params: unknown[] = [];
    for (const f of fragments) {
      queries.push(f.query);
      params.push(...f.params);
    }
    return make(queries.join(separator), params);
  }

  /**
   * 生の SQL 文字列を SQLFragment として包む。**呼出側が SQL injection 安全性を
   * 保証する責務を持つ** (user 入力を渡すのは原則禁止)。用途例: ORDER BY の
   * カラム名 / 方向など placeholder で表現できない構文要素の挿入。
   */
  export function raw(query: string): SQLFragment {
    return make(query, []);
  }

  export function list(values: unknown[]): SQLFragment {
    return make(values.map(() => "?").join(", "), values);
  }

  export function empty(): SQLFragment {
    return make("1=1", []);
  }
}
