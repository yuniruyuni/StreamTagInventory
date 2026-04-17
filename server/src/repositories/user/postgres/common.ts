import { type SQLFragment, sql } from "@/infra/db/sql";
import { dateFromSQL } from "@/infra/db/sql-helpers";
import type { User } from "@/models/user";

export interface UserRow {
  id: string;
  twitch_user_id: string;
  login: string;
  display_name: string;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string;
}

export function userSpecToSQL(spec: User.Spec): SQLFragment {
  switch (spec.type) {
    case "ById":
      return sql`id = ${spec.id}`;
    case "ByTwitchUserId":
      return sql`twitch_user_id = ${spec.twitchUserId}`;
  }
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    twitchUserId: row.twitch_user_id,
    login: row.login,
    displayName: row.display_name,
    createdAt: dateFromSQL(row.created_at),
    updatedAt: dateFromSQL(row.updated_at),
    lastLoginAt: dateFromSQL(row.last_login_at),
  };
}

/**
 * ORDER BY 等で使うカラム識別子を SQLFragment として返す。**`sql.raw` の引数は
 * コードリテラルのみで、key 由来の動的文字列を直接挿入しない**。dynamic cast で
 * 不正な key が入ってきた場合は throw して fail-closed にする。
 */
export function columnName(key: User.SortKey): SQLFragment {
  switch (key) {
    case "createdAt":
      return sql.raw("created_at");
    case "lastLoginAt":
      return sql.raw("last_login_at");
    case "id":
      return sql.raw("id");
  }
  throw new Error(`Invalid sort key: ${String(key)}`);
}
