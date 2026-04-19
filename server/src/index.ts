import { createContext } from "./context";
import { closeDatabase, initDatabase } from "./infra/db";
import { createLogger } from "./infra/logger";
import { createApp } from "./presentation";

const logger = createLogger();

// 起動時に必須 env を検査。欠けているまま起動すると id_token の aud 検証が
// 通らず auth 全部が失敗するので、早期に throw して fail-fast させる。
const REQUIRED_ENV = ["TWITCH_CLIENT_ID"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`${key} environment variable is required`);
  }
}

const db = await initDatabase(logger);
const ctx = createContext(db, logger);

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp(ctx);

async function shutdown() {
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

logger.info(`Server running on http://localhost:${PORT}`);

export default {
  hostname: "0.0.0.0",
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 120,
};
