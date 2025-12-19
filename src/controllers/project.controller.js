const db = require("../models");
const Project = db.Project;
const DraftProject = db.DraftProject;
const Client = db.Client;

const asyncHandler = require("../middlewares/asyncHandler");
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require("../middlewares/errorHandler");
const logger = require("../utils/logger");
const {
  HTTP_STATUS,
  MESSAGES,
  PROTECTED_PROJECT_STATUSES,
  UPDATABLE_PROJECT_FIELDS,
  DELAYED_PROJECT_FIELDS,
  DISPUTE_PROJECT_FIELDS,
} = require("../utils/constants");

/**
 * Client sync logic (unique by phone + store userId)
 * Accepts both contact* and point* field names from mobile app
 */
const syncClient = async (data) => {
  try {
    logger.debug("Client sync started", { projectId: data.projectId });

    // Support both naming conventions: contactNumber OR pointMobile
    const phone = data.contactNumber || data.pointMobile;

    if (!phone) {
      logger.debug("No phone provided, skipping client sync");
      return null;
    }

    if (!data.projectId || !data.userId) {
      logger.debug("Missing projectId or userId, skipping client sync");
      return null;
    }

    const clientData = {
      fullName: data.clientName || "",
      clientType: data.client || "",
      company: data.contactBrand || data.pointBrand || "",
      email: data.contactEmail || data.pointEmail || "",
      phone: phone,
      address: "",
      contactPersonName: data.contactName || data.pointName || "",
      contactPersonRole: data.contactRole || data.pointRole || "",
      projectId: data.projectId,
      userId: data.userId,
    };

    // Find client by phone
    let client = await Client.findOne({
      where: { phone, userId: data.userId },
    });

    if (client) {
      await client.update(clientData);
      logger.debug("Client updated", { clientId: client.cid });
    } else {
      client = await Client.create(clientData);
      logger.debug("Client created", { clientId: client.cid });
    }

    return client;
  } catch (err) {
    logger.error("Client sync failed", { error: err.message });
    return null;
  }
};

/**
 * @desc    Create or Update Project + Sync Client
 * @route   POST /project/new_project
 * @access  Private
 */
exports.Newproject = asyncHandler(async (req, res) => {
  logger.info("Create/Update project request");

  const requiredFields = [
    "projectName",
    "projectType",
    "clientName",
    "client",
    "startDate",
    "endDate",
  ];

  // Validate required fields for new projects
  if (!req.body.pid) {
    const missingFields = requiredFields.filter(
      (field) => !req.body[field] || req.body[field].toString().trim() === ""
    );

    if (missingFields.length > 0) {
      throw new BadRequestError(`Missing required fields: ${missingFields.join(", ")}`);
    }
  }

  if (!req.body.userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("userId"));
  }

  let project;

  if (req.body.pid) {
    // Update existing project
    project = await Project.findOne({ where: { pid: req.body.pid } });

    if (!project) {
      throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Project"));
    }

    await project.update({
      ...req.body,
      userId: req.body.userId,
    });

    // Remove from draft if exists
    await DraftProject.destroy({ where: { dpid: req.body.pid } });
    logger.info("Project updated", { projectId: project.pid });
  } else {
    // Create new project
    project = await Project.create({
      ...req.body,
      userId: req.body.userId,
    });

    // Remove draft if exists
    if (req.body.dpid || req.body.pid) {
      await DraftProject.destroy({
        where: { dpid: req.body.dpid || req.body.pid },
      });
    }
    logger.info("Project created", { projectId: project.pid });
  }

  // Sync client
  const client = await syncClient({ ...req.body, projectId: project.pid });

  res.status(req.body.pid ? HTTP_STATUS.OK : HTTP_STATUS.CREATED).json({
    success: true,
    message: MESSAGES.SUCCESS[req.body.pid ? "UPDATED" : "CREATED"]("Project"),
    project,
    client,
  });
});

/**
 * @desc    Get all projects for user
 * @route   POST /project/all_projects
 * @access  Private
 */
exports.allprojects = asyncHandler(async (req, res) => {
  const userId = req.user?.uid || req.query.userId || req.body.userId;

  if (!userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("User ID"));
  }

  const projects = await Project.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Projects"),
    count: projects.length,
    data: projects,
  });
});

/**
 * @desc    Upload project pictures
 * @route   POST /project/upload_pictures
 * @access  Private
 */
exports.uploadProjectPictures = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new BadRequestError("No files uploaded");
  }

  let project;

  if (req.body.projectId) {
    project = await Project.findOne({ where: { pid: req.body.projectId } });
    if (!project) {
      throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Project"));
    }
  } else {
    project = await Project.create({
      userId: req.body.userId || null,
      projectName: req.body.projectName || "Untitled Project",
      projectType: req.body.projectType || "General",
      client: req.body.client || "Unknown",
      status: req.body.status || "Pending",
      startDate: new Date(),
      endDate: new Date(),
      media: JSON.stringify([]),
    });
  }

  // Extract Cloudinary URLs
  const uploadedUrls = req.files.map((file) => file.path);

  // Merge with existing media
  let existingMedia = [];
  if (project.media) {
    try {
      existingMedia = JSON.parse(project.media);
    } catch {
      existingMedia = [];
    }
  }

  await project.update({
    media: JSON.stringify([...existingMedia, ...uploadedUrls]),
  });

  logger.info("Pictures uploaded", { projectId: project.pid, count: uploadedUrls.length });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Pictures uploaded successfully",
    project,
  });
});

