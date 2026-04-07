import type { QueryResultRow } from "pg";
import type { SQLFragment } from "./sql";

export interface Database {
  queryGet<T extends QueryResultRow>(fragment: SQLFragment): Promise<T | null>;
  queryAll<T extends QueryResultRow>(fragment: SQLFragment): Promise<T[]>;
  queryRun(fragment: SQLFragment): Promise<{ rowCount: number }>;
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
  readTransaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
