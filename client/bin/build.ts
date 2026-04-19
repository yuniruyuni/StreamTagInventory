#!/usr/bin/env bun
/**
 * bundle build wrapper。`bun build` に `--target=browser` と
 * `--define=process.env.X=...` を確実に付ける。
 *
 * 理由: `bun build` は既定で `process.env.X` を inline しない + browser 向け
 * polyfill も付けないため、bundle に裸の `process.env.X` が残り browser
 * 実行時に `process is not defined` で落ちる。ここで集約して解決する。
 *
 * 使い方:
 *   bun run bin/build.ts [--watch] [--minify] [--sourcemap=inline|external]
 *     [--entry=src/index.tsx] [--outdir=./static/] [--entry-naming=...]
 */
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    watch: { type: "boolean", default: false },
    minify: { type: "boolean", default: false },
    sourcemap: { type: "string" },
    entry: { type: "string", default: "src/index.tsx" },
    outdir: { type: "string", default: "./static/" },
    "entry-naming": { type: "string" },
  },
});

/**
 * **bundle に埋めてよいキーの allowlist**。
 *
 * `--define` は strict allowlist で、ここに列挙したキーだけが browser bundle
 * に inline される。これ以外の `process.env.X` はコード参照があっても値は
 * bundle に入らない (literal として残り、browser 実行時に crash する =
 * fail loud で誤漏洩を防ぐ)。
 *
 * キーを増やす場合は、その値が **OAuth client_id や URL のような公開情報**
 * であることを確認する。`BUN_PUBLIC_` prefix は業界慣行 (Bun / Vite /
 * Next.js `NEXT_PUBLIC_`) で「public 宣言」を意味し、operator が機密を
 * 誤ってこの prefix で設定しない運用前提。
 */
const TWITCH_CLIENT_ID =
  process.env.BUN_PUBLIC_TWITCH_CLIENT_ID ?? "d2kz8x5se7k6b1n0picux0r7kaozi3";
const APP_BASE_URL =
  process.env.BUN_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
const NODE_ENV = process.env.NODE_ENV ?? "development";

const defines: Record<string, string> = {
  "process.env.BUN_PUBLIC_TWITCH_CLIENT_ID": JSON.stringify(TWITCH_CLIENT_ID),
  "process.env.BUN_PUBLIC_APP_BASE_URL": JSON.stringify(APP_BASE_URL),
  "process.env.NODE_ENV": JSON.stringify(NODE_ENV),
};

const args: string[] = [
  "build",
  "--target=browser",
  `--outdir=${values.outdir}`,
];
if (values.watch) args.push("--watch");
if (values.minify) args.push("--minify");
if (values.sourcemap) args.push(`--sourcemap=${values.sourcemap}`);
if (values["entry-naming"])
  args.push(`--entry-naming=${values["entry-naming"]}`);
for (const [k, v] of Object.entries(defines)) {
  args.push(`--define=${k}=${v}`);
}
args.push(values.entry);

const child = spawn("bun", args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