/**
 * @desc    Get single project by ID
 * @route   GET /project/:id
 * @access  Private
 */
exports.getProjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const project = await Project.findOne({ where: { pid: id } });

  if (!project) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Project"));
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Project"),
    data: project,
  });
});

/**
 * @desc    Update project
 * @route   PUT /project/update_project/:id
 * @access  Private
 */
exports.updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const project = await Project.findByPk(id);
  if (!project) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Project"));
  }

  // Check current project status
  const currentStatus = (project.projectStatus || project.status || "").toLowerCase();
  const isDelayed = currentStatus === "delayed";
  const isInDispute = currentStatus === "in dispute";

  // Determine updatable fields based on status
  let updatableFields = [...UPDATABLE_PROJECT_FIELDS];

  if (isDelayed) {
    logger.debug("Project is delayed - only endDate update allowed");
    updatableFields = [...DELAYED_PROJECT_FIELDS];
  }

  if (isInDispute) {
    logger.debug("Project is in dispute - only tags and media update allowed");
    updatableFields = [...DISPUTE_PROJECT_FIELDS];
  }

  const updates = {};
  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  await project.update(updates);
  logger.info("Project updated", { projectId: id });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: isDelayed
      ? "Project end date updated successfully (project is delayed)"
      : MESSAGES.SUCCESS.UPDATED("Project"),
    project,
  });
});

/**
 * @desc    Create or Update Draft Project
 * @route   POST /project/draftProject
 * @access  Private
 */
exports.DraftProject = asyncHandler(async (req, res) => {
  logger.info("Create/Update draft project");

  const { pid, userId, startDate, endDate, dueDate, paymentStartDate, ...rest } = req.body;

  if (!userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("userId"));
  }

  // Helper to validate/convert date
  const parseDateOrNull = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  };

  const payload = {
    dpid: pid,
    userId,
    ...rest,
    startDate: parseDateOrNull(startDate),
    endDate: parseDateOrNull(endDate),
    dueDate: parseDateOrNull(dueDate),
    paymentStartDate: parseDateOrNull(paymentStartDate),
  };

  const [draft, created] = await DraftProject.upsert(payload, {
    returning: true,
  });

  logger.info(created ? "Draft created" : "Draft updated", { draftId: draft.dpid });

  res.status(created ? HTTP_STATUS.CREATED : HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS[created ? "CREATED" : "UPDATED"]("Draft project"),
    draft,
  });
});

/**
 * @desc    Get all draft projects for user
 * @route   POST /project/all_draftProject
 * @access  Private
 */
exports.allDraftprojects = asyncHandler(async (req, res) => {
  const userId = req.user?.uid || req.query.userId || req.body.userId;

  if (!userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("User ID"));
  }

  const draftProjects = await DraftProject.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Draft projects"),
    count: draftProjects.length,
    data: draftProjects,
  });
});

/**
 * @desc    Get single draft project by ID
 * @route   GET /project/draft/:id
 * @access  Private
 */
exports.getSingleDraftProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.uid || req.query.userId || req.body.userId;

  if (!id) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Draft project ID"));
  }

  if (!userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("User ID"));
  }

  const draftProject = await DraftProject.findOne({
    where: { dpid: id, userId },
  });

  if (!draftProject) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Draft project"));
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Draft project"),
    data: draftProject,
  });
});

/**
 * @desc    Delete project by ID
 * @route   DELETE /project/delete_project/:id
 * @access  Private
 */
exports.deleteProject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Project ID"));
  }

  const project = await Project.findOne({ where: { pid: id } });

  if (!project) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Project"));
  }

  // Prevent deletion of protected projects
  const projectStatus = (project.projectStatus || project.status || "").toLowerCase();

  if (PROTECTED_PROJECT_STATUSES.includes(projectStatus)) {
    throw new ForbiddenError("Projects that are signed or completed cannot be deleted");
  }

  await project.destroy();
  logger.info("Project deleted", { projectId: id });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.DELETED("Project"),
  });
});

/**
 * @desc    Delete draft project by ID
 * @route   DELETE /project/delete_draft/:id
 * @access  Private
 */
exports.deleteDraftProject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Draft project ID"));
  }

  const draftProject = await DraftProject.findOne({ where: { dpid: id } });

  if (!draftProject) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("Draft project"));
  }

  await draftProject.destroy();
  logger.info("Draft project deleted", { draftId: id });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.DELETED("Draft project"),
  });
});
