import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { ILogger } from "../../infra/logger/types";
import { requestLog } from "./request-log";

function collector() {
  const lines: string[] = [];
  const logger: ILogger = {
    debug: () => {},
    info: (m: string) => lines.push(m),
    warn: (m: string) => lines.push(m),
    error: (m: string) => lines.push(`ERROR ${m}`),
    child: () => logger,
  };
  return { lines, logger };
}

function appWith(logger: ILogger) {
  const app = new Hono();
  app.use(requestLog(logger));
  app.get("/health", (c) => c.text("ok"));
  app.get("/api/x", (c) => c.text("ok"));
  app.get("/api/boom", (c) => c.text("no", 500));
  app.get("/api/bad", (c) => c.text("no", 400));
  return app;
}

describe("要求ログ", () => {
  test("経路と状態と所要時間が残る", async () => {
    const { lines, logger } = collector();
    await appWith(logger).request("/api/x");
    expect(lines[0]).toMatch(/method=GET/);
    expect(lines[0]).toMatch(/path=\/api\/x/);
    expect(lines[0]).toMatch(/status=200/);
    expect(lines[0]).toMatch(/ms=\d+/);
  });

  // 健康確認は 3 秒ごとに 2 系へ来る。残すと本物の記録が埋もれる。
  test("健康確認は残さない", async () => {
    const { lines, logger } = collector();
    await appWith(logger).request("/health");
    expect(lines).toEqual([]);
  });

  // 4xx は呼ぶ側の誤りで、こちらの異常ではない。error にすると本物が埋もれる。
  test("5xx だけを error にする", async () => {
    const { lines, logger } = collector();
    const app = appWith(logger);
    await app.request("/api/bad");
    await app.request("/api/boom");
    expect(lines[0]).not.toMatch(/^ERROR/);
    expect(lines[1]).toMatch(/^ERROR/);
  });

  // 問い合わせ文字列には資格情報が載ることがある。そのまま残すと配ってしまう。
  test("問い合わせ文字列は残さない", async () => {
    const { lines, logger } = collector();
    await appWith(logger).request("/api/x?token=secret-value");
    expect(lines[0]).not.toContain("secret-value");
  });
});
