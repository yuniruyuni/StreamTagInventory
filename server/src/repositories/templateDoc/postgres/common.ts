import { type SQLFragment, sql } from "@/infra/db/sql";
import { dateFromSQL } from "@/infra/db/sql-helpers";
import type { TemplateDoc } from "@/models/templateDoc";

export interface TemplateDocRow {
  user_id: string;
  state: Buffer;
  size_bytes: number;
  updated_at: Date | string;
}

export function templateDocSpecToSQL(spec: TemplateDoc.Spec): SQLFragment {
  switch (spec.type) {
    case "ByUserId":
      return sql`user_id = ${spec.userId}`;
  }
}

export function rowToTemplateDoc(row: TemplateDocRow): TemplateDoc {
  return {
    userId: row.user_id,
    state: new Uint8Array(row.state),
    sizeBytes: row.size_bytes,
    updatedAt: dateFromSQL(row.updated_at),
  };
}
