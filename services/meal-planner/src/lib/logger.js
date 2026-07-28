const pino = require("pino");
const config = require("../config");

// Structured logging. Pretty in dev, JSON in production.
const logger = pino({
  level: process.env.LOG_LEVEL || (config.env === "production" ? "info" : "debug"),
  transport:
    config.env === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } },
});

module.exports = logger;
