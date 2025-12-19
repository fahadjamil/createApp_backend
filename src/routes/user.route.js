const router = require("express").Router();
const userController = require("../controllers/user.controller");
const { authenticate, optionalAuth } = require("../middlewares/auth");
const { validate, sanitize } = require("../middlewares/validate");

module.exports = (app) => {
  // Apply sanitization to all routes
  router.use(sanitize);

  // ========== Public Routes ==========

  // User signup
  router.post(
    "/signup",
    validate("signup"),
    userController.signup
  );

  // User signin
  router.post(
    "/signin",
    validate("signin"),
    userController.signin
  );

  // Check phone and send OTP
  router.post(
    "/check-phone",
    userController.checkPhoneAndSendOtp
  );

  // Check email availability
  router.post(
    "/check-email",
    userController.checkEmail
  );

  // Forgot password - request reset (sends email with reset token)
  router.post(
    "/forgot-password",
    userController.forgotPassword
  );

  // Reset password with token
  router.post(
    "/reset-password",
    userController.resetPassword
  );

  // ========== Firebase Auth Routes ==========

  // Verify Firebase ID token (for phone auth)
  router.post(
    "/firebase-verify",
    userController.verifyFirebaseToken
  );

  // Firebase forgot password
  router.post(
    "/firebase-forgot-password",
    userController.firebaseForgotPassword
  );

  // ========== Protected Routes ==========

  // Get all users (admin only)
  router.get(
    "/all",
    authenticate,
    userController.getAllUsers
  );

  // Get user by ID
  router.get(
    "/:userId",
    optionalAuth,
    userController.getUserById
  );

  // Update user profile
  router.put(
    "/update/:userId",
    optionalAuth,
    userController.updateProfile
  );

  // Mount router on /user
  app.use("/user", router);
};
