import pg, { type PoolClient, type QueryResultRow } from "pg";
import type { Database } from "./database";
import type { SQLFragment } from "./sql";

type Queryable = pg.Pool | PoolClient;

export class PgDatabase implements Database {
  private queryable: Queryable;
  private isPool: boolean;

  constructor(config: pg.PoolConfig);
  constructor(client: PoolClient);
  constructor(configOrClient: pg.PoolConfig | PoolClient) {
    if ("query" in configOrClient && "release" in configOrClient) {
      this.queryable = configOrClient;
      this.isPool = false;
    } else {
      this.queryable = new pg.Pool(configOrClient);
      this.isPool = true;
    }
  }

  async queryGet<T extends QueryResultRow>(
    fragment: SQLFragment,
  ): Promise<T | null> {
    const { query, params } = finalize(fragment);
    const result = await this.queryable.query<T>(query, params);
    return result.rows[0] ?? null;
  }

  async queryAll<T extends QueryResultRow>(
    fragment: SQLFragment,
  ): Promise<T[]> {
    const { query, params } = finalize(fragment);
    const result = await this.queryable.query<T>(query, params);
    return result.rows;
  }

  async queryRun(fragment: SQLFragment): Promise<{ rowCount: number }> {
    const { query, params } = finalize(fragment);
    const result = await this.queryable.query(query, params);
    return { rowCount: result.rowCount ?? 0 };
  }

  async transaction<T>(fn: (tx: PgDatabase) => Promise<T>): Promise<T> {
    return this.runTransaction("BEGIN", fn);
  }

  async readTransaction<T>(fn: (tx: PgDatabase) => Promise<T>): Promise<T> {
    return this.runTransaction("BEGIN READ ONLY", fn);
  }

  private async runTransaction<T>(
    begin: string,
    fn: (tx: PgDatabase) => Promise<T>,
  ): Promise<T> {
    if (!this.isPool) {
      throw new Error("Cannot start a transaction on a PoolClient");
    }
    const pool = this.queryable as pg.Pool;
    const client = await pool.connect();
    try {
      await client.query(begin);
      const txDb = new PgDatabase(client);
      const result = await fn(txDb);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.isPool) {
      await (this.queryable as pg.Pool).end();
    }
  }
}

export function finalize(fragment: SQLFragment): {
  query: string;
  params: unknown[];
} {
  let index = 0;
  const query = fragment.query.replace(/\?/g, () => {
    index++;
    return `$${index}`;
  });
  return { query, params: fragment.params };
}
