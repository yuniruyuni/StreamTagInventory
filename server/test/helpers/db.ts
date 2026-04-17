import { join } from "node:path";
import type { Database } from "@/infra/db/database";
import { PgDatabase } from "@/infra/db/pg-client";
import { sql } from "@/infra/db/sql";
import { applyPgSchema } from "./pgschema";
import { EmbeddedPostgresManager } from "./postgres";

let pgManager: EmbeddedPostgresManager | null = null;
let initPromise: Promise<PgDatabase> | null = null;

const DEFAULT_DATA_DIR = join(import.meta.dir, "../../.test-pg-data");
const SCHEMA_MAIN = join(import.meta.dir, "../../../schema/main.sql");

async function doInit(dataDir: string): Promise<PgDatabase> {
  pgManager = new EmbeddedPostgresManager({ dataDir });
  await pgManager.start();
  const db = new PgDatabase(pgManager.poolConfig);

  // Check if schema is already applied. Use the most recently added table as sentinel.
  // When adding a new table, update this check to reference that table.
  const result = await db.queryGet<{ exists: boolean }>(
    sql`SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'template_docs'
    )`,
  );

  if (!result?.exists) {
    // 本番 migration と同じ pgschema バイナリを呼ぶ。自作のパーサで
    // `\i tables/` を inline するより、実際の pgschema 挙動 (declarative diff /
    // shadow schema / FK 順序解決) を再現できる。
    await applyPgSchema({
      connection: pgManager.connectionParams,
      schemaMainPath: SCHEMA_MAIN,
    });
  }

  return db;
}

function ensureReady(dataDir: string): Promise<PgDatabase> {
  if (!initPromise) {
    initPromise = doInit(dataDir);
  }
  return initPromise;
}

/**
 * Get a PgDatabase for tests. Starts embedded-postgres on first call and
 * applies the schema via pgschema, then caches the connection for subsequent
 * calls. Truncates all tables for isolation between tests (CASCADE for FK chains).
 */
export async function createTestDB(options?: {
  dataDir?: string;
}): Promise<PgDatabase> {
  const db = await ensureReady(options?.dataDir ?? DEFAULT_DATA_DIR);

  await db.queryRun(
    sql`TRUNCATE TABLE template_docs, sessions, oidc_nonces, users CASCADE`,
  );

  return db;
}

/**
 * No-op for backwards compatibility. The shared connection is kept alive
 * across tests; embedded-postgres is shut down via the exit handler in
 * EmbeddedPostgresManager.
 */
export async function closeTestDB(_db: Database): Promise<void> {}
