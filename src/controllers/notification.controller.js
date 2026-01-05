const db = require("../models");
const { Expo } = require("expo-server-sdk");

const PushToken = db.PushToken;
const Notification = db.Notification;
const User = db.User;

const asyncHandler = require("../middlewares/asyncHandler");
const {
  BadRequestError,
  NotFoundError,
} = require("../middlewares/errorHandler");
const logger = require("../utils/logger");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");

// Initialize Expo SDK
const expo = new Expo();

/**
 * @desc    Register push token for a user
 * @route   POST /notifications/token
 * @access  Private
 */
exports.registerToken = asyncHandler(async (req, res) => {
  const { token, platform, deviceId, deviceName, preferences } = req.body;
  const userId = req.user.uid;

  if (!token) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Push token"));
  }

  // Validate Expo push token format
  if (!Expo.isExpoPushToken(token)) {
    throw new BadRequestError("Invalid Expo push token format");
  }

  logger.info("Registering push token", { userId, platform, deviceId });

  // Check if token already exists for this user
  let pushToken = await PushToken.findOne({
    where: { userId, token },
  });

  if (pushToken) {
    // Update existing token
    await pushToken.update({
      platform: platform || pushToken.platform,
      deviceId: deviceId || pushToken.deviceId,
      deviceName: deviceName || pushToken.deviceName,
      preferences: preferences || pushToken.preferences,
      isActive: true,
      lastUsedAt: new Date(),
    });

    logger.info("Push token updated", { userId, tokenId: pushToken.id });
  } else {
    // Create new token entry
    pushToken = await PushToken.create({
      userId,
      token,
      platform: platform || "android",
      deviceId,
      deviceName,
      preferences,
      lastUsedAt: new Date(),
    });

    logger.info("Push token registered", { userId, tokenId: pushToken.id });
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Push token registered successfully",
    tokenId: pushToken.id,
  });
});

/**
 * @desc    Unregister push token
 * @route   DELETE /notifications/token
 * @access  Private
 */
exports.unregisterToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const userId = req.user.uid;

  if (!token) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Push token"));
  }

  logger.info("Unregistering push token", { userId });

  const pushToken = await PushToken.findOne({
    where: { userId, token },
  });

  if (pushToken) {
    // Soft delete - mark as inactive
    await pushToken.update({ isActive: false });
    logger.info("Push token deactivated", { userId, tokenId: pushToken.id });
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Push token unregistered successfully",
  });
});

/**
 * @desc    Update notification preferences
 * @route   PUT /notifications/preferences
 * @access  Private
 */
exports.updatePreferences = asyncHandler(async (req, res) => {
  const { preferences } = req.body;
  const userId = req.user.uid;

  if (!preferences) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Preferences"));
  }

  logger.info("Updating notification preferences", { userId, preferences });

  // Update all active tokens for this user
  await PushToken.update(
    { preferences },
    { where: { userId, isActive: true } }
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Notification preferences updated",
    preferences,
  });
});

/**
 * @desc    Get user's notifications
 * @route   GET /notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  const { page = 1, limit = 20, status, type } = req.query;

  const offset = (page - 1) * limit;
  const where = { userId };

  if (status) where.status = status;
  if (type) where.type = type;

  const { count, rows: notifications } = await Notification.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  // Count unread notifications
  const unreadCount = await Notification.count({
    where: { userId, status: { [db.Sequelize.Op.notIn]: ["read"] } },
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    notifications,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
    },
    unreadCount,
  });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /notifications/:notificationId/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user.uid;

  const notification = await Notification.findOne({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Notification"));
  }

  await notification.update({
    status: "read",
    readAt: new Date(),
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Notification marked as read",
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.uid;

  await Notification.update(
    { status: "read", readAt: new Date() },
    { where: { userId, status: { [db.Sequelize.Op.notIn]: ["read"] } } }
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "All notifications marked as read",
  });
});

/**
 * @desc    Delete a notification
 * @route   DELETE /notifications/:notificationId
 * @access  Private
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user.uid;

  const notification = await Notification.findOne({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Notification"));
  }

  await notification.destroy();

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Notification deleted",
  });
});

/**
 * @desc    Send notification to a user (internal/admin use)
 * @route   POST /notifications/send
 * @access  Private (Admin)
 */
