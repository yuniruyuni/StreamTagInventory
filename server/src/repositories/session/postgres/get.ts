import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL } from "@/infra/db/sql-helpers";
import type { Comp } from "@/models/common";
import type { Session } from "@/models/session";
import { rowToSession, type SessionRow, sessionSpecToSQL } from "./common";

export async function get(
  db: Database,
  spec: Comp<Session.Spec>,
): Promise<Session | null> {
  const where = compToSQL(
    spec,
    sessionSpecToSQL as (s: unknown) => SQLFragment,
  );
  const row = await db.queryGet<SessionRow>(
    sql`SELECT * FROM sessions WHERE ${where} LIMIT 1`,
  );
  return row ? rowToSession(row) : null;
}
