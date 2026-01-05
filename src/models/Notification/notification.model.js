const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const Notification = sequelize.define(
    "notification",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      // User reference (recipient)
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "user",
          key: "uid",
        },
      },

      // Notification content
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      // Notification type for categorization
      type: {
        type: DataTypes.ENUM(
          "project_update",
          "project_approved",
          "project_rejected",
          "payment_received",
          "payment_pending",
          "message",
          "reminder",
          "system",
          "general"
        ),
        allowNull: false,
        defaultValue: "general",
      },

      // Additional data payload
      data: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },

      // Related entities
      projectId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      clientId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // Delivery status
      status: {
        type: DataTypes.ENUM("pending", "sent", "delivered", "failed", "read"),
        defaultValue: "pending",
      },

      // Expo receipt ID (for tracking delivery)
      expoReceiptId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Error message if delivery failed
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // Timestamps
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Scheduling
      scheduledFor: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Priority
      priority: {
        type: DataTypes.ENUM("low", "normal", "high"),
        defaultValue: "normal",
      },

      // Channel for Android
      channelId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "default",
      },
    },
    {
      tableName: "notification",
      timestamps: true,
      indexes: [
        {
          fields: ["userId"],
          name: "notification_user_idx",
        },
        {
          fields: ["status"],
          name: "notification_status_idx",
        },
        {
          fields: ["type"],
          name: "notification_type_idx",
        },
        {
          fields: ["createdAt"],
          name: "notification_created_idx",
        },
        {
          fields: ["userId", "status"],
          name: "notification_user_status_idx",
        },
      ],
    }
  );

  return Notification;
};

