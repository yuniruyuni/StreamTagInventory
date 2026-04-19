import { type SQLFragment, sql } from "@/infra/db/sql";
import { dateFromSQL, dateToSQL } from "@/infra/db/sql-helpers";
import type { Session } from "@/models/session";

export interface SessionRow {
  id: string;
  user_id: string;
  /** sha256(raw bearer token) の base64url。ADR 0006。 */
  token_hash: string;
  created_at: Date | string;
  expires_at: Date | string;
  last_seen_at: Date | string;
}

export function sessionSpecToSQL(spec: Session.Spec): SQLFragment {
  switch (spec.type) {
    case "ById":
      return sql`id = ${spec.id}`;
    case "ByUserId":
      return sql`user_id = ${spec.userId}`;
    case "ByTokenHash":
      return sql`token_hash = ${spec.tokenHash}`;
    case "ActiveAt":
      return sql`expires_at > ${dateToSQL(spec.activeAt)}`;
    case "Expired":
      return sql`expires_at <= now()`;
  }
}

export function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: dateFromSQL(row.created_at),
    expiresAt: dateFromSQL(row.expires_at),
    lastSeenAt: dateFromSQL(row.last_seen_at),
  };
}

/**
 * ORDER BY 用のカラム識別子。動的値の挿入を避けるため switch で閉じ込める。
 */
export function columnName(key: Session.SortKey): SQLFragment {
  switch (key) {
    case "createdAt":
      return sql.raw("created_at");
    case "lastSeenAt":
      return sql.raw("last_seen_at");
    case "id":
      return sql.raw("id");
  }
  throw new Error(`Invalid sort key: ${String(key)}`);
}
