const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Force database schema sync on startup to add any missing columns (v2)

const db = require("../src/models");
const logger = require("./utils/logger");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");
const { sanitize } = require("./middlewares/validate");

const app = express();
const PORT = process.env.SERVERPORT || 8080;

// Security Middleware
app.use(helmet()); // Set security HTTP headers

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));

// Request Logging
if (process.env.ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Sanitize request body
app.use(sanitize);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Root Endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Create App Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      api: "/api/*",
    },
    timestamp: new Date().toISOString(),
  });
});

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Database Sync Endpoint (one-time use to add missing columns)
app.get("/sync-db", async (req, res) => {
  try {
    await db.sequelize.sync({ alter: true });
    res.status(200).json({
      success: true,
      message: "Database schema synced successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database sync failed: " + error.message,
    });
  }
});

// Database Connection
db.sequelize
  .authenticate()
  .then(() => {
    logger.info("Database connected successfully");
    // Sync database schema (alter: true adds missing columns without dropping data)
    return db.sequelize.sync({ alter: true });
  })
  .then(() => {
    logger.info("Database schema synced successfully");
  })
  .catch((err) => {
    logger.error("Database connection failed", { error: err.message });
  });

// Import Routes
require("./routes/index")(app);

// Example API route
app.get("/api/data", (req, res) => {
  res.json({ message: "Hello from Create Backend API!" });
});

// Handle 404 - Route not found
app.use(notFoundHandler);

// Global Error Handler (must be last)
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason: reason?.toString() });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error: error.message });
  process.exit(1);
});

module.exports = app;
