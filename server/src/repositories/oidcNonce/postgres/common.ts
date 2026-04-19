import { type SQLFragment, sql } from "@/infra/db/sql";
import { dateFromSQL, dateToSQL } from "@/infra/db/sql-helpers";
import { Token } from "@/models/common";
import type { OidcNonce } from "@/models/oidcNonce";

export interface OidcNonceRow {
  /** DB 列は TEXT。Model の Token 内部表現 (base64url) と 1:1 対応する。 */
  nonce: string;
  created_at: Date | string;
  expires_at: Date | string;
}

export function oidcNonceSpecToSQL(spec: OidcNonce.Spec): SQLFragment {
  switch (spec.type) {
    case "ByValue":
      return sql`nonce = ${spec.nonce.toBase64url()}`;
    case "ActiveAt":
      return sql`expires_at > ${dateToSQL(spec.activeAt)}`;
    case "ExpiredAt":
      return sql`expires_at <= ${dateToSQL(spec.expiredAt)}`;
  }
}

export function rowToOidcNonce(row: OidcNonceRow): OidcNonce {
  return {
    nonce: Token.fromBase64url(row.nonce),
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
