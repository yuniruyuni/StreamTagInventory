import type { ILogger } from "../logger/types";
import { PgDatabase } from "./pg-client";
import { sql } from "./sql";

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
  const user = process.env.DB_USER ?? "stream_tag_inventory";
  // Cloud Run の secret 値は末尾改行を含む形で保管されており、env 注入時もそのまま
  // 乗ってくる。pg は trim しないため認証が "FATAL: password authentication failed"
  // で reject される。Secret 修正までの暫定として code 側で末尾の \r\n を落とす。
  const password = (process.env.DB_PASSWORD ?? "stream_tag_inventory").replace(
    /[\r\n]+$/,
    "",
  );
  const database = process.env.DB_NAME ?? "stream_tag_inventory";

  log.info(`Connecting to PostgreSQL at ${host}:${port}/${database}...`);
  db = new PgDatabase({ host, port, user, password, database });

  // 起動時に 1 回 `SELECT 1` を叩いて接続を実検証する。pg pool は lazy connect
  // なので、この確認をしないと起動ログが "Database ready" と嘘をつく一方で
  // 最初の実リクエストまで ECONNREFUSED が顕在化せず、原因特定が遅れる。
  //
  // ただし e2e / docker smoke test など「server は起動するが DB を要求しない」
  // シナリオでは startup 検証で fail-early されると困るので、`SKIP_DB_VERIFY=1`
  // が設定されていれば skip する。production では常に未設定にする。
  if (process.env.SKIP_DB_VERIFY !== "1") {
    try {
      await db.queryRun(sql`SELECT 1`);
    } catch (err) {
      log.error(`Database connection failed: ${String(err)}`);
      throw err;
    }
  } else {
    log.warn("SKIP_DB_VERIFY=1: skipping startup SELECT 1 (CI / smoke test)");
  }
  log.info("Database ready");

  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
