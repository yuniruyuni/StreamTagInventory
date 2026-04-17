import type { Database } from "@/infra/db/database";
import { type SQLFragment, sql } from "@/infra/db/sql";
import { compToSQL } from "@/infra/db/sql-helpers";
import type { Comp } from "@/models/common";
import type { OidcNonce } from "@/models/oidcNonce";
import { oidcNonceSpecToSQL } from "./common";

export async function del(
  db: Database,
  spec: Comp<OidcNonce.Spec>,
): Promise<number> {
  const where = compToSQL(
    spec,
    oidcNonceSpecToSQL as (s: unknown) => SQLFragment,
  );
  const { rowCount } = await db.queryRun(
    sql`DELETE FROM oidc_nonces WHERE ${where}`,
  );
  return rowCount;
}
