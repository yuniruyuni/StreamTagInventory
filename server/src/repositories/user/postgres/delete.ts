import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL } from "@/infra/db/sql-helpers";
import type { Comp } from "@/models/common";
import type { User } from "@/models/user";
import { userSpecToSQL } from "./common";

export async function del(
  db: Database,
  spec: Comp<User.Spec>,
): Promise<number> {
  const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
  const { rowCount } = await db.queryRun(sql`DELETE FROM users WHERE ${where}`);
  return rowCount;
}
