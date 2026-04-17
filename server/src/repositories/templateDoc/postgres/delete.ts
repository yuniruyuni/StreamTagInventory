import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL } from "@/infra/db/sql-helpers";
import type { Comp } from "@/models/common";
import type { TemplateDoc } from "@/models/templateDoc";
import { templateDocSpecToSQL } from "./common";

export async function del(
  db: Database,
  spec: Comp<TemplateDoc.Spec>,
): Promise<number> {
  const where = compToSQL(
    spec,
    templateDocSpecToSQL as (s: unknown) => SQLFragment,
  );
  const { rowCount } = await db.queryRun(
    sql`DELETE FROM template_docs WHERE ${where}`,
  );
  return rowCount;
}
