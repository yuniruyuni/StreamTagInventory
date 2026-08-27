import type { ILogger } from "./types";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements ILogger {
  private readonly prefix: string;
  private readonly minLevel: LogLevel;

  constructor(options: { prefix?: string; minLevel?: LogLevel } = {}) {
    this.prefix = options.prefix ?? "";
    this.minLevel = options.minLevel ?? "info";
  }

  debug(message: string, ...args: unknown[]): void {
    this.log("debug", message, args);
  }
  info(message: string, ...args: unknown[]): void {
    this.log("info", message, args);
  }
  warn(message: string, ...args: unknown[]): void {
    this.log("warn", message, args);
  }
  error(message: string, ...args: unknown[]): void {
    this.log("error", message, args);
  }

  child(prefix: string): ILogger {
    const newPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new ConsoleLogger({ prefix: newPrefix, minLevel: this.minLevel });
  }

  private log(level: LogLevel, message: string, args: unknown[]): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const formatted = this.prefix ? `[${this.prefix}] ${message}` : message;
    switch (level) {
      case "debug":
        console.debug(formatted, ...args);
        break;
      case "info":
        console.log(formatted, ...args);
        break;
      case "warn":
        // console.warn は stderr へ書く。コンテナの stderr は journald が
        // 一律 err として受けるので、warn が err として積み上がり、本物の
        // 異常がその中に埋もれる (実測で 1 日 25,000 行が warn だった)。
        //
        // systemd の <N> 接頭辞は使えない。podman はそれを解釈せず、文字列の
        // まま通す (実機で確認した)。振り分けられるのは stdout か stderr かだけ。
        //
        // 印を残して stdout へ出す。優先度では区別できなくなるが、grep で
        // 引ける。err が本当に err だけになることの方が価値が大きい。
        console.log(`[warn] ${formatted}`, ...args);
        break;
      case "error":
        console.error(formatted, ...args);
        break;
    }
  }
}

export function createLogger(): ILogger {
  return new ConsoleLogger();
}
