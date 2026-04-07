import type { ILogger } from "../logger/types";
import { PgDatabase } from "./pg-client";

export type { Database } from "./database";
export { PgDatabase } from "./pg-client";
export { type SQLFragment, sql } from "./sql";

let db: PgDatabase | null = null;

export function getDatabase(): PgDatabase {
  if (!db)
    throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

export async function initDatabase(logger: ILogger): Promise<PgDatabase> {
  const log = logger.child("Database");

  const host = process.env.PGHOST ?? "localhost";
  const port = Number(process.env.PGPORT ?? 5432);
  const user = process.env.DB_APP_NAME ?? "twitch_tag_inventory";
  const password = process.env.DB_PASSWORD ?? "twitch_tag_inventory";
  const database = process.env.DB_APP_NAME ?? "twitch_tag_inventory";

  log.info(`Connecting to PostgreSQL at ${host}:${port}/${database}...`);
  db = new PgDatabase({ host, port, user, password, database });
  log.info("Database ready");

  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
