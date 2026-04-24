import { describe, expect, test } from "bun:test";
import { silentLogger } from "@test/helpers/context";
import type { Database } from "@/infra/db/database";
import { fail, isFail } from "@/models/common/fail";
import { createRawRepos } from "@/repositories";
import { bindAllRepos, createFullCtx } from "@/repositories/common/capability";
import type { Context, TwitchConfig } from "./context";
import { usecase } from "./runner";

/**
 * Database の最小 stub。transaction / readTransaction は callback に自身を渡して
 * 即 invoke するだけ。queryGet 系は本テストでは repo を叩かないので no-op。
 * trace[] に tx 種別を記録しておき、phase × tx 境界の検証に使う。
 */
function createStubDb(): Database & { trace: string[] } {
  const trace: string[] = [];
  const db: Database = {
    queryGet: async () => null,
    queryAll: async () => [],
    queryRun: async () => ({ rowCount: 0 }),
    transaction: async <T>(fn: (tx: Database) => Promise<T>) => {
      trace.push("tx:start");
      const r = await fn(db);
      trace.push("tx:end");
      return r;
    },
    readTransaction: async <T>(fn: (tx: Database) => Promise<T>) => {
      trace.push("readTx:start");
      const r = await fn(db);
      trace.push("readTx:end");
      return r;
    },
    close: async () => {},
  };
  return Object.assign(db, { trace });
}

const twitch: TwitchConfig = {
  clientId: "test-client",
  jwks: async () => {
    throw new Error("jwks not used in runner tests");
  },
};

function makeCtx(db: Database & { trace: string[] }): Context {
  const rawRepos = createRawRepos();
  return {
    now: new Date("2026-01-01T00:00:00Z"),
    logger: silentLogger,
    db,
    rawRepos,
    repos: bindAllRepos(rawRepos, createFullCtx(db)),
    twitch,
  };
}

