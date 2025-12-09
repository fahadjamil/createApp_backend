const clientController = require("../controllers/client.controller");

module.exports = (app) => {
  const router = require("express").Router();

  // Create client
  router.post("/new_client", clientController.createClient);

  // Get all clients (POST with userId in body - matching mobile app pattern)
  router.post("/all_clients", clientController.getClientsByUserPost);

  // Get all clients (admin level)
  router.get("/all", clientController.getAllClients);

  // Get single client by ID
  router.get("/:id", clientController.getClientById);

  // Update client
  router.put("/:id", clientController.updateClient);

  // Get clients by userId (GET with param)
  router.get("/user/:userId", clientController.getClientsByUser);

  // Mount router on /client
  app.use("/client", router);
};
