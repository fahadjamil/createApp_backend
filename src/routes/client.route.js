const router = require("express").Router();
const clientController = require("../controllers/client.controller");
const { authenticate, optionalAuth } = require("../middlewares/auth");
const { validate, sanitize } = require("../middlewares/validate");

module.exports = (app) => {
  // Apply sanitization to all routes
  router.use(sanitize);

  // ========== Client Routes ==========

  // Create new client (authenticated)
  router.post(
    "/new_client",
    optionalAuth,
    validate("createClient"),
    clientController.createClient
  );

  // Get all clients (admin)
  router.get(
    "/all",
    authenticate,
    clientController.getAllClients
  );

  // Get all clients for a user (POST - used by mobile)
  router.post(
    "/all_clients",
    optionalAuth,
    clientController.getClientsByUserPost
  );

  // Get all clients for a user (GET)
  router.get(
    "/user/:userId",
    optionalAuth,
    clientController.getClientsByUser
  );

  // Get single client by ID
  router.get(
    "/:id",
    optionalAuth,
    clientController.getClientById
  );

  // Update client (authenticated)
  router.put(
    "/:id",
    optionalAuth,
    clientController.updateClient
  );

  // Mount router on /client
  app.use("/client", router);
};
