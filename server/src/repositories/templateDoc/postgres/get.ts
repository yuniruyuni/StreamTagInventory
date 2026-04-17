import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL } from "@/infra/db/sql-helpers";
import type { Comp } from "@/models/common";
import type { TemplateDoc } from "@/models/templateDoc";
import {
  rowToTemplateDoc,
  type TemplateDocRow,
  templateDocSpecToSQL,
} from "./common";

export async function get(
  db: Database,
  spec: Comp<TemplateDoc.Spec>,
  opts: { forUpdate: boolean },
): Promise<TemplateDoc | null> {
  const where = compToSQL(
    spec,
    templateDocSpecToSQL as (s: unknown) => SQLFragment,
  );
  const base = sql`SELECT * FROM template_docs WHERE ${where} LIMIT 1`;
  const query = opts.forUpdate ? sql`${base} FOR UPDATE` : base;
  const row = await db.queryGet<TemplateDocRow>(query);
  return row ? rowToTemplateDoc(row) : null;
}
