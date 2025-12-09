const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define(
    "user",
    {
      uid: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      // Auth credentials
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      pin: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "0000", // or some default PIN
      },

      // New fields
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      searchTerm: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Profile info
      full_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      avatar_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role: {
        type: DataTypes.STRING,
        defaultValue: "creator", // e.g., creator, admin
      },

      // Flags / status
      isEmailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "user", // Explicit table name to match foreign key references
      timestamps: true, // adds createdAt and updatedAt
      paranoid: true, // adds deletedAt for soft delete
    }
  );

  return User;
};
