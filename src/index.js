const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

let db = require("../src/models");

const app = express();
const PORT = process.env.SERVERPORT || 8080;

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve uploaded files (important for images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect to database (don't use alter in production - it causes issues on serverless)
db.sequelize.authenticate()
  .then(() => {
    console.log("✅ Database Connected...");
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err.message);
  });

// Import routes
require("./routes/index")(app);

// Example API route
app.get("/api/data", (req, res) => {
  res.json({ message: "Hello from simple Node project!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
