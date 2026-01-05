const notificationController = require("../controllers/notification.controller");
const { authenticate, authorize } = require("../middlewares/auth");

module.exports = (app) => {
  const router = require("express").Router();

  // ===== Push Token Management =====
  
  /**
   * @route   POST /notifications/token
   * @desc    Register a push token for the authenticated user
   * @access  Private
   */
  router.post("/token", authenticate, notificationController.registerToken);

  /**
   * @route   DELETE /notifications/token
   * @desc    Unregister a push token
   * @access  Private
   */
  router.delete("/token", authenticate, notificationController.unregisterToken);

  /**
   * @route   PUT /notifications/preferences
   * @desc    Update notification preferences
   * @access  Private
   */
  router.put("/preferences", authenticate, notificationController.updatePreferences);

  // ===== User Notifications =====

  /**
   * @route   GET /notifications
   * @desc    Get user's notifications with pagination
   * @access  Private
   */
  router.get("/", authenticate, notificationController.getNotifications);

  /**
   * @route   PUT /notifications/:notificationId/read
   * @desc    Mark a notification as read
   * @access  Private
   */
  router.put("/:notificationId/read", authenticate, notificationController.markAsRead);

  /**
   * @route   PUT /notifications/read-all
   * @desc    Mark all notifications as read
   * @access  Private
   */
  router.put("/read-all", authenticate, notificationController.markAllAsRead);

  /**
   * @route   DELETE /notifications/:notificationId
   * @desc    Delete a notification
   * @access  Private
   */
  router.delete("/:notificationId", authenticate, notificationController.deleteNotification);

  // ===== Admin/System Routes =====

  /**
   * @route   POST /notifications/send
   * @desc    Send a notification to a specific user
   * @access  Private (Admin)
   */
  router.post("/send", authenticate, notificationController.sendNotification);

  /**
   * @route   POST /notifications/broadcast
   * @desc    Send notification to multiple users
   * @access  Private (Admin)
   */
  router.post("/broadcast", authenticate, notificationController.broadcastNotification);

  /**
   * @route   GET /notifications/stats
   * @desc    Get notification statistics
   * @access  Private (Admin)
   */
  router.get("/stats", authenticate, notificationController.getStats);

  // Register routes
  app.use("/notifications", router);
};

