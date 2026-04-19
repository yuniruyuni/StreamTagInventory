import type { Database } from "@/infra/db/database";
import { sql } from "@/infra/db/sql";
import { dateToSQL } from "@/infra/db/sql-helpers";
import type { OidcNonce } from "@/models/oidcNonce";

export async function upsert(db: Database, nonce: OidcNonce): Promise<void> {
  await db.queryRun(sql`
    INSERT INTO oidc_nonces (nonce, created_at, expires_at)
    VALUES (
      ${nonce.nonce.toBase64url()},
      ${dateToSQL(nonce.createdAt)},
      ${dateToSQL(nonce.expiresAt)}
    )
    ON CONFLICT (nonce) DO UPDATE SET
      expires_at = EXCLUDED.expires_at
  `);
}
