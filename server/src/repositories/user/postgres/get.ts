import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL } from "@/infra/db/sql-helpers";
import type { Comp } from "@/models/common";
import type { User } from "@/models/user";
import { rowToUser, type UserRow, userSpecToSQL } from "./common";

export async function get(
  db: Database,
  spec: Comp<User.Spec>,
): Promise<User | null> {
  const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
  const row = await db.queryGet<UserRow>(
    sql`SELECT * FROM users WHERE ${where} LIMIT 1`,
  );
  return row ? rowToUser(row) : null;
}
