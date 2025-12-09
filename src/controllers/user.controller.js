const db = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const User = db.User;

exports.signup = async (req, res) => {
  const trans = await db.sequelize.transaction();
  try {
    console.log("📥 DEBUG req.body:", req.body); // Add this to debug

    if (!req.body || typeof req.body !== "object") {
      return res
        .status(400)
        .json({ message: "Invalid or missing request body." });
    }

    const { phone, firstName, lastName, email, password, role, searchTerm } =
      req.body;
    // Validation
    if (!phone || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message:
          "Phone, first name, last name, email, and password are required.",
      });
    }

    // Check if user already exists (by email or phone)
    const existingUser = await User.findOne({
      where: {
        [db.Sequelize.Op.or]: [{ email }, { phone }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User with this email or phone number already exists.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
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
      { expiresIn: "7d" }
    );

    await trans.commit();

    res.status(201).json({
      message: "User signup successful",
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
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.signin = async (req, res) => {
  try {
    // const { req.body.email, password } = req.body;
    console.log(req.body.email);
    console.log(req.body.password);
    // Validation
    if (!req.body.email || !req.body.password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Find user
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { uid: user.uid, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        uid: user.uid,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: {
        exclude: ["password"], // Hide password from the response
      },
      order: [["createdAt", "DESC"]], // Optional: newest first
    });

    res.status(200).json({
      message: "All users retrieved successfully",
      users,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // 🧩 Input validation
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "A valid email is required." });
    }

    console.log("📩 Checking email availability:", email);

    // 🔍 Check if email already exists
    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      console.log("⚠️ Email already registered:", email);
      return res.status(200).json({
        exists: true,
        message: "Email already exists.",
      });
    }

    console.log("✅ Email available:", email);
    return res.status(200).json({
      exists: false,
      message: "Email is available.",
    });
  } catch (error) {
    console.error("❌ checkEmail() error:", error.message);
    return res.status(500).json({
      message: "Internal server error while checking email.",
      error: error.message,
    });
  }
};
exports.checkPhoneAndSendOtp = async (req, res) => {
  try {
    // const { phone } = req.body;

    if (!req.body.phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    // ✅ Strictly validate +92XXXXXXXXXX format (Pakistan)
    const phoneRegex = /^\+92\d{10}$/;
    if (!phoneRegex.test(req.body.phone)) {
      return res.status(400).json({
        message:
          "Invalid phone format. Please use +92 followed by 10 digits (e.g., +923001234567).",
      });
    }

    // 🔍 Check if phone exists in DB
    const existingUser = await User.findOne({
      where: { phone: req.body.phone },
    });

    if (existingUser) {
      return res.status(400).json({
        exists: true,
        message: "This phone number is already registered.",
      });
    }

    // ✅ Generate random 4-digit OTP
    const otpToSend = Math.floor(1000 + Math.random() * 9000);

    // 🔹 Send OTP via external API
    const response = await axios.post(
      "https://bsms.its.com.pk/otpsms.php",
      null,
      {
        params: {
          key: "8aaf1d3a0b626b4840b6558792b4506b",
          receiver: req.body.phone,
          sender: "SmartLane",
          otpcode: otpToSend,
          param1: "Toseef Kirmani",
          param2: "Add Money",
        },
      }
    );

    console.log("📤 OTP Response:", response.data);

    // ✅ Respond to client
    return res.status(200).json({
      exists: false,
      message: `OTP sent successfully to ${req.body.phone}`,
      otp: otpToSend, // ⚠️ Remove in production
    });
  } catch (error) {
    console.error("❌ Phone check or OTP send error:", error.message);
    return res.status(500).json({
      message: "Internal server error or OTP sending failed.",
      error: error.message,
    });
  }
};

// ✅ Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, role, searchTerm } = req.body;

    console.log("📝 ========== UPDATE PROFILE ==========");
    console.log("👤 User ID:", userId);
    console.log("📦 Update Data:", req.body);

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Find user
    const user = await User.findOne({ where: { uid: userId } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user fields
    const updatedFields = {};
    if (firstName !== undefined) updatedFields.firstName = firstName;
    if (lastName !== undefined) updatedFields.lastName = lastName;
    if (phone !== undefined) updatedFields.phone = phone;
    if (role !== undefined) updatedFields.role = role;
    if (searchTerm !== undefined) updatedFields.searchTerm = searchTerm;
    
    // Update full_name if firstName or lastName changed
    if (firstName !== undefined || lastName !== undefined) {
      updatedFields.full_name = `${firstName || user.firstName} ${lastName || user.lastName}`;
    }

    await user.update(updatedFields);

    console.log("✅ Profile updated successfully");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
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
  } catch (error) {
    console.error("❌ Update profile error:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

// ✅ Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findOne({
      where: { uid: userId },
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
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
  } catch (error) {
    console.error("❌ Get user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};