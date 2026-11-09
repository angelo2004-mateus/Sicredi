import { app } from "./app.js";
import { env } from "./config/env.js";
import { db } from "./config/database.js";
import { logger } from "./utils/logger.js";

await db.$connect();

const server = app.listen(env.PORT, "0.0.0.0", () =>
  logger.info({ port: env.PORT }, "api_started"),
);

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;

  shuttingDown = true;

  const timeout = setTimeout(() => process.exit(1), 10000).unref();

  server.close(() => {
    void db.$disconnect().finally(() => {
      clearTimeout(timeout);
      process.exit(0);
    });
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
