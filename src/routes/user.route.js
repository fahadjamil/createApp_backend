const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const userController = require("../controllers/user.controller");
const { authenticate, optionalAuth } = require("../middlewares/auth");
const { validate, sanitize } = require("../middlewares/validate");

// Rate limiter for password reset to prevent abuse
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per 15 minutes
  message: { 
    success: false, 
    message: "Too many password reset attempts. Please try again later." 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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

  // Forgot password - request reset (sends email with reset link)
  router.post(
    "/forgot-password",
    passwordResetLimiter,
    userController.forgotPassword
  );

  // Test password (DEVELOPMENT ONLY - REMOVE IN PRODUCTION)
  router.post(
    "/test-password",
    userController.testPassword
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
