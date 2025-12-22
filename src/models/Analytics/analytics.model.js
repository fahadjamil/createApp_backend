const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const Analytics = sequelize.define(
    "analytics",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      // Event identification
      eventName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      eventCategory: {
        type: DataTypes.ENUM(
          "auth",
          "project",
          "client",
          "payment",
          "navigation",
          "ui_interaction",
          "form",
          "gesture",
          "search",
          "profile",
          "onboarding",
          "dashboard",
          "error",
          "engagement",
          "other"
        ),
        defaultValue: "other",
      },

      // User context
      userId: {
        type: DataTypes.UUID,
        allowNull: true, // Can be null for anonymous events
        references: {
          model: "user",
          key: "uid",
        },
      },
      sessionId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Screen/Location context
      screenName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      section: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Event properties (flexible JSON storage)
      properties: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },

      // Device & Platform info
      platform: {
        type: DataTypes.ENUM("ios", "android", "web", "desktop"),
        allowNull: true,
      },
      appVersion: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deviceModel: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      osVersion: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Geo & Network info
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Timing
      clientTimestamp: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      duration: {
        type: DataTypes.INTEGER, // Duration in milliseconds
        allowNull: true,
      },

      // Element-specific data
      elementId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      elementType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      elementText: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Error-specific data
      errorCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      errorType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "analytics",
      timestamps: true,
      indexes: [
        { fields: ["eventName"] },
        { fields: ["eventCategory"] },
        { fields: ["userId"] },
        { fields: ["screenName"] },
        { fields: ["platform"] },
        { fields: ["createdAt"] },
        { fields: ["sessionId"] },
      ],
    }
  );

  return Analytics;
};

