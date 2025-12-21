const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Force database schema sync on startup to add any missing columns (v2)

const db = require("../src/models");
const logger = require("./utils/logger");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");
const { sanitize } = require("./middlewares/validate");

const app = express();
const PORT = process.env.SERVERPORT || 8080;

// Trust proxy for Vercel/cloud deployments (required for rate limiting)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet()); // Set security HTTP headers

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // Disable validation (handled by trust proxy)
});
app.use("/api/", limiter);

// CORS - Allow all origins
app.use(cors());

// Request Logging
if (process.env.ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Sanitize request body
app.use(sanitize);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Root Endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Create App Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      api: "/api/*",
    },
    timestamp: new Date().toISOString(),
  });
});

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Password Reset Page (served from backend) - needs relaxed CSP for inline scripts
app.get("/reset-password", (req, res) => {
  // Override helmet's CSP to allow inline scripts for this page
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'"
  );
  const resetPasswordHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Create App</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Plus Jakarta Sans',sans-serif;background:linear-gradient(135deg,#0a1628 0%,#0f1f35 50%,#162a45 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
    .container{width:100%;max-width:440px;background:#fff;border-radius:20px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);overflow:hidden}
    .header{background:linear-gradient(135deg,#0a1628,#0f1f35);padding:40px 30px;text-align:center}
    .logo{font-size:28px;font-weight:700;color:#fff;margin-bottom:20px}
    .lock-icon{width:64px;height:64px;background:rgba(255,255,255,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
    .lock-icon svg{width:32px;height:32px;fill:#fff}
    .header h1{color:#fff;font-size:24px;font-weight:700;margin-bottom:8px}
    .header p{color:#94a3b8;font-size:14px}
    .form-container{padding:30px}
    .form-group{margin-bottom:20px}
    .form-group label{display:block;color:#334155;font-size:14px;font-weight:600;margin-bottom:8px}
    .input-wrapper{position:relative}
    .input-wrapper input{width:100%;padding:14px 45px 14px 16px;border:1px solid #e2e8f0;border-radius:12px;font-size:16px;font-family:inherit;transition:all 0.2s;background:#f8fafc}
    .input-wrapper input:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.1);background:#fff}
    .toggle-password{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px}
    .requirements{margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:12px}
    .requirements h4{font-size:13px;color:#64748b;margin-bottom:10px;font-weight:600}
    .requirement{display:flex;align-items:center;gap:8px;font-size:13px;color:#94a3b8;margin-bottom:6px}
    .requirement.valid{color:#10b981}
    .requirement .icon{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:10px}
    .requirement.valid .icon{background:#10b981;border-color:#10b981;color:#fff}
    .btn{width:100%;padding:16px;background:#0f1f35;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.2s}
    .btn:hover:not(:disabled){background:#162a45;transform:translateY(-1px)}
    .btn:disabled{background:#cbd5e1;cursor:not-allowed}
    .btn.loading{position:relative;color:transparent}
    .btn.loading::after{content:'';position:absolute;width:20px;height:20px;top:50%;left:50%;margin:-10px 0 0 -10px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .error-message{margin-bottom:16px;padding:12px 16px;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;color:#dc2626;font-size:14px;display:none}
    .error-message.show{display:block}
    .success-container{text-align:center;padding:40px 30px;display:none}
    .success-container.show{display:block}
    .success-icon{width:80px;height:80px;background:#d1fae5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
    .success-icon svg{width:40px;height:40px;fill:#10b981}
    .success-container h2{color:#0f172a;font-size:24px;margin-bottom:12px}
    .success-container p{color:#64748b;font-size:14px;margin-bottom:24px}
    .back-link{display:inline-block;color:#2563eb;text-decoration:none;font-size:14px;font-weight:500}
    .back-link:hover{text-decoration:underline}
    .invalid-token{text-align:center;padding:40px 30px}
    .invalid-token .error-icon{width:80px;height:80px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
    .invalid-token .error-icon svg{width:40px;height:40px;fill:#dc2626}
    .invalid-token h2{color:#0f172a;font-size:24px;margin-bottom:12px}
    .invalid-token p{color:#64748b;font-size:14px;margin-bottom:24px}
  </style>
</head>
<body>
  <div class="container">
    <div id="invalidToken" class="invalid-token" style="display:none">
      <div class="error-icon"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div>
      <h2>Invalid Reset Link</h2>
      <p>This password reset link is invalid or has expired.</p>
      <a href="https://create-app-eight.vercel.app/login" class="btn" style="display:inline-block;text-decoration:none;max-width:200px">Back to Login</a>
    </div>
    <div id="resetForm">
      <div class="header">
        <div class="logo">Create</div>
        <div class="lock-icon"><svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg></div>
        <h1>Reset Your Password</h1>
        <p id="emailDisplay">Enter your new password below</p>
      </div>
      <div class="form-container">
        <div id="errorMessage" class="error-message"></div>
        <form id="passwordForm">
          <div class="form-group">
            <label for="password">New Password</label>
            <div class="input-wrapper">
              <input type="password" id="password" placeholder="Enter new password" required>
              <button type="button" class="toggle-password" id="togglePassword1"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
            </div>
          </div>
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <div class="input-wrapper">
              <input type="password" id="confirmPassword" placeholder="Confirm new password" required>
              <button type="button" class="toggle-password" id="togglePassword2"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
            </div>
          </div>
          <div class="requirements">
            <h4>Password Requirements</h4>
            <div class="requirement" id="req-length"><span class="icon">✓</span><span>At least 8 characters</span></div>
            <div class="requirement" id="req-upper"><span class="icon">✓</span><span>One uppercase letter</span></div>
            <div class="requirement" id="req-lower"><span class="icon">✓</span><span>One lowercase letter</span></div>
            <div class="requirement" id="req-number"><span class="icon">✓</span><span>One number</span></div>
          </div>
          <button type="submit" id="submitBtn" class="btn" disabled>Reset Password</button>
        </form>
      </div>
    </div>
    <div id="successContainer" class="success-container">
      <div class="success-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
      <h2>Password Reset Successful!</h2>
      <p>Your password has been updated. You can now log in.</p>
      <a href="https://create-app-eight.vercel.app/login" class="btn" style="display:inline-block;text-decoration:none">Go to Login</a>
    </div>
  </div>
  <script>
    const urlParams=new URLSearchParams(window.location.search);
    const token=urlParams.get('token');
    const email=urlParams.get('email');
    const resetForm=document.getElementById('resetForm');
    const invalidToken=document.getElementById('invalidToken');
    const successContainer=document.getElementById('successContainer');
    const passwordForm=document.getElementById('passwordForm');
    const errorMessage=document.getElementById('errorMessage');
    const submitBtn=document.getElementById('submitBtn');
    const emailDisplay=document.getElementById('emailDisplay');
    const passwordInput=document.getElementById('password');
    const confirmInput=document.getElementById('confirmPassword');
    if(!token){resetForm.style.display='none';invalidToken.style.display='block'}
    else if(email){emailDisplay.textContent='Creating new password for '+decodeURIComponent(email)}
    function validatePassword(){
      const password=passwordInput.value;
      const confirm=confirmInput.value;
      const req={length:password.length>=8,upper:/[A-Z]/.test(password),lower:/[a-z]/.test(password),number:/[0-9]/.test(password)};
      document.getElementById('req-length').classList.toggle('valid',req.length);
      document.getElementById('req-upper').classList.toggle('valid',req.upper);
      document.getElementById('req-lower').classList.toggle('valid',req.lower);
      document.getElementById('req-number').classList.toggle('valid',req.number);
      const allValid=Object.values(req).every(Boolean);
      const match=password===confirm&&password.length>0;
      submitBtn.disabled=!(allValid&&match);
      return{allValid,match};
    }
    passwordInput.addEventListener('input',validatePassword);
    confirmInput.addEventListener('input',validatePassword);
    validatePassword();
    function togglePassword(inputId){const i=document.getElementById(inputId);i.type=i.type==='password'?'text':'password'}
    document.getElementById('togglePassword1').addEventListener('click',function(){togglePassword('password')});
    document.getElementById('togglePassword2').addEventListener('click',function(){togglePassword('confirmPassword')});
    passwordForm.addEventListener('submit',async(e)=>{
      e.preventDefault();
      const{allValid,match}=validatePassword();
      if(!allValid){showError('Please meet all password requirements.');return}
      if(!match){showError('Passwords do not match.');return}
      submitBtn.classList.add('loading');submitBtn.disabled=true;hideError();
      try{
        const res=await fetch('/user/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,newPassword:passwordInput.value})});
        const data=await res.json();
        console.log('Reset password response:', res.status, data);
        if(res.ok && data.success){resetForm.style.display='none';successContainer.style.display='block';successContainer.classList.add('show')}
        else{showError(data.message||'Failed to reset password. Link may have expired.')}
      }catch(err){console.error('Reset password error:', err);showError('An error occurred. Please try again.')}
      finally{submitBtn.classList.remove('loading');validatePassword()}
    });
    function showError(msg){errorMessage.textContent=msg;errorMessage.classList.add('show')}
    function hideError(){errorMessage.classList.remove('show')}
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(resetPasswordHTML);
});

// Database Sync Endpoint (one-time use to add missing columns)
app.get("/sync-db", async (req, res) => {
  try {
    await db.sequelize.sync({ alter: true });
    res.status(200).json({
      success: true,
      message: "Database schema synced successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database sync failed: " + error.message,
    });
  }
});

// Database Connection
db.sequelize
  .authenticate()
  .then(() => {
    logger.info("Database connected successfully");
    // Sync database schema (alter: true adds missing columns without dropping data)
    return db.sequelize.sync({ alter: true });
  })
  .then(() => {
    logger.info("Database schema synced successfully");
  })
  .catch((err) => {
    logger.error("Database connection failed", { error: err.message });
  });

// Import Routes
require("./routes/index")(app);

// Example API route
app.get("/api/data", (req, res) => {
  res.json({ message: "Hello from Create Backend API!" });
});

// Handle 404 - Route not found
app.use(notFoundHandler);

// Global Error Handler (must be last)
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason: reason?.toString() });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error: error.message });
  process.exit(1);
});

module.exports = app;
