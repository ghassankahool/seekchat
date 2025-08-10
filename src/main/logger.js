const electronLog = require("electron-log");
const path = require("path");
const { app } = require("electron");

// Configure log file
electronLog.transports.file.resolvePathFn = () => {
  // Get user data path
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "logs/main.log");
};

// Configure log format
electronLog.transports.file.format =
  "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";

// Set log file size limit to 10MB
electronLog.transports.file.maxSize = 10 * 1024 * 1024;

// Set to keep the latest 5 log files
electronLog.transports.file.maxFiles = 5;

// Configure console output
electronLog.transports.console.format = "[{level}] {text}";

// Set log level
electronLog.transports.file.level = "info";
electronLog.transports.console.level = "debug";

// Create a wrapper that outputs to both console and file
const logger = {
  error: (...params) => {
    electronLog.error(...params);
  },
  warn: (...params) => {
    electronLog.warn(...params);
  },
  info: (...params) => {
    electronLog.info(...params);
  },
  verbose: (...params) => {
    electronLog.verbose(...params);
  },
  debug: (...params) => {
    electronLog.debug(...params);
  },
  silly: (...params) => {
    electronLog.silly(...params);
  },
  // Catch unhandled exceptions and Promise rejections
  catchErrors: () => {
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception:", error);
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Promise rejection:", reason);
    });
  },
};

module.exports = logger;
