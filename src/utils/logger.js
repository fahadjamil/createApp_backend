/**
 * Structured Logger
 * Provides consistent logging format across the application
 * In production, this can be extended to use Winston, Pino, or cloud logging services
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = process.env.LOG_LEVEL || (process.env.ENV === "production" ? "info" : "debug");

const shouldLog = (level) => {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
};

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`.trim();
};

const logger = {
  /**
   * Log error messages
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  error: (message, meta = {}) => {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message, meta));
    }
  },

  /**
   * Log warning messages
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  warn: (message, meta = {}) => {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, meta));
    }
  },

  /**
   * Log info messages
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  info: (message, meta = {}) => {
    if (shouldLog("info")) {
      console.log(formatMessage("info", message, meta));
    }
  },

  /**
   * Log debug messages
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  debug: (message, meta = {}) => {
    if (shouldLog("debug")) {
      console.log(formatMessage("debug", message, meta));
    }
  },

  /**
   * Log HTTP request
   * @param {object} req - Express request object
   * @param {object} extra - Additional data to log
   */
  request: (req, extra = {}) => {
    if (shouldLog("info")) {
      logger.info(`${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userId: req.user?.uid,
        ...extra,
      });
    }
  },

  /**
   * Log database operation
   * @param {string} operation - Operation name (CREATE, READ, UPDATE, DELETE)
   * @param {string} model - Model name
   * @param {object} meta - Additional metadata
   */
  db: (operation, model, meta = {}) => {
    if (shouldLog("debug")) {
      logger.debug(`DB ${operation} on ${model}`, meta);
    }
  },
};

module.exports = logger;

