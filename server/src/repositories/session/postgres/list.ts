import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL, orderByClause } from "@/infra/db/sql-helpers";
import type { Comp, Cursor, Page } from "@/models/common";
import { Session } from "@/models/session";
import {
  columnName,
  rowToSession,
  type SessionRow,
  sessionSpecToSQL,
} from "./common";

export async function list(
  db: Database,
  spec: Comp<Session.Spec>,
  cursor: Cursor<Session.SortKey>,
): Promise<Page<Session>> {
  const where = compToSQL(
    spec,
    sessionSpecToSQL as (s: unknown) => SQLFragment,
  );
  const sort = cursor.sort ?? {
    keys: ["createdAt", "id"] as const,
    order: "desc" as const,
  };
  const orderBy = orderByClause(sort, columnName);
  const limit = cursor.limit + 1;

  const rows = await db.queryAll<SessionRow>(
    sql`SELECT * FROM sessions WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit}`,
  );

  const hasMore = rows.length > cursor.limit;
  const items = rows.slice(0, cursor.limit).map(rowToSession);
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem ? Session.cursor(lastItem, sort.keys) : undefined;

  return { items, hasMore, nextCursor };
}
