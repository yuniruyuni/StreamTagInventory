export interface SQLFragment {
  readonly query: string;
  readonly params: unknown[];
}

function isFragment(value: unknown): value is SQLFragment {
  return (
    typeof value === "object" &&
    value !== null &&
    "query" in value &&
    "params" in value
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
  return { query: queryParts.join(""), params };
}

export namespace sql {
  export function join(
    fragments: SQLFragment[],
    separator: string,
  ): SQLFragment {
    if (fragments.length === 0) return { query: "", params: [] };
    const queries: string[] = [];
    const params: unknown[] = [];
    for (const f of fragments) {
      queries.push(f.query);
      params.push(...f.params);
    }
    return { query: queries.join(separator), params };
  }

  export function raw(query: string): SQLFragment {
    return { query, params: [] };
  }

  export function list(values: unknown[]): SQLFragment {
    return { query: values.map(() => "?").join(", "), params: values };
  }

  export function empty(): SQLFragment {
    return { query: "1=1", params: [] };
  }
}
