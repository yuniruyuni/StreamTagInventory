import type { Database } from "@/infra/db/database";
import { sql } from "@/infra/db/sql";
import { dateToSQL } from "@/infra/db/sql-helpers";
import type { Session } from "@/models/session";

export async function upsert(db: Database, session: Session): Promise<void> {
  // ON CONFLICT(id) で token_hash は更新しない。bearer token rotation は
  // 別 usecase (新しい login 時に新 session 行を作る) として扱う。
  await db.queryRun(sql`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
    VALUES (
      ${session.id},
      ${session.userId},
      ${session.tokenHash},
      ${dateToSQL(session.createdAt)},
      ${dateToSQL(session.expiresAt)},
      ${dateToSQL(session.lastSeenAt)}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      expires_at = EXCLUDED.expires_at,
      last_seen_at = EXCLUDED.last_seen_at
  `);
}
