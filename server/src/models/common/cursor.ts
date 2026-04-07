export interface Sort<T extends string> {
  key: T;
  direction: "asc" | "desc";
}

export interface Cursor<T extends string> {
  limit: number;
  after?: Record<T, string>;
  sort?: Sort<T>;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: Record<string, string>;
}
