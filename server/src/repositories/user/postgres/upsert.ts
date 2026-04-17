import type { Database } from "@/infra/db/database";
import { sql } from "@/infra/db/sql";
import { dateToSQL } from "@/infra/db/sql-helpers";
import type { User } from "@/models/user";

export async function upsert(db: Database, user: User): Promise<void> {
  await db.queryRun(sql`
    INSERT INTO users (id, twitch_user_id, login, display_name, created_at, updated_at, last_login_at)
    VALUES (
      ${user.id},
      ${user.twitchUserId},
      ${user.login},
      ${user.displayName},
      ${dateToSQL(user.createdAt)},
      ${dateToSQL(user.updatedAt)},
      ${dateToSQL(user.lastLoginAt)}
    )
    ON CONFLICT (twitch_user_id) DO UPDATE SET
      login = EXCLUDED.login,
      display_name = EXCLUDED.display_name,
      updated_at = EXCLUDED.updated_at,
      last_login_at = EXCLUDED.last_login_at
  `);
}
