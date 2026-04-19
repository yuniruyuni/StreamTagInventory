import type { Database } from "@/infra/db/database";
import { sql } from "@/infra/db/sql";
import { dateToSQL } from "@/infra/db/sql-helpers";
import type { Session } from "@/models/session";

export async function upsert(db: Database, session: Session): Promise<void> {
  // ON CONFLICT(id) で token_hash は更新しない。cookie rotation は別 usecase
  // で新しい session row を発行する想定 (同じ id に別 token_hash を上書きする
  // 運用は想定しない。ADR 0005)。
  await db.queryRun(sql`
    INSERT INTO sessions (id, user_id, token_hash, csrf_token, created_at, expires_at, last_seen_at)
    VALUES (
      ${session.id},
      ${session.userId},
      ${session.tokenHash},
      ${session.csrfToken.toBase64url()},
      ${dateToSQL(session.createdAt)},
      ${dateToSQL(session.expiresAt)},
      ${dateToSQL(session.lastSeenAt)}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      csrf_token = EXCLUDED.csrf_token,
      expires_at = EXCLUDED.expires_at,
      last_seen_at = EXCLUDED.last_seen_at
  `);
}