describe("usecase runner", () => {
  // phase の実行順序 / 各 phase に渡る state / result への projection が仕様通りに
  // 流れることを、外部 mutable な calls[] で観測する。中間の state 型は推論任せに
  // してジェネリクス 8 本を一切指定しない。
  test("all phases run in declared order; state flows through; result projects", async () => {
    const calls: string[] = [];
    const uc = usecase({
      pre: (_ctx, input: { n: number }) => {
        calls.push("pre");
        return { n: input.n + 1 };
      },
      read: (_ctx, s) => {
        calls.push("read");
        return { n: s.n + 1 };
      },
      process: (_ctx, s) => {
        calls.push("process");
        return { n: s.n + 1 };
      },
      write: (_ctx, s) => {
        calls.push("write");
        return { n: s.n + 1 };
      },
      post: (_ctx, s) => {
        calls.push("post");
        return { n: s.n + 1 };
      },
      finish: (_ctx, s) => {
        calls.push("finish");
        return { n: s.n + 1 };
      },
      result: (s) => {
        calls.push("result");
        return s.n;
      },
    });

    const ctx = makeCtx(createStubDb());
    const res = await uc.run(ctx, { n: 0 });

    expect(calls).toEqual([
      "pre",
      "read",
      "process",
      "write",
      "post",
      "finish",
      "result",
    ]);
    expect(res.ok).toBe(true);
    // 各 phase で +1 されて pre から finish まで 6 段。
    if (res.ok) expect(res.value).toBe(6);
  });

  test("write-phase usecase wraps read→process→write in a single transaction; finish uses a new transaction", async () => {
    const stubDb = createStubDb();
    const ctx = makeCtx(stubDb);
    const uc = usecase({
      read: () => ({ a: 1 }),
      process: (_c, s) => ({ ...s, b: 2 }),
      write: (_c, s) => ({ ...s, c: 3 }),
      finish: (_c, s) => ({ ...s, d: 4 }),
      result: (s) => JSON.stringify(s),
    });
    await uc.run(ctx);

    // tx:start → (read + process + write 中) → tx:end → (post 無し) → tx:start → (finish) → tx:end
    expect(stubDb.trace).toEqual(["tx:start", "tx:end", "tx:start", "tx:end"]);
  });

  test("read-only usecase (no write) uses readTransaction; process runs outside tx", async () => {
    const stubDb = createStubDb();
    const ctx = makeCtx(stubDb);
    let processCalledAfterReadTxEnd = false;

    const uc = usecase({
      read: () => {
        // read 実行中: readTx は開いたまま
        expect(stubDb.trace.at(-1)).toBe("readTx:start");
        return { value: 10 };
      },
      process: (_c, s) => {
        // process 実行中: readTx は閉じている (outside tx)
        processCalledAfterReadTxEnd = stubDb.trace.includes("readTx:end");
        return { value: s.value + 1 };
      },
      result: (s) => s.value,
    });

    const res = await uc.run(ctx);
    expect(stubDb.trace).toEqual(["readTx:start", "readTx:end"]);
    expect(processCalledAfterReadTxEnd).toBe(true);
    if (res.ok) expect(res.value).toBe(11);
  });

  test("process-only usecase (no read/write) does not open any transaction", async () => {
    const stubDb = createStubDb();
    const ctx = makeCtx(stubDb);
    // pre を identity で挟むのは TInput を型推論に乗せるため (他の phase の
    // signature は TInput を直接使わず Unfail<TPre> 経由で参照するので、
    // TInput が推論されないと TPre 以降も default で潰れてしまう)。
    const uc = usecase({
      pre: (_c, input: { n: number }) => input,
      process: (_c, s) => ({ n: s.n * 2 }),
      result: (s) => s.n,
    });

    const res = await uc.run(ctx, { n: 5 });
    expect(stubDb.trace).toEqual([]);
    if (res.ok) expect(res.value).toBe(10);
  });

  test("Fail returned from pre short-circuits before read/process/write run", async () => {
    const stubDb = createStubDb();
    const ctx = makeCtx(stubDb);
    const later: string[] = [];

    const uc = usecase({
      pre: () => fail("BAD_INPUT", "pre rejected"),
      read: () => {
        later.push("read");
        return {};
      },
      write: () => {
        later.push("write");
        return {};
      },
    });

    const res = await uc.run(ctx);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("BAD_INPUT");
      expect(res.error.message).toBe("pre rejected");
    }
    expect(later).toEqual([]);
    // pre 失敗なら transaction も開かない
    expect(stubDb.trace).toEqual([]);
  });

  test("Fail returned from write short-circuits before post/finish run", async () => {
    const stubDb = createStubDb();
    const ctx = makeCtx(stubDb);
    const later: string[] = [];

    const uc = usecase({
      read: () => ({ a: 1 }),
      write: () => fail("CONSTRAINT", "write rejected"),
      post: () => {
        later.push("post");
        return {};
      },
      finish: () => {
        later.push("finish");
        return {};
      },
    });

    const res = await uc.run(ctx);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("CONSTRAINT");
    expect(later).toEqual([]);
    // write が走る tx は開いて閉じる。finish 用の 2 つ目の tx は開かない
    expect(stubDb.trace).toEqual(["tx:start", "tx:end"]);
  });

  test("unhandled throw in a phase is caught and converted to INTERNAL Fail", async () => {
    const stubDb = createStubDb();
    const ctx = makeCtx(stubDb);
    const uc = usecase({
      pre: () => {
        throw new Error("boom");
      },
    });

    const res = await uc.run(ctx);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("INTERNAL");
      expect(isFail(res.error)).toBe(true);
    }
  });

  test("usecase without any phase returns input as-is; no transactions opened", async () => {
    const stubDb = createStubDb();
    const ctx = makeCtx(stubDb);
    const uc = usecase<{ greeting: string }>({});

    const res = await uc.run(ctx, { greeting: "hi" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual({ greeting: "hi" });
    expect(stubDb.trace).toEqual([]);
  });
});
