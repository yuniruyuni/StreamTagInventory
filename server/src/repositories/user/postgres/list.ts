import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL, orderByClause } from "@/infra/db/sql-helpers";
import type { Comp, Cursor, Page } from "@/models/common";
import { User } from "@/models/user";
import { columnName, rowToUser, type UserRow, userSpecToSQL } from "./common";

export async function list(
  db: Database,
  spec: Comp<User.Spec>,
  cursor: Cursor<User.SortKey>,
): Promise<Page<User>> {
  const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
  const sort = cursor.sort ?? {
    keys: ["createdAt", "id"] as const,
    order: "desc" as const,
  };
  const orderBy = orderByClause(sort, columnName);
  const limit = cursor.limit + 1;

  const rows = await db.queryAll<UserRow>(
    sql`SELECT * FROM users WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit}`,
  );

  const hasMore = rows.length > cursor.limit;
  const items = rows.slice(0, cursor.limit).map(rowToUser);
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem ? User.cursor(lastItem, sort.keys) : undefined;

  return { items, hasMore, nextCursor };
}
