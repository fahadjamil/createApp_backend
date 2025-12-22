const analyticsController = require("../controllers/analytics.controller");
const { verifyToken, optionalAuth } = require("../middlewares/auth");

module.exports = (app) => {
  // Public tracking endpoints (optional auth - works with or without token)
  app.post("/api/analytics/track", optionalAuth, analyticsController.trackEvent);
  app.post("/api/analytics/track-batch", optionalAuth, analyticsController.trackBatch);

  // Admin-only endpoints (require authentication)
  app.get("/api/analytics/summary", verifyToken, analyticsController.getSummary);
  app.get("/api/analytics/events", verifyToken, analyticsController.getEvents);
  app.get("/api/analytics/realtime", verifyToken, analyticsController.getRealtime);
  app.get("/api/analytics/session/:sessionId", verifyToken, analyticsController.getSessionJourney);
  app.get("/api/analytics/user/:userId", verifyToken, analyticsController.getUserAnalytics);
};