exports.sendNotification = asyncHandler(async (req, res) => {
  const { userId, title, body, type, data, priority, channelId } = req.body;

  if (!userId || !title || !body) {
    throw new BadRequestError("userId, title, and body are required");
  }

  logger.info("Sending notification", { userId, title, type });

  // Get user's active push tokens
  const pushTokens = await PushToken.findAll({
    where: { userId, isActive: true },
  });

  if (pushTokens.length === 0) {
    // Still create notification record even if no tokens
    const notification = await Notification.create({
      userId,
      title,
      body,
      type: type || "general",
      data: data || {},
      priority: priority || "normal",
      channelId: channelId || "default",
      status: "pending",
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Notification created but no push tokens registered",
      notificationId: notification.id,
      pushSent: false,
    });
  }

  // Create notification record
  const notification = await Notification.create({
    userId,
    title,
    body,
    type: type || "general",
    data: data || {},
    priority: priority || "normal",
    channelId: channelId || "default",
    status: "pending",
  });

  // Build messages for Expo
  const messages = [];
  for (const pushToken of pushTokens) {
    // Check preferences
    const prefs = pushToken.preferences || {};
    const typeToPreference = {
      project_update: "projectUpdates",
      project_approved: "projectUpdates",
      project_rejected: "projectUpdates",
      payment_received: "payments",
      payment_pending: "payments",
      message: "messages",
      reminder: "reminders",
      general: true,
      system: true,
    };

    const prefKey = typeToPreference[type] || true;
    if (prefKey !== true && !prefs[prefKey]) {
      logger.info("Skipping notification due to preferences", {
        userId,
        type,
        prefKey,
      });
      continue;
    }

    if (Expo.isExpoPushToken(pushToken.token)) {
      messages.push({
        to: pushToken.token,
        sound: "default",
        title,
        body,
        data: {
          ...data,
          notificationId: notification.id,
        },
        priority: priority === "high" ? "high" : "default",
        channelId: channelId || "default",
      });
    }
  }

  if (messages.length === 0) {
    await notification.update({ status: "failed", errorMessage: "No valid tokens or preferences blocked" });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Notification not sent due to user preferences",
      notificationId: notification.id,
      pushSent: false,
    });
  }

  // Send to Expo
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      logger.error("Error sending push notification chunk", { error: error.message });
    }
  }

  // Update notification status
  const successCount = tickets.filter((t) => t.status === "ok").length;
  const failedTickets = tickets.filter((t) => t.status === "error");

  if (successCount > 0) {
    await notification.update({
      status: "sent",
      sentAt: new Date(),
      expoReceiptId: tickets[0]?.id || null,
    });
  } else {
    await notification.update({
      status: "failed",
      errorMessage: failedTickets[0]?.message || "Unknown error",
    });
  }

  logger.info("Notification sent", {
    notificationId: notification.id,
    successCount,
    failedCount: failedTickets.length,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Notification sent",
    notificationId: notification.id,
    pushSent: true,
    stats: {
      sent: successCount,
      failed: failedTickets.length,
    },
  });
});

/**
 * @desc    Send notification to multiple users (broadcast)
 * @route   POST /notifications/broadcast
 * @access  Private (Admin)
 */
