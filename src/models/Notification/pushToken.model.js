const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const PushToken = sequelize.define(
    "push_token",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      // User reference
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "user",
          key: "uid",
        },
      },

      // Expo push token
      token: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },

      // Device info
      platform: {
        type: DataTypes.ENUM("ios", "android", "web"),
        allowNull: false,
        defaultValue: "android",
      },

      deviceId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      deviceName: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Token status
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      // Last used timestamp
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Notification preferences
      preferences: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          projectUpdates: true,
          payments: true,
          messages: true,
          reminders: true,
          marketing: false,
        },
      },
    },
    {
      tableName: "push_token",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["userId", "token"],
          name: "push_token_user_token_unique",
        },
        {
          fields: ["token"],
          name: "push_token_token_idx",
        },
        {
          fields: ["userId"],
          name: "push_token_user_idx",
        },
      ],
    }
  );

  return PushToken;
};

