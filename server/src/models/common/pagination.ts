export interface Cursor<T extends string> {
  limit: number;
  after?: Record<T, string>;
  sort?: Sort<T>;
}

export interface Sort<T extends string> {
  keys: readonly T[];
  order: "asc" | "desc";
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: Record<string, string>;
}
