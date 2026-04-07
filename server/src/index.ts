import { createContext } from "./context";
import { closeDatabase, initDatabase } from "./infra/db";
import { createLogger } from "./infra/logger";
import { createApp } from "./presentation";

const logger = createLogger();
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
