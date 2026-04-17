import type { Database } from "@/infra/db/database";
import { sql } from "@/infra/db/sql";
import { dateToSQL } from "@/infra/db/sql-helpers";
import type { TemplateDoc } from "@/models/templateDoc";

export async function upsert(db: Database, doc: TemplateDoc): Promise<void> {
  await db.queryRun(sql`
    INSERT INTO template_docs (user_id, state, size_bytes, updated_at)
    VALUES (
      ${doc.userId},
      ${Buffer.from(doc.state)},
      ${doc.sizeBytes},
      ${dateToSQL(doc.updatedAt)}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      state = EXCLUDED.state,
      size_bytes = EXCLUDED.size_bytes,
      updated_at = EXCLUDED.updated_at
  `);
}
