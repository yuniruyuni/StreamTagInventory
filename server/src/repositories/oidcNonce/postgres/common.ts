import { type SQLFragment, sql } from "@/infra/db/sql";
import { dateFromSQL, dateToSQL } from "@/infra/db/sql-helpers";
import type { OidcNonce } from "@/models/oidcNonce";

export interface OidcNonceRow {
  nonce: string;
  created_at: Date | string;
  expires_at: Date | string;
}

export function oidcNonceSpecToSQL(spec: OidcNonce.Spec): SQLFragment {
  switch (spec.type) {
    case "ByValue":
      return sql`nonce = ${spec.nonce}`;
    case "ActiveAt":
      return sql`expires_at > ${dateToSQL(spec.activeAt)}`;
    case "ExpiredAt":
      return sql`expires_at <= ${dateToSQL(spec.expiredAt)}`;
  }
}

export function rowToOidcNonce(row: OidcNonceRow): OidcNonce {
  return {
    nonce: row.nonce,
    createdAt: dateFromSQL(row.created_at),
    expiresAt: dateFromSQL(row.expires_at),
  };
}

/**
 * ORDER BY 用のカラム識別子。動的値の挿入を避けるため switch で閉じ込める。
 */
export function columnName(key: OidcNonce.SortKey): SQLFragment {
  switch (key) {
    case "createdAt":
      return sql.raw("created_at");
    case "nonce":
      return sql.raw("nonce");
  }
  throw new Error(`Invalid sort key: ${String(key)}`);
}
