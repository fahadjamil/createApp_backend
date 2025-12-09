// models/Client.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const Client = sequelize.define(
    "Client",
    {
      cid: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      // 🧾 Basic Client Info
      fullName: {
        type: DataTypes.STRING,
        allowNull: true, // Made optional for flexibility
      },
      clientType: {
        type: DataTypes.STRING, // Changed from ENUM for flexibility
        allowNull: true,
      },
      company: {
        type: DataTypes.STRING,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true, // Made optional
        // Removed unique constraint - clients can share email
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false, // Phone is required for client identification
        // Removed strict length validation
      },
      address: {
        type: DataTypes.TEXT,
      },

      // 👤 Contact Details
      contactPersonName: {
        type: DataTypes.STRING,
      },
      contactPersonRole: {
        type: DataTypes.STRING,
      },

      // 🔗 Project Relationship
      projectId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "projects",
          key: "pid",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      // 🔗 User Relationship
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "user",
          key: "uid",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "clients",
    }
  );

  return Client;
};
