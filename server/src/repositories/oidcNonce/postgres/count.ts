import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL } from "@/infra/db/sql-helpers";
import type { Comp } from "@/models/common";
import type { OidcNonce } from "@/models/oidcNonce";
import { oidcNonceSpecToSQL } from "./common";

export async function count(
  db: Database,
  spec: Comp<OidcNonce.Spec>,
): Promise<number> {
  const where = compToSQL(
    spec,
    oidcNonceSpecToSQL as (s: unknown) => SQLFragment,
  );
  const row = await db.queryGet<{ count: string }>(
    sql`SELECT COUNT(*)::text AS count FROM oidc_nonces WHERE ${where}`,
  );
  return Number(row?.count ?? 0);
}