exports.broadcastNotification = asyncHandler(async (req, res) => {
  const { userIds, title, body, type, data, priority } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new BadRequestError("userIds array is required");
  }

  if (!title || !body) {
    throw new BadRequestError("title and body are required");
  }

  logger.info("Broadcasting notification", { userCount: userIds.length, title });

  // Get all active push tokens for these users
  const pushTokens = await PushToken.findAll({
    where: {
      userId: { [db.Sequelize.Op.in]: userIds },
      isActive: true,
    },
  });

  // Create notification records for all users
  const notifications = await Notification.bulkCreate(
    userIds.map((userId) => ({
      userId,
      title,
      body,
      type: type || "general",
      data: data || {},
      priority: priority || "normal",
      status: "pending",
    }))
  );

  // Build messages
  const messages = [];
  for (const pushToken of pushTokens) {
    if (Expo.isExpoPushToken(pushToken.token)) {
      const notification = notifications.find((n) => n.userId === pushToken.userId);
      messages.push({
        to: pushToken.token,
        sound: "default",
        title,
        body,
        data: {
          ...data,
          notificationId: notification?.id,
        },
        priority: priority === "high" ? "high" : "default",
      });
    }
  }

  // Send to Expo
  const chunks = expo.chunkPushNotifications(messages);
  let successCount = 0;
  let failedCount = 0;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      successCount += tickets.filter((t) => t.status === "ok").length;
      failedCount += tickets.filter((t) => t.status === "error").length;
    } catch (error) {
      logger.error("Error sending broadcast chunk", { error: error.message });
      failedCount += chunk.length;
    }
  }

  // Update notification statuses
  await Notification.update(
    { status: "sent", sentAt: new Date() },
    { where: { id: { [db.Sequelize.Op.in]: notifications.map((n) => n.id) } } }
  );

  logger.info("Broadcast complete", { successCount, failedCount });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Broadcast sent",
    stats: {
      users: userIds.length,
      tokens: pushTokens.length,
      sent: successCount,
      failed: failedCount,
    },
  });
});

/**
 * @desc    Get notification statistics (Admin)
 * @route   GET /notifications/stats
 * @access  Private (Admin)
 */
exports.getStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const where = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[db.Sequelize.Op.gte] = new Date(startDate);
    if (endDate) where.createdAt[db.Sequelize.Op.lte] = new Date(endDate);
  }

  // Count by status
  const statusCounts = await Notification.findAll({
    where,
    attributes: [
      "status",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    group: ["status"],
    raw: true,
  });

  // Count by type
  const typeCounts = await Notification.findAll({
    where,
    attributes: [
      "type",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    group: ["type"],
    raw: true,
  });

  // Total active tokens
  const activeTokens = await PushToken.count({ where: { isActive: true } });

  // Unique users with tokens
  const usersWithTokens = await PushToken.count({
    where: { isActive: true },
    distinct: true,
    col: "userId",
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    stats: {
      notifications: {
        byStatus: statusCounts.reduce((acc, curr) => {
          acc[curr.status] = parseInt(curr.count);
          return acc;
        }, {}),
        byType: typeCounts.reduce((acc, curr) => {
          acc[curr.type] = parseInt(curr.count);
          return acc;
        }, {}),
      },
      tokens: {
        active: activeTokens,
        uniqueUsers: usersWithTokens,
      },
    },
  });
});

/**
 * Helper: Send notification to user by userId (for internal use)
 */
exports.sendToUser = async (userId, title, body, type = "general", data = {}) => {
  try {
    const pushTokens = await PushToken.findAll({
      where: { userId, isActive: true },
    });

    if (pushTokens.length === 0) {
      logger.info("No push tokens for user", { userId });
      return { success: false, reason: "no_tokens" };
    }

    // Create notification record
    const notification = await Notification.create({
      userId,
      title,
      body,
      type,
      data,
      status: "pending",
    });

    // Build and send messages
    const messages = pushTokens
      .filter((pt) => Expo.isExpoPushToken(pt.token))
      .map((pt) => ({
        to: pt.token,
        sound: "default",
        title,
        body,
        data: { ...data, notificationId: notification.id },
      }));

    if (messages.length === 0) {
      return { success: false, reason: "no_valid_tokens" };
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }

    await notification.update({ status: "sent", sentAt: new Date() });

    return { success: true, notificationId: notification.id };
  } catch (error) {
    logger.error("Error in sendToUser", { userId, error: error.message });
    return { success: false, reason: error.message };
  }
};

