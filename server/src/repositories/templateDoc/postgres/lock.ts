import type { Database } from "@/infra/db/database";
import { sql } from "@/infra/db/sql";

/**
 * User scope の advisory lock を現 transaction で取得する。commit/rollback で
 * 自動解放。同一 userId の並行 write を直列化する。
 *
 * `hashtextextended(text, bigint)` で UUID 文字列を bigint にマップし、
 * `pg_advisory_xact_lock(bigint)` の単一引数版を使う。hash 衝突は理論上
 * ある (2^64 空間のうち 2^122 入力) が、同一衝突ユーザー同士が同時に書く
 * 確率は事実上ゼロ。衝突しても「無関係な 2 ユーザーの tx が直列化される」
 * だけで data correctness は保たれる。
 */
export async function lockByUserId(
  db: Database,
  userId: string,
): Promise<void> {
  await db.queryRun(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))
  `);
}
