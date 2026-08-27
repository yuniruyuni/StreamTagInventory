import { afterEach, describe, expect, test } from "bun:test";
import { createLogger } from "./index";

/**
 * どの流れへ書くかが、そのまま journald の優先度になる。
 *
 * コンテナの stdout は info、stderr は err として受け取られる。systemd の
 * <N> 接頭辞は podman が解釈しないので (実機で確認した)、振り分けられるのは
 * 流れの選択だけになる。
 */
function capture(fn: () => void) {
  const out: string[] = [];
  const err: string[] = [];
  const log = console.log;
  const warn = console.warn;
  const error = console.error;
  console.log = (...a: unknown[]) => out.push(a.join(" "));
  console.warn = (...a: unknown[]) => err.push(a.join(" "));
  console.error = (...a: unknown[]) => err.push(a.join(" "));
  try {
    fn();
  } finally {
    console.log = log;
    console.warn = warn;
    console.error = error;
  }
  return { out, err };
}

afterEach(() => {});

describe("出力先", () => {
  // warn が stderr へ行くと err として積み上がり、本物の異常が埋もれる。
  // 実測で 1 日 25,000 行が warn だった。
  test("warn は stdout へ出す", () => {
    const { out, err } = capture(() => createLogger().warn("なにか"));
    expect(err).toEqual([]);
    expect(out.join()).toContain("なにか");
  });

  // 優先度では区別できなくなるので、印で引けるようにしておく。
  test("warn には印が残る", () => {
    const { out } = capture(() => createLogger().warn("なにか"));
    expect(out.join()).toContain("[warn]");
  });

  // ここだけが err になる。ここが薄まると -p err の意味が無くなる。
  test("error だけが stderr へ行く", () => {
    const { out, err } = capture(() => createLogger().error("こわれた"));
    expect(out).toEqual([]);
    expect(err.join()).toContain("こわれた");
  });

  test("info は stdout へ出す", () => {
    const { out, err } = capture(() => createLogger().info("ふつう"));
    expect(err).toEqual([]);
    expect(out.join()).toContain("ふつう");
  });
});
