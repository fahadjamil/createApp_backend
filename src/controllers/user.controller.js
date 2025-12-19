const db = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const admin = require("firebase-admin");

const User = db.User;
const asyncHandler = require("../middlewares/asyncHandler");
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
} = require("../middlewares/errorHandler");
const logger = require("../utils/logger");
const { HTTP_STATUS, MESSAGES, TOKEN_EXPIRY } = require("../utils/constants");
const { sendPasswordResetEmail, sendWelcomeEmail } = require("../utils/email");

// Initialize Firebase Admin if not already initialized
const initFirebaseAdmin = () => {
  if (admin.apps.length === 0) {
    try {
      const adminConfig = require("../config/Firebase.config");
      admin.initializeApp({
        credential: admin.credential.cert(adminConfig),
      });
      logger.info("Firebase Admin initialized successfully");
    } catch (error) {
      logger.warn("Firebase Admin initialization failed:", error.message);
    }
  }
  return admin;
};

/**
 * @desc    User signup
 * @route   POST /user/signup
 * @access  Public
 */
exports.signup = asyncHandler(async (req, res) => {
  logger.info("User signup attempt", { email: req.body.email });

  const { phone, firstName, lastName, email, password, role, searchTerm } = req.body;

  // Check if user already exists (only select necessary columns)
  const existingUser = await User.findOne({
    where: {
      [db.Sequelize.Op.or]: [{ email }, { phone }],
    },
    attributes: ['uid', 'email', 'phone']
  });

  if (existingUser) {
    throw new ConflictError(MESSAGES.ERROR.ALREADY_EXISTS("User with this email or phone"));
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user in Firebase Auth for password reset functionality
  let firebaseUid = null;
  try {
    const firebaseAdmin = initFirebaseAdmin();
    const firebaseUser = await firebaseAdmin.auth().createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`,
      phoneNumber: phone,
    });
    firebaseUid = firebaseUser.uid;
    logger.info("Firebase user created", { firebaseUid });
  } catch (firebaseError) {
    // Log but don't fail signup if Firebase fails
    logger.warn("Firebase user creation failed (continuing with local signup):", firebaseError.message);
  }

  // Create new user with transaction
  const trans = await db.sequelize.transaction();

  try {
    const user = await User.create(
      {
        phone,
        firstName,
        lastName,
        full_name: `${firstName} ${lastName}`,
        email,
        password: hashedPassword,
        role,
        searchTerm,
        firebaseUid, // Store Firebase UID for reference
      },
      { transaction: trans }
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    await trans.commit();
    logger.info("User signup successful", { userId: user.uid, firebaseUid });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: MESSAGES.SUCCESS.SIGNUP,
      token,
      user: {
        uid: user.uid,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        searchTerm: user.searchTerm,
      },
    });
  } catch (error) {
    await trans.rollback();
    // If local DB fails but Firebase succeeded, try to clean up Firebase user
    if (firebaseUid) {
      try {
        const firebaseAdmin = initFirebaseAdmin();
        await firebaseAdmin.auth().deleteUser(firebaseUid);
        logger.info("Cleaned up Firebase user after local DB failure", { firebaseUid });
      } catch (cleanupError) {
        logger.warn("Failed to cleanup Firebase user:", cleanupError.message);
      }
    }
    throw error;
  }
});

/**
 * @desc    User signin
 * @route   POST /user/signin
 * @access  Public
 */
exports.signin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  logger.info("User signin attempt", { email });

  // Find user (case-insensitive email lookup)
  const user = await User.findOne({ 
    where: db.Sequelize.where(
      db.Sequelize.fn('LOWER', db.Sequelize.col('email')),
      email.trim().toLowerCase()
    ),
    attributes: ['uid', 'email', 'password', 'role', 'full_name', 'firstName', 'lastName', 'phone']
  });
  
  logger.info("Signin attempt", { 
    email: email.trim().toLowerCase(), 
    userFound: !!user 
  });

  if (!user) {
    throw new BadRequestError(MESSAGES.ERROR.INVALID_CREDENTIALS);
  }

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password);
  
  logger.info("Password comparison", { 
    email: user.email,
    passwordLength: password?.length,
    storedHashLength: user.password?.length,
    isMatch: isMatch
  });

  if (!isMatch) {
    throw new BadRequestError(MESSAGES.ERROR.INVALID_CREDENTIALS);
  }

  const token = jwt.sign(
    { uid: user.uid, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  logger.info("User signin successful", { userId: user.uid });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.LOGIN,
    token,
    user: {
      uid: user.uid,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    },
  });
});

/**
 * @desc    Get all users
 * @route   GET /user/all
 * @access  Private (Admin)
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    attributes: { exclude: ["password"] },
    order: [["createdAt", "DESC"]],
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.FETCHED("Users"),
    count: users.length,
    users,
  });
});

/**
 * @desc    Check email availability
 * @route   POST /user/check-email
 * @access  Public
 */
exports.checkEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Email"));
  }

  logger.debug("Checking email availability", { email });

  const existingUser = await User.findOne({ 
    where: { email },
    attributes: ['uid', 'email']
  });

  if (existingUser) {
    logger.debug("Email already registered", { email });
    return res.status(HTTP_STATUS.OK).json({
      exists: true,
      message: "Email already exists.",
    });
  }

  logger.debug("Email available", { email });
  res.status(HTTP_STATUS.OK).json({
    exists: false,
    message: "Email is available.",
  });
});

/**
 * @desc    Check phone and send OTP
 * @route   POST /user/check-phone
 * @access  Public
 */
exports.checkPhoneAndSendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Phone number"));
  }

  // Validate phone format (Pakistan) - accepts 10 digits after +92
  const phoneRegex = /^\+92\d{10}$/;
  if (!phoneRegex.test(phone)) {
    throw new BadRequestError(
      "Invalid phone format. Please use +92 followed by 10 digits (e.g., +923312344567)."
    );
  }

  // Check if phone exists (only select necessary columns to avoid missing column errors)
  const existingUser = await User.findOne({ 
    where: { phone },
    attributes: ['uid', 'phone', 'email']
  });

  if (existingUser) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      exists: true,
      message: "This phone number is already registered.",
    });
  }

  // Generate OTP
  const otpToSend = Math.floor(1000 + Math.random() * 9000);

  // Send OTP via external API
  try {
    await axios.post("https://bsms.its.com.pk/otpsms.php", null, {
      params: {
        key: process.env.SMS_API_KEY || "8aaf1d3a0b626b4840b6558792b4506b",
        receiver: phone,
        sender: "SmartLane",
        otpcode: otpToSend,
        param1: "Create App",
        param2: "Verification",
      },
    });

    logger.info("OTP sent successfully", { phone });
  } catch (error) {
    logger.error("Failed to send OTP", { phone, error: error.message });
    // Continue even if SMS fails - return OTP for testing
  }

  res.status(HTTP_STATUS.OK).json({
    exists: false,
    message: MESSAGES.SUCCESS.OTP_SENT(phone),
    // Include OTP in development only
    ...(process.env.ENV !== "production" && { otp: otpToSend }),
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /user/update/:userId
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { firstName, lastName, phone, role, searchTerm } = req.body;

  logger.info("Update profile attempt", { userId });

  if (!userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("User ID"));
  }

  const user = await User.findOne({ where: { uid: userId } });

  if (!user) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("User"));
  }

  // Build update object
  const updatedFields = {};
  if (firstName !== undefined) updatedFields.firstName = firstName;
  if (lastName !== undefined) updatedFields.lastName = lastName;
  if (phone !== undefined) updatedFields.phone = phone;
  if (role !== undefined) updatedFields.role = role;
  if (searchTerm !== undefined) updatedFields.searchTerm = searchTerm;

  // Update full_name if name changed
  if (firstName !== undefined || lastName !== undefined) {
    updatedFields.full_name = `${firstName || user.firstName} ${lastName || user.lastName}`;
  }

  await user.update(updatedFields);
  logger.info("Profile updated successfully", { userId });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: MESSAGES.SUCCESS.UPDATED("Profile"),
    user: {
      uid: user.uid,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      searchTerm: user.searchTerm,
    },
  });
});

/**
 * @desc    Get user by ID
 * @route   GET /user/:userId
 * @access  Private
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("User ID"));
  }

  const user = await User.findOne({
    where: { uid: userId },
    attributes: { exclude: ["password"] },
  });

  if (!user) {
    throw new NotFoundError(MESSAGES.ERROR.NOT_FOUND("User"));
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    user: {
      uid: user.uid,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      searchTerm: user.searchTerm,
    },
  });
});

/**
 * @desc    Request password reset - generates new password and sends via email
 * @route   POST /user/forgot-password
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Email"));
  }

  logger.info("Password reset requested", { email });

  // Find user by email (case-insensitive lookup)
  const user = await User.findOne({ 
    where: db.Sequelize.where(
      db.Sequelize.fn('LOWER', db.Sequelize.col('email')),
      email.trim().toLowerCase()
    )
  });
  
  logger.info("User lookup for password reset", { 
    email: email.trim().toLowerCase(), 
    userFound: !!user,
    userId: user?.uid 
  });

  // For security, always return success even if user not found
  if (!user) {
    logger.debug("Password reset requested for non-existent email", { email });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "If an account exists with this email, a new password has been sent.",
    });
  }

  // Generate a new random password (8 characters: letters + numbers)
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const newPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  logger.info("Generated new password for user", { 
    userId: user.uid, 
    email: user.email,
    newPassword: newPassword, // Remove this log in production!
    hashedLength: hashedPassword.length 
  });

  // Update user's password in database
  try {
    await user.update({
      password: hashedPassword,
    });
    
    // Verify the update was successful
    const updatedUser = await User.findOne({ where: { email: user.email } });
    const verifyMatch = await bcrypt.compare(newPassword, updatedUser.password);
    logger.info("Password update verification", { 
      userId: user.uid, 
      passwordUpdated: verifyMatch 
    });
  } catch (updateError) {
    logger.error("Failed to update password in database", { error: updateError.message });
    throw new BadRequestError("Failed to update password. Please try again.");
  }

  // Send new password via email
  try {
    const emailSent = await sendPasswordResetEmail(
      user.email,
      newPassword,
      user.firstName || "User"
    );

    if (!emailSent) {
      throw new Error("Failed to send email");
    }

    logger.info("New password sent via email", { userId: user.uid, email: user.email });
    
    const response = {
      success: true,
      message: "A new password has been sent to your email!",
    };
    
    // Include password in development for testing (REMOVE IN PRODUCTION!)
    if (process.env.ENV !== "production") {
      response.newPassword = newPassword;
    }
    
    res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error("Failed to send password reset email", { error: error.message });
    throw new BadRequestError("Failed to send password reset email. Please try again.");
  }
});

/**
 * @desc    Reset password with token
 * @route   POST /user/reset-password
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword, firebaseReset, email } = req.body;

  if (!newPassword) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("New password"));
  }

  // Validate password strength
  if (newPassword.length < 8) {
    throw new BadRequestError("Password must be at least 8 characters long");
  }

  let user;

  // If this is a Firebase-initiated reset, find user by email from Firebase
  if (firebaseReset && email) {
    user = await User.findOne({ where: { email } });
    
    if (!user) {
      // User exists in Firebase but not in our DB - this is okay
      logger.info("Firebase password reset for non-existent local user", { email });
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Password has been reset successfully.",
      });
    }
  } else if (token) {
    // Traditional token-based reset
    // Hash the provided token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid token
    user = await User.findOne({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          [db.Sequelize.Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestError("Password reset token is invalid or has expired");
    }
  } else {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Token or email"));
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and clear reset token
  await user.update({
    password: hashedPassword,
    resetPasswordToken: null,
    resetPasswordExpires: null,
  });

  logger.info("Password reset successful", { userId: user.uid });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Password has been reset successfully. You can now log in with your new password.",
  });
});

/**
 * @desc    Verify Firebase ID Token and get/create user
 * @route   POST /user/firebase-verify
 * @access  Public
 */
exports.verifyFirebaseToken = asyncHandler(async (req, res) => {
  const { idToken, phone, email, displayName } = req.body;

  if (!idToken) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Firebase ID token"));
  }

  try {
    // Initialize Firebase Admin
    const firebaseAdmin = initFirebaseAdmin();
    
    // Verify the ID token
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    
    logger.info("Firebase token verified", { 
      uid: decodedToken.uid, 
      phone: decodedToken.phone_number 
    });

    // Check if user exists with this phone number
    const phoneNumber = phone || decodedToken.phone_number;
    
    if (!phoneNumber) {
      throw new BadRequestError("Phone number not found in token");
    }

    let user = await User.findOne({ 
      where: { phone: phoneNumber },
      attributes: ['uid', 'email', 'phone', 'firstName', 'lastName', 'full_name', 'role']
    });

    if (user) {
      // User exists - generate JWT
      const token = jwt.sign(
        { uid: user.uid, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Phone verified successfully",
        exists: true,
        token,
        user: {
          uid: user.uid,
          phone: user.phone,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          full_name: user.full_name,
          role: user.role,
        },
      });
    }

    // User doesn't exist - return verification success for signup flow
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Phone verified successfully",
      exists: false,
      firebaseUid: decodedToken.uid,
      phone: phoneNumber,
    });
  } catch (error) {
    logger.error("Firebase token verification failed", { error: error.message });
    
    if (error.code === 'auth/id-token-expired') {
      throw new BadRequestError("Firebase token has expired");
    } else if (error.code === 'auth/invalid-id-token') {
      throw new BadRequestError("Invalid Firebase token");
    }
    
    throw new BadRequestError("Firebase verification failed: " + error.message);
  }
});

/**
 * @desc    Send password reset email via Firebase
 * @route   POST /user/firebase-forgot-password
 * @access  Public
 */
exports.firebaseForgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError(MESSAGES.ERROR.REQUIRED("Email"));
  }

  logger.info("Firebase password reset requested", { email });

  try {
    // Initialize Firebase Admin
    const firebaseAdmin = initFirebaseAdmin();
    
    // Generate password reset link via Firebase Admin
    const resetLink = await firebaseAdmin.auth().generatePasswordResetLink(email, {
      url: process.env.APP_DEEP_LINK || 'createapp://reset-password',
    });

    logger.info("Firebase password reset link generated", { email });

    // In production, send this link via your email service
    // For now, we rely on Firebase's built-in email sending from the client

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Password reset email sent. Check your inbox.",
      // Include reset link in development for testing
      ...(process.env.ENV !== "production" && { resetLink }),
    });
  } catch (error) {
    logger.error("Firebase password reset failed", { email, error: error.message });
    
    // For security, don't reveal if user exists
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "If an account exists with this email, a reset link has been sent.",
    });
  }
});
