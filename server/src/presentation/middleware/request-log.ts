/**
 * 要求ごとに 1 行残す。
 *
 * これが無いと、何が起きたのかを後から辿れない。経路 (HAProxy) のログにも
 * 要求は残るが、あちらから見えるのは外形だけで、アプリの中の事情は分からない。
 *
 * このアプリはトレースを入れていないので trace_id は載せない。載せるなら
 * ここで要求全体のスパンを張ることになる (StreamerPost はそうしている)。
 * 計装そのものが遅さの原因ではないかを調べている最中で、入れていない側を
 * 残しておくと比べられる。
 *
 * 形は logfmt にする。人が読めて、そのまま検索の条件にも使える。JSON は
 * 検索には向くが、journalctl で追うときに読みにくい。
 */
import type { Context, MiddlewareHandler } from "hono";
import type { ILogger } from "../../infra/logger/types";

/**
 * 記録しない経路。
 *
 * 健康確認は 3 秒ごとに 2 系へ来る。1 日 5 万行を超え、本物の記録がこの中に
 * 埋もれる。落ちていれば経路側の指標に出るので、ここで残す必要が無い。
 * /ready も同じ性質なので外す。
 */
const SKIP = new Set(["/health", "/ready"]);

/** logfmt の値。空白や引用符が入ると壊れるので、必要なときだけ括る。 */
function value(v: string | number): string {
  const s = String(v);
  return /[\s"=]/.test(s) ? JSON.stringify(s) : s;
}

export function requestLog(logger: ILogger): MiddlewareHandler {
  const log = logger.child("http");

  return async (c: Context, next) => {
    if (SKIP.has(c.req.path)) return next();

    const started = performance.now();
    try {
      await next();
    } finally {
      const status = c.res.status;
      const ms = Math.round(performance.now() - started);
      const fields: [string, string | number][] = [
        ["method", c.req.method],
        ["path", c.req.path],
        ["status", status],
        ["ms", ms],
      ];
      const line = fields.map(([k, v]) => `${k}=${value(v)}`).join(" ");
      // 5xx だけ error にする。4xx は呼ぶ側の誤りで、こちらの異常ではない。
      if (status >= 500) log.error(line);
      else log.info(line);
    }
  };
}
