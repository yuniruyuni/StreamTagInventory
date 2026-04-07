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
        console.warn(formatted, ...args);
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
