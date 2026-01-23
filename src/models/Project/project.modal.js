const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const Project = sequelize.define(
    "Project",
    {
      pid: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      projectName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "Untitled Draft",
      },
      projectType: DataTypes.STRING,
      clientName: DataTypes.STRING,
      client: DataTypes.STRING,
      startDate: DataTypes.DATE,
      endDate: DataTypes.DATE,
      description: DataTypes.TEXT,
      tags: DataTypes.JSON,
      media: DataTypes.JSON,

      // Payment details
      paymentType: DataTypes.STRING,
      dueDate: DataTypes.DATE,
      projectAmount: DataTypes.DECIMAL(15, 2),
      currency: DataTypes.STRING,
      taxHandling: DataTypes.STRING,
      paymentFrequency: DataTypes.ENUM("weekly", "monthly", "quarterly"),
      paymentStartDate: DataTypes.DATE,
      contractDuration: DataTypes.INTEGER, // months
      financing: DataTypes.STRING,
      paymentMethod: DataTypes.STRING,
      paymentStructure: DataTypes.ENUM("single", "recurring", "multiple"),
      milestones: DataTypes.JSON,
      agree: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      // ✅ Additional fields
      projectStatus: DataTypes.STRING,
      isDraft: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      contactName: DataTypes.STRING,
      contactEmail: DataTypes.STRING,
      contactNumber: DataTypes.STRING,
      contactRole: DataTypes.STRING,
      contactBrand: DataTypes.STRING,

      // ✅ Foreign key (link to User)
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "projects", // ✅ Explicitly define table name
      timestamps: true,
      paranoid: true, // optional if you want soft deletes
    }
  );

  // ✅ Convert empty strings to NULL automatically
  Project.beforeValidate((project) => {
    for (let key in project.dataValues) {
      if (project[key] === "") {
        project[key] = null;
      }
    }
  });

  return Project;
};
