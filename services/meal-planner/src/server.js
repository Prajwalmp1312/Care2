const app = require("./app");
const config = require("./config");
const logger = require("./lib/logger");
const { initializeDB, initialize360DB } = require("./lib/db");
const { ensureUploadsDir } = require("./middleware/upload");

async function start() {
  await ensureUploadsDir();
  await initializeDB();
  await initialize360DB();

  const server = app.listen(config.port, () => {
    logger.info(`Meal Planner API listening on port ${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  ["SIGTERM", "SIGINT"].forEach((s) => process.on(s, () => shutdown(s)));
}

start().catch((err) => {
  logger.error({ err: err.message, stack: err.stack }, "Fatal startup error");
  process.exit(1);
});
