import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL, orderByClause } from "@/infra/db/sql-helpers";
import type { Comp, Cursor, Page } from "@/models/common";
import { OidcNonce } from "@/models/oidcNonce";
import {
  columnName,
  type OidcNonceRow,
  oidcNonceSpecToSQL,
  rowToOidcNonce,
} from "./common";

export async function list(
  db: Database,
  spec: Comp<OidcNonce.Spec>,
  cursor: Cursor<OidcNonce.SortKey>,
): Promise<Page<OidcNonce>> {
  const where = compToSQL(
    spec,
    oidcNonceSpecToSQL as (s: unknown) => SQLFragment,
  );
  const sort = cursor.sort ?? {
    keys: ["createdAt", "nonce"] as const,
    order: "desc" as const,
  };
  const orderBy = orderByClause(sort, columnName);
  const limit = cursor.limit + 1;

  const rows = await db.queryAll<OidcNonceRow>(
    sql`SELECT * FROM oidc_nonces WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit}`,
  );

  const hasMore = rows.length > cursor.limit;
  const items = rows.slice(0, cursor.limit).map(rowToOidcNonce);
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem ? OidcNonce.cursor(lastItem, sort.keys) : undefined;

  return { items, hasMore, nextCursor };
}
