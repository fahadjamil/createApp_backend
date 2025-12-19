const router = require("express").Router();
const projectController = require("../controllers/project.controller");
const upload = require("../middlewares/upload");
const { authenticate, optionalAuth } = require("../middlewares/auth");
const { validate, sanitize } = require("../middlewares/validate");

module.exports = (app) => {
  // Apply sanitization to all routes
  router.use(sanitize);

  // ========== Project Routes ==========

  // Create new project (authenticated)
  router.post(
    "/new_project",
    optionalAuth, // Use optionalAuth for backward compatibility
    validate("createProject"),
    projectController.Newproject
  );

  // Get all projects for a user (authenticated)
  router.post(
    "/all_projects",
    optionalAuth,
    projectController.allprojects
  );

  // Get single project by ID
  router.get(
    "/:id",
    optionalAuth,
    projectController.getProjectById
  );

  // Update project (authenticated)
  router.put(
    "/update_project/:id",
    optionalAuth,
    projectController.updateProject
  );

  // Delete project (authenticated)
  router.delete(
    "/delete_project/:id",
    optionalAuth,
    projectController.deleteProject
  );

  // Multiple images upload (authenticated)
  router.post(
    "/upload_pictures",
    optionalAuth,
    upload.array("images", 5),
    projectController.uploadProjectPictures
  );

  // ========== Draft Project Routes ==========

  // Create/Update draft project
  router.post(
    "/draftProject",
    optionalAuth,
    projectController.DraftProject
  );

  // Get all draft projects for a user
  router.post(
    "/all_draftProject",
    optionalAuth,
    projectController.allDraftprojects
  );

  // Get single draft by ID
  router.get(
    "/draft/:id",
    optionalAuth,
    projectController.getSingleDraftProject
  );

  // Delete draft project
  router.delete(
    "/delete_draft/:id",
    optionalAuth,
    projectController.deleteDraftProject
  );

  // Mount router on /project
  app.use("/project", router);
};
