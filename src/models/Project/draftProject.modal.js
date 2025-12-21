const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const DraftProject = sequelize.define("DraftProject", {
    dpid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
    },
    projectName: {
      type: DataTypes.STRING,
      allowNull: true, // Allow null for drafts - users can save with minimal data
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

    // Contact person / Point of contact
    pointName: DataTypes.STRING,
    pointRole: DataTypes.STRING,
    pointBrand: DataTypes.STRING,
    pointEmail: DataTypes.STRING,
    pointMobile: DataTypes.STRING,

    // Payment details
    paymentType: DataTypes.STRING,
    amount: DataTypes.DECIMAL(15, 2),
    dueDate: DataTypes.DATE,
    projectAmount: DataTypes.DECIMAL(15, 2),
    currency: DataTypes.STRING,
    taxHandling: DataTypes.STRING,
    paymentFrequency: DataTypes.STRING, // temporarily replacing ENUM
    paymentStructure: DataTypes.STRING, // temporarily replacing ENUM
    paymentStartDate: DataTypes.DATE,
    contractDuration: DataTypes.INTEGER, // months
    financing: DataTypes.STRING,
    paymentMethod: DataTypes.STRING,
    milestones: DataTypes.JSON,
    agree: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // New fields from dataset
    projectStatus: DataTypes.STRING,
    contactName: DataTypes.STRING,
    contactEmail: DataTypes.STRING,
    contactNumber: DataTypes.STRING,
    contactRole: DataTypes.STRING,
    contactBrand: DataTypes.STRING,

    // Foreign key (link to User)
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  });

  // ✅ Automatically convert empty strings to NULL
  DraftProject.beforeValidate((project) => {
    for (let key in project.dataValues) {
      if (project[key] === "") {
        project[key] = null;
      }
    }
  });

  // Optional: define associations here if you have User model
  DraftProject.associate = (models) => {
    DraftProject.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return DraftProject;
};
