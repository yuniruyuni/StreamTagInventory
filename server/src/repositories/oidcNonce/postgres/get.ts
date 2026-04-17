import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL } from "@/infra/db/sql-helpers";
import type { Comp } from "@/models/common";
import type { OidcNonce } from "@/models/oidcNonce";
import {
  type OidcNonceRow,
  oidcNonceSpecToSQL,
  rowToOidcNonce,
} from "./common";

export async function get(
  db: Database,
  spec: Comp<OidcNonce.Spec>,
): Promise<OidcNonce | null> {
  const where = compToSQL(
    spec,
    oidcNonceSpecToSQL as (s: unknown) => SQLFragment,
  );
  const row = await db.queryGet<OidcNonceRow>(
    sql`SELECT * FROM oidc_nonces WHERE ${where} LIMIT 1`,
  );
  return row ? rowToOidcNonce(row) : null;
}
