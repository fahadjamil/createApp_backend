module.exports = (app) => {
  const router = require("express").Router();
  const authController = require("../controllers/user.controller"); // <- use the auth controller

  // POST request for signup
  router.post("/signup", authController.signup);
  // POST /user/signin
  router.post("/signin", authController.signin);
  // ✅ New route to get all users
  router.get("/users", authController.getAllUsers);

  router.post("/check-email", authController.checkEmail);

  router.post("/check-phone", authController.checkPhoneAndSendOtp);

  // ✅ Update user profile
  router.put("/profile/:userId", authController.updateProfile);

  // ✅ Get user by ID
  router.get("/profile/:userId", authController.getUserById);

  // Mount the router on /user
  app.use("/user", router);
};
