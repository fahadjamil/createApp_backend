const db = require("../models");
const Client = db.Client;
const Project = db.Project;

const asyncHandler = require("../middlewares/asyncHandler");
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
} = require("../middlewares/errorHandler");
const logger = require("../utils/logger");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");

/**
 * @desc    Create new client
 * @route   POST /client/new_client
 * @access  Private
 */
exports.createClient = asyncHandler(async (req, res) => {
  const {
    fullName,
    clientType,
    company,
    email,
    phone,
    address,
    contactPersonName,
    contactPersonRole,
    userId,
  } = req.body;

  logger.info("Create client request", { userId });

  // Check duplicate phone for this user
  const existingClient = await Client.findOne({
    where: { phone, userId },
  });

  if (existingClient) {
    throw new ConflictError("A client with this phone number already exists for this user");
  }

  const client = await Client.create({
    fullName,
    clientType,
    company,
    email,
    phone,
    address,
    contactPersonName,
    contactPersonRole,
    userId,
  });

  logger.info("Client created", { clientId: client.cid });

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: MESSAGES.SUCCESS.CREATED("Client"),
    client,
  });
});

/**
 * @desc    Get all clients (admin)
 * @route   GET /client/all
 * @access  Private (Admin)
 */
exports.getAllClients = asyncHandler(async (req, res) => {
  const clients = await Client.findAll({
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Project,
        as: "project",
        required: false,
        attributes: ["pid", "projectName", "projectType", "startDate", "endDate"],
      },
    ],
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Clients"),
    count: clients.length,
    clients,
  });
});

/**
 * @desc    Get single client by ID
 * @route   GET /client/:id
 * @access  Private
 */
exports.getClientById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await Client.findByPk(id, {
    include: [
      {
        model: Project,
        as: "project",
        required: false,
        attributes: ["pid", "projectName", "projectType", "startDate", "endDate"],
      },
    ],
  });

  if (!client) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Client"));
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Client"),
    client,
  });
});

/**
 * @desc    Update client
 * @route   PUT /client/:id
 * @access  Private
 */
exports.updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    fullName,
    clientType,
    company,
    email,
    phone,
    address,
    contactPersonName,
    contactPersonRole,
  } = req.body;

  logger.info("Update client request", { clientId: id });

  const client = await Client.findOne({ where: { cid: id } });

  if (!client) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Client"));
  }

  // Check for duplicate phone
  if (phone && phone !== client.phone) {
    const duplicate = await Client.findOne({
      where: { phone, userId: client.userId },
    });

    if (duplicate) {
      throw new ConflictError("Another client with this phone number already exists");
    }
  }

  await client.update({
    fullName,
    clientType,
    company,
    email,
    phone,
    address,
    contactPersonName,
    contactPersonRole,
  });

  logger.info("Client updated", { clientId: id });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.UPDATED("Client"),
    client,
  });
});

/**
 * @desc    Get all clients for a user (GET)
 * @route   GET /client/user/:userId
 * @access  Private
 */
exports.getClientsByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("User ID"));
  }

  const clients = await Client.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Project,
        as: "project",
        required: false,
        attributes: ["pid", "projectName", "projectType", "startDate", "endDate", "projectAmount"],
      },
    ],
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Clients"),
    count: clients.length,
    clients,
  });
});

/**
 * @desc    Get all clients for a user (POST - used by mobile)
 * @route   POST /client/all_clients
 * @access  Private
 */
exports.getClientsByUserPost = asyncHandler(async (req, res) => {
  const userId = req.user?.uid || req.body.userId;

  if (!userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("User ID"));
  }

  const clients = await Client.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Project,
        as: "project",
        required: false,
        attributes: ["pid", "projectName", "projectType", "startDate", "endDate", "projectAmount"],
      },
    ],
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Clients"),
    count: clients.length,
    clients,
  });
});
