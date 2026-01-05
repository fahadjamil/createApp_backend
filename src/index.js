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

// Admin Analytics Login Endpoint
app.post("/admin/analytics/login", (req, res) => {
  const { email, password } = req.body;
  
  // Hardcoded admin credentials
  if (email === 'admin@gmail.com' && password === 'admin') {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { uid: 'admin', email: 'admin@gmail.com', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token
    });
  }
  
  return res.status(401).json({
    success: false,
    message: 'Invalid admin credentials'
  });
});

// Analytics Admin Dashboard Page (served from backend)
app.get("/admin/analytics", (req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:* https://*.vercel.app"
  );
  const analyticsHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Dashboard - Create App</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-50: #eff6ff; --primary-100: #dbeafe; --primary-200: #bfdbfe;
      --primary-500: #3b82f6; --primary-600: #2563eb; --primary-700: #1d4ed8;
      --primary-800: #1e40af; --primary-900: #0f172a;
      --success-100: #dcfce7; --success-500: #22c55e; --success-600: #16a34a;
      --warning-100: #fef3c7; --warning-500: #f59e0b;
      --error-100: #fee2e2; --error-500: #ef4444;
      --neutral-50: #f8fafc; --neutral-100: #f1f5f9; --neutral-200: #e2e8f0;
      --neutral-300: #cbd5e1; --neutral-400: #94a3b8; --neutral-600: #475569;
      --text-primary: #0f172a; --text-secondary: #475569; --text-tertiary: #64748b;
      --bg-primary: #f8fafc; --bg-secondary: #ffffff;
      --border-light: #e2e8f0;
      --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg-primary); min-height: 100vh; color: var(--text-primary); }
    
    /* Login Page */
    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-900) 0%, #1e3a5f 100%); padding: 20px; }
    .login-card { background: var(--bg-secondary); border-radius: var(--radius-xl); padding: 40px; width: 100%; max-width: 400px; box-shadow: var(--shadow-lg); }
    .login-logo { font-size: 28px; font-weight: 800; color: var(--primary-600); text-align: center; margin-bottom: 8px; }
    .login-subtitle { color: var(--text-tertiary); text-align: center; margin-bottom: 32px; font-size: 14px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
    .form-group input { width: 100%; padding: 12px 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); font-size: 14px; font-family: inherit; transition: all 0.2s; }
    .form-group input:focus { outline: none; border-color: var(--primary-500); box-shadow: 0 0 0 3px var(--primary-100); }
    .login-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, var(--primary-600), var(--primary-700)); color: white; border: none; border-radius: var(--radius-md); font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .login-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
    .login-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    .login-error { background: var(--error-100); color: var(--error-500); padding: 12px; border-radius: var(--radius-md); margin-bottom: 20px; font-size: 14px; display: none; }
    .login-error.show { display: block; }
    
    /* Dashboard */
    .dashboard { display: none; }
    .dashboard.show { display: block; }
    .header { background: var(--bg-secondary); border-bottom: 1px solid var(--border-light); padding: 16px 24px; position: sticky; top: 0; z-index: 100; }
    .header-content { max-width: 1400px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-logo { font-size: 22px; font-weight: 800; color: var(--primary-600); }
    .header-title { font-size: 18px; font-weight: 600; color: var(--text-primary); }
    .header-right { display: flex; align-items: center; gap: 12px; }
    .refresh-btn, .logout-btn { padding: 8px 16px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
    .refresh-btn { background: var(--primary-50); color: var(--primary-600); border: 1px solid var(--primary-200); }
    .refresh-btn:hover { background: var(--primary-100); }
    .logout-btn { background: var(--neutral-100); color: var(--text-secondary); border: 1px solid var(--border-light); }
    .logout-btn:hover { background: var(--error-100); color: var(--error-500); border-color: var(--error-500); }
    
    .main { max-width: 1400px; margin: 0 auto; padding: 24px; }
    
    /* Filters */
    .filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .filter-select { padding: 10px 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); font-size: 13px; font-family: inherit; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; min-width: 140px; }
    .filter-select:focus { outline: none; border-color: var(--primary-500); }
    
    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: var(--bg-secondary); border-radius: var(--radius-lg); padding: 20px; border: 1px solid var(--border-light); display: flex; align-items: center; gap: 16px; transition: all 0.2s; }
    .stat-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
    .stat-icon { width: 48px; height: 48px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .stat-icon.blue { background: linear-gradient(135deg, var(--primary-100), var(--primary-50)); color: var(--primary-600); }
    .stat-icon.green { background: linear-gradient(135deg, var(--success-100), #d1fae5); color: var(--success-600); }
    .stat-icon.orange { background: linear-gradient(135deg, var(--warning-100), #fef3c7); color: var(--warning-500); }
    .stat-icon.red { background: linear-gradient(135deg, var(--error-100), #fee2e2); color: var(--error-500); }
    .stat-content h3 { font-size: 24px; font-weight: 700; color: var(--text-primary); }
    .stat-content p { font-size: 13px; color: var(--text-tertiary); margin-top: 2px; }
    
    /* Charts Grid */
    .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    @media (max-width: 1024px) { .charts-grid { grid-template-columns: 1fr; } }
    .chart-card { background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-light); overflow: hidden; }
    .chart-card.full { grid-column: 1 / -1; }
    .chart-header { padding: 16px 20px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; }
    .chart-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .chart-body { padding: 20px; min-height: 280px; }
    
    /* Bar Chart */
    .bar-chart { display: flex; flex-direction: column; gap: 12px; }
    .bar-row { display: flex; align-items: center; gap: 12px; }
    .bar-label { width: 100px; font-size: 12px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex-shrink: 0; }
    .bar-track { flex: 1; height: 24px; background: var(--neutral-100); border-radius: 6px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; padding: 0 10px; transition: width 0.5s ease; }
    .bar-fill span { font-size: 11px; font-weight: 600; color: white; }
    .bar-count { width: 50px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text-primary); flex-shrink: 0; }
    .bar-fill.c0 { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .bar-fill.c1 { background: linear-gradient(90deg, #22c55e, #4ade80); }
    .bar-fill.c2 { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .bar-fill.c3 { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
    .bar-fill.c4 { background: linear-gradient(90deg, #ec4899, #f472b6); }
    .bar-fill.c5 { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
    
    /* Timeline */
    .timeline { height: 180px; display: flex; align-items: flex-end; gap: 3px; padding: 20px 0; }
    .timeline-bar { flex: 1; background: linear-gradient(180deg, var(--primary-500), var(--primary-300)); border-radius: 4px 4px 0 0; min-height: 4px; transition: all 0.3s; cursor: pointer; }
    .timeline-bar:hover { background: linear-gradient(180deg, var(--primary-600), var(--primary-400)); }
    .timeline-labels { display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border-light); }
    .timeline-labels span { font-size: 11px; color: var(--text-tertiary); }
    
    /* Events Table */
    .events-table { width: 100%; border-collapse: collapse; }
    .events-table th, .events-table td { padding: 12px 16px; text-align: left; font-size: 13px; border-bottom: 1px solid var(--border-light); }
    .events-table th { font-weight: 600; color: var(--text-secondary); background: var(--neutral-50); }
    .events-table td { color: var(--text-primary); }
    .events-table tr:hover td { background: var(--neutral-50); }
    .event-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
    .event-badge.auth { background: var(--primary-100); color: var(--primary-700); }
    .event-badge.project { background: var(--success-100); color: var(--success-600); }
    .event-badge.client { background: var(--warning-100); color: #b45309; }
    .event-badge.navigation { background: #e0e7ff; color: #4338ca; }
    .event-badge.ui_interaction { background: #ede9fe; color: #7c3aed; }
    .event-badge.form { background: #fce7f3; color: #db2777; }
    .event-badge.search { background: #cffafe; color: #0891b2; }
    .event-badge.error { background: var(--error-100); color: var(--error-500); }
    .event-badge.other { background: var(--neutral-100); color: var(--neutral-600); }
    
    /* Platform Cards */
    .platform-cards { display: flex; flex-direction: column; gap: 12px; }
    .platform-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--neutral-50); border-radius: var(--radius-md); border: 1px solid var(--border-light); }
    .platform-icon { width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--primary-100); color: var(--primary-600); display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .platform-info { flex: 1; }
    .platform-info h4 { font-size: 14px; font-weight: 600; text-transform: capitalize; }
    .platform-info p { font-size: 12px; color: var(--text-tertiary); }
    .platform-percent { font-size: 18px; font-weight: 700; color: var(--primary-600); }
    
    /* Loading */
    .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: var(--text-tertiary); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--border-light); border-top-color: var(--primary-500); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    /* Empty State */
    .empty-state { text-align: center; padding: 40px; color: var(--text-tertiary); }
    .empty-state svg { width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5; }
    
    /* Responsive */
    @media (max-width: 768px) {
      .header-content { flex-direction: column; gap: 12px; }
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .filters { flex-direction: column; }
      .filter-select { width: 100%; }
      .bar-label { width: 70px; font-size: 11px; }
    }
    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <!-- Login Page -->
  <div id="loginPage" class="login-container">
    <div class="login-card">
      <div class="login-logo">Create</div>
      <p class="login-subtitle">Analytics Admin Dashboard</p>
      <div id="loginError" class="login-error"></div>
      <form id="loginForm">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" placeholder="Enter your email" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" placeholder="Enter your password" required>
        </div>
        <button type="submit" id="loginBtn" class="login-btn">Sign In</button>
      </form>
    </div>
  </div>

  <!-- Dashboard -->
  <div id="dashboard" class="dashboard">
    <header class="header">
      <div class="header-content">
        <div class="header-left">
          <span class="header-logo">Create</span>
          <span class="header-title">📊 Analytics Dashboard</span>
        </div>
        <div class="header-right">
          <button id="refreshBtn" class="refresh-btn">🔄 Refresh</button>
          <button id="logoutBtn" class="logout-btn">Logout</button>
        </div>
      </div>
    </header>
    
    <main class="main">
      <!-- Filters -->
      <div class="filters">
        <select id="dateRange" class="filter-select">
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30" selected>Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <select id="platform" class="filter-select">
          <option value="">All Platforms</option>
          <option value="ios">iOS</option>
          <option value="android">Android</option>
          <option value="web">Web</option>
        </select>
      </div>
      
      <!-- Stats -->
      <div class="stats-grid" id="statsGrid">
        <div class="stat-card">
          <div class="stat-icon blue">📈</div>
          <div class="stat-content">
            <h3 id="totalEvents">-</h3>
            <p>Total Events</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">👥</div>
          <div class="stat-content">
            <h3 id="uniqueUsers">-</h3>
            <p>Unique Users</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">🔗</div>
          <div class="stat-content">
            <h3 id="sessions">-</h3>
            <p>Sessions</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">⚠️</div>
          <div class="stat-content">
            <h3 id="errorEvents">-</h3>
            <p>Error Events</p>
          </div>
        </div>
      </div>
      
      <!-- Charts -->
      <div class="charts-grid">
        <!-- Timeline -->
        <div class="chart-card full">
          <div class="chart-header">
            <h3>📅 Events Over Time</h3>
            <span style="font-size:12px;color:var(--text-tertiary)" id="dateRangeLabel"></span>
          </div>
          <div class="chart-body" id="timelineChart">
            <div class="loading"><div class="spinner"></div><span>Loading...</span></div>
          </div>
        </div>
        
        <!-- Events by Category -->
        <div class="chart-card">
          <div class="chart-header"><h3>📊 Events by Category</h3></div>
          <div class="chart-body" id="categoryChart">
            <div class="loading"><div class="spinner"></div><span>Loading...</span></div>
          </div>
        </div>
        
        <!-- Top Screens -->
        <div class="chart-card">
          <div class="chart-header"><h3>📱 Top Screens</h3></div>
          <div class="chart-body" id="screensChart">
            <div class="loading"><div class="spinner"></div><span>Loading...</span></div>
          </div>
        </div>
        
        <!-- Platforms -->
        <div class="chart-card">
          <div class="chart-header"><h3>💻 Platform Distribution</h3></div>
          <div class="chart-body" id="platformChart">
            <div class="loading"><div class="spinner"></div><span>Loading...</span></div>
          </div>
        </div>
        
        <!-- Top Events -->
        <div class="chart-card">
          <div class="chart-header"><h3>🎯 Top Events</h3></div>
          <div class="chart-body" id="eventsTable" style="padding:0;overflow-x:auto">
            <div class="loading"><div class="spinner"></div><span>Loading...</span></div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    const API_BASE = window.location.origin;
    let authToken = localStorage.getItem('analytics_token');
    
    // DOM Elements
    const loginPage = document.getElementById('loginPage');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dateRangeSelect = document.getElementById('dateRange');
    const platformSelect = document.getElementById('platform');
    
    // Check auth on load
    if (authToken) {
      showDashboard();
      fetchAnalytics();
    }
    
    // Login - Admin only
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginBtn.disabled = true;
      loginBtn.textContent = 'Signing in...';
      loginError.classList.remove('show');
      
      try {
        const res = await fetch(API_BASE + '/admin/analytics/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
          })
        });
        const data = await res.json();
        
        if (data.success && data.token) {
          authToken = data.token;
          localStorage.setItem('analytics_token', data.token);
          showDashboard();
          fetchAnalytics();
        } else {
          loginError.textContent = data.message || 'Invalid admin credentials';
          loginError.classList.add('show');
        }
      } catch (err) {
        loginError.textContent = 'Connection error. Please try again.';
        loginError.classList.add('show');
      }
      
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    });
    
    // Logout
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('analytics_token');
      authToken = null;
      loginPage.style.display = 'flex';
      dashboard.classList.remove('show');
    });
    
    // Refresh
    refreshBtn.addEventListener('click', () => fetchAnalytics());
    dateRangeSelect.addEventListener('change', () => fetchAnalytics());
    platformSelect.addEventListener('change', () => fetchAnalytics());
    
    function showDashboard() {
      loginPage.style.display = 'none';
      dashboard.classList.add('show');
    }
    
    async function fetchAnalytics() {
      const days = dateRangeSelect.value;
      const platform = platformSelect.value;
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      document.getElementById('dateRangeLabel').textContent = 'Last ' + days + ' days';
      
      try {
        let url = API_BASE + '/api/analytics/summary?startDate=' + startDate + '&endDate=' + endDate;
        if (platform) url += '&platform=' + platform;
        
        const res = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + authToken }
        });
        
        if (res.status === 401) {
          localStorage.removeItem('analytics_token');
          authToken = null;
          loginPage.style.display = 'flex';
          dashboard.classList.remove('show');
          return;
        }
        
        const data = await res.json();
        if (data.success) {
          renderStats(data.data.overview);
          renderTimeline(data.data.eventsOverTime);
          renderCategoryChart(data.data.eventsByCategory);
          renderScreensChart(data.data.topScreens);
          renderPlatformChart(data.data.eventsByPlatform, data.data.overview.totalEvents);
          renderEventsTable(data.data.topEvents);
        }
      } catch (err) {
        console.error('Error fetching analytics:', err);
      }
    }
    
    function renderStats(overview) {
      document.getElementById('totalEvents').textContent = (overview.totalEvents || 0).toLocaleString();
      document.getElementById('uniqueUsers').textContent = (overview.uniqueUsers || 0).toLocaleString();
      document.getElementById('sessions').textContent = (overview.uniqueSessions || 0).toLocaleString();
      document.getElementById('errorEvents').textContent = (overview.errorEvents || 0).toLocaleString();
    }
    
    function renderTimeline(data) {
      const container = document.getElementById('timelineChart');
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No timeline data available</p></div>';
        return;
      }
      
      const maxCount = Math.max(...data.map(d => parseInt(d.count) || 0));
      let html = '<div class="timeline">';
      data.forEach(d => {
        const height = maxCount > 0 ? ((d.count / maxCount) * 100) : 5;
        html += '<div class="timeline-bar" style="height:' + Math.max(height, 5) + '%" title="' + d.date + ': ' + d.count + ' events"></div>';
      });
      html += '</div><div class="timeline-labels">';
      html += '<span>' + new Date(data[0].date).toLocaleDateString() + '</span>';
      html += '<span>' + new Date(data[data.length-1].date).toLocaleDateString() + '</span>';
      html += '</div>';
      container.innerHTML = html;
    }
    
    function renderCategoryChart(data) {
      const container = document.getElementById('categoryChart');
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No category data</p></div>';
        return;
      }
      
      const maxCount = Math.max(...data.map(d => parseInt(d.count) || 0));
      let html = '<div class="bar-chart">';
      data.forEach((d, i) => {
        const pct = maxCount > 0 ? ((d.count / maxCount) * 100) : 0;
        html += '<div class="bar-row">';
        html += '<span class="bar-label" title="' + d.eventCategory + '">' + d.eventCategory + '</span>';
        html += '<div class="bar-track"><div class="bar-fill c' + (i % 6) + '" style="width:' + Math.max(pct, 2) + '%">';
        if (pct > 15) html += '<span>' + parseInt(d.count).toLocaleString() + '</span>';
        html += '</div></div>';
        html += '<span class="bar-count">' + parseInt(d.count).toLocaleString() + '</span>';
        html += '</div>';
      });
      html += '</div>';
      container.innerHTML = html;
    }
    
    function renderScreensChart(data) {
      const container = document.getElementById('screensChart');
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No screen data</p></div>';
        return;
      }
      
      const top = data.slice(0, 8);
      const maxCount = Math.max(...top.map(d => parseInt(d.count) || 0));
      let html = '<div class="bar-chart">';
      top.forEach((d, i) => {
        const pct = maxCount > 0 ? ((d.count / maxCount) * 100) : 0;
        html += '<div class="bar-row">';
        html += '<span class="bar-label" title="' + d.screenName + '">' + d.screenName + '</span>';
        html += '<div class="bar-track"><div class="bar-fill c0" style="width:' + Math.max(pct, 2) + '%"></div></div>';
        html += '<span class="bar-count">' + parseInt(d.count).toLocaleString() + '</span>';
        html += '</div>';
      });
      html += '</div>';
      container.innerHTML = html;
    }
    
    function renderPlatformChart(data, total) {
      const container = document.getElementById('platformChart');
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No platform data</p></div>';
        return;
      }
      
      const icons = { ios: '🍎', android: '🤖', web: '🌐' };
      let html = '<div class="platform-cards">';
      data.forEach(d => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        html += '<div class="platform-card">';
        html += '<div class="platform-icon">' + (icons[d.platform] || '📱') + '</div>';
        html += '<div class="platform-info"><h4>' + d.platform + '</h4><p>' + parseInt(d.count).toLocaleString() + ' events</p></div>';
        html += '<div class="platform-percent">' + pct + '%</div>';
        html += '</div>';
      });
      html += '</div>';
      container.innerHTML = html;
    }
    
    function renderEventsTable(data) {
      const container = document.getElementById('eventsTable');
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:40px"><p>No events recorded</p></div>';
        return;
      }
      
      let html = '<table class="events-table"><thead><tr><th>Event Name</th><th>Category</th><th>Count</th></tr></thead><tbody>';
      data.slice(0, 15).forEach(d => {
        html += '<tr>';
        html += '<td>' + d.eventName + '</td>';
        html += '<td><span class="event-badge ' + (d.eventCategory || 'other') + '">' + (d.eventCategory || 'other') + '</span></td>';
        html += '<td>' + parseInt(d.count).toLocaleString() + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(analyticsHTML);
});

// Funnel Analytics Page (Mobile App Funnels) - Simplified Version
app.get("/admin/funnel-analytics", (req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:* https://*.vercel.app"
  );
  const funnelHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Operation Timing Analytics - Create App</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-50: #eff6ff; --primary-100: #dbeafe; --primary-200: #bfdbfe;
      --primary-500: #3b82f6; --primary-600: #2563eb; --primary-700: #1d4ed8;
      --primary-900: #0f172a;
      --success-50: #f0fdf4; --success-100: #dcfce7; --success-500: #22c55e; --success-600: #16a34a;
      --warning-50: #fffbeb; --warning-100: #fef3c7; --warning-500: #f59e0b;
      --error-100: #fee2e2; --error-500: #ef4444;
      --purple-50: #faf5ff; --purple-100: #f3e8ff; --purple-500: #a855f7;
      --neutral-50: #f8fafc; --neutral-100: #f1f5f9; --neutral-200: #e2e8f0;
      --text-primary: #0f172a; --text-secondary: #475569; --text-tertiary: #64748b;
      --bg-primary: #f8fafc; --bg-secondary: #ffffff;
      --border-light: #e2e8f0;
      --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg-primary); min-height: 100vh; color: var(--text-primary); }
    
    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-900) 0%, #1e3a5f 100%); padding: 20px; }
    .login-card { background: var(--bg-secondary); border-radius: var(--radius-xl); padding: 40px; width: 100%; max-width: 400px; box-shadow: var(--shadow-md); }
    .login-logo { font-size: 28px; font-weight: 800; color: var(--primary-600); text-align: center; margin-bottom: 8px; }
    .login-subtitle { color: var(--text-tertiary); text-align: center; margin-bottom: 32px; font-size: 14px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
    .form-group input { width: 100%; padding: 12px 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); font-size: 14px; font-family: inherit; }
    .form-group input:focus { outline: none; border-color: var(--primary-500); box-shadow: 0 0 0 3px var(--primary-100); }
    .login-btn { width: 100%; padding: 14px; background: var(--primary-600); color: white; border: none; border-radius: var(--radius-md); font-size: 15px; font-weight: 600; cursor: pointer; }
    .login-btn:hover { background: var(--primary-700); }
    .login-error { background: var(--error-100); color: var(--error-500); padding: 12px; border-radius: var(--radius-md); margin-bottom: 20px; font-size: 14px; display: none; }
    .login-error.show { display: block; }
    
    .dashboard { display: none; }
    .dashboard.show { display: block; }
    .header { background: var(--bg-secondary); border-bottom: 1px solid var(--border-light); padding: 16px 24px; position: sticky; top: 0; z-index: 100; }
    .header-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-logo { font-size: 22px; font-weight: 800; color: var(--primary-600); }
    .header-title { font-size: 18px; font-weight: 600; color: var(--text-primary); }
    .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .filter-select { padding: 8px 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); font-size: 13px; font-family: inherit; background: var(--bg-secondary); cursor: pointer; }
    .btn { padding: 8px 16px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; border: 1px solid; transition: all 0.2s; text-decoration: none; }
    .btn-refresh { background: var(--primary-50); color: var(--primary-600); border-color: var(--primary-200); }
    .btn-refresh:hover { background: var(--primary-100); }
    .btn-back { background: var(--neutral-100); color: var(--text-secondary); border-color: var(--border-light); }
    .btn-logout { background: var(--neutral-100); color: var(--text-secondary); border-color: var(--border-light); }
    .btn-logout:hover { background: var(--error-100); color: var(--error-500); }
    
    .main { max-width: 1200px; margin: 0 auto; padding: 24px; }
    
    .card { background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-light); margin-bottom: 24px; overflow: hidden; }
    .card-header { padding: 20px 24px; border-bottom: 1px solid var(--border-light); background: var(--neutral-50); }
    .card-header h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px; }
    .card-body { padding: 0; }
    
    .timing-table { width: 100%; border-collapse: collapse; }
    .timing-table th, .timing-table td { padding: 16px 24px; text-align: left; border-bottom: 1px solid var(--border-light); }
    .timing-table th { font-weight: 600; color: var(--text-secondary); background: var(--neutral-50); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .timing-table tr:last-child td { border-bottom: none; }
    .timing-table tr:hover td { background: var(--neutral-50); }
    
    .op-name { display: flex; align-items: center; gap: 12px; }
    .op-icon { width: 40px; height: 40px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .op-icon.onboarding { background: var(--primary-100); }
    .op-icon.project { background: var(--success-100); }
    .op-icon.draft { background: var(--warning-100); }
    .op-icon.client { background: var(--purple-100); }
    .op-label { font-weight: 600; font-size: 15px; color: var(--text-primary); }
    .op-desc { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
    
    .count-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; padding: 6px 12px; border-radius: 20px; font-weight: 700; font-size: 14px; }
    .count-badge.started { background: var(--primary-100); color: var(--primary-700); }
    .count-badge.completed { background: var(--success-100); color: var(--success-600); }
    
    .time-display { font-size: 16px; font-weight: 600; color: var(--text-primary); }
    .time-range { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; }
    
    .rate-bar { display: flex; align-items: center; gap: 10px; }
    .rate-bar-track { flex: 1; height: 8px; background: var(--neutral-200); border-radius: 4px; overflow: hidden; max-width: 100px; }
    .rate-bar-fill { height: 100%; background: linear-gradient(90deg, var(--success-500), var(--success-400)); border-radius: 4px; transition: width 0.5s ease; }
    .rate-value { font-weight: 700; font-size: 14px; color: var(--success-600); min-width: 45px; }
    
    .empty-state { text-align: center; padding: 60px 40px; color: var(--text-tertiary); }
    .empty-state h4 { font-size: 18px; color: var(--text-secondary); margin-bottom: 8px; }
    .empty-state p { font-size: 14px; }
    
    .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--text-tertiary); }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--border-light); border-top-color: var(--primary-500); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .info-banner { background: linear-gradient(135deg, var(--primary-50), var(--primary-100)); border: 1px solid var(--primary-200); border-radius: var(--radius-lg); padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
    .info-banner-icon { font-size: 24px; }
    .info-banner-text { font-size: 14px; color: var(--primary-700); }
    .info-banner-text strong { font-weight: 600; }
    
    @media (max-width: 768px) {
      .timing-table th, .timing-table td { padding: 12px 16px; }
      .timing-table th:nth-child(4), .timing-table td:nth-child(4) { display: none; }
      .header-content { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div id="loginPage" class="login-container">
    <div class="login-card">
      <div class="login-logo">Create</div>
      <p class="login-subtitle">Operation Timing Analytics</p>
      <div id="loginError" class="login-error"></div>
      <form id="loginForm">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" placeholder="Enter admin email" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" placeholder="Enter password" required>
        </div>
        <button type="submit" class="login-btn">Sign In</button>
      </form>
    </div>
  </div>

  <div id="dashboard" class="dashboard">
    <header class="header">
      <div class="header-content">
        <div class="header-left">
          <span class="header-logo">Create</span>
          <span class="header-title">⏱️ Operation Timing</span>
        </div>
        <div class="header-right">
          <select id="dateRange" class="filter-select">
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30" selected>Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <select id="platform" class="filter-select">
            <option value="">All Platforms</option>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
          <button id="refreshBtn" class="btn btn-refresh">🔄 Refresh</button>
          <a href="/admin/analytics" class="btn btn-back">📈 Events</a>
          <button id="logoutBtn" class="btn btn-logout">Logout</button>
        </div>
      </div>
    </header>
    
    <main class="main">
      <div class="info-banner">
        <span class="info-banner-icon">📊</span>
        <span class="info-banner-text">Track <strong>start time</strong> and <strong>completion time</strong> for key user operations in the mobile app</span>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3>⏱️ Operation Timing Summary</h3>
        </div>
        <div class="card-body" id="timingTable">
          <div class="loading"><div class="spinner"></div><span>Loading...</span></div>
        </div>
      </div>
    </main>
  </div>

  <script>
    const API = window.location.origin;
    let token = localStorage.getItem('analytics_token');
    
    const loginPage = document.getElementById('loginPage');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    
    if (token) { showDashboard(); fetchData(); }
    
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.remove('show');
      try {
        const res = await fetch(API + '/admin/analytics/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value })
        });
        const data = await res.json();
        if (data.success && data.token) {
          token = data.token;
          localStorage.setItem('analytics_token', data.token);
          showDashboard();
          fetchData();
        } else {
          loginError.textContent = data.message || 'Invalid credentials';
          loginError.classList.add('show');
        }
      } catch (err) {
        loginError.textContent = 'Connection error';
        loginError.classList.add('show');
      }
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('analytics_token');
      token = null;
      loginPage.style.display = 'flex';
      dashboard.classList.remove('show');
    });
    
    document.getElementById('refreshBtn').addEventListener('click', fetchData);
    document.getElementById('dateRange').addEventListener('change', fetchData);
    document.getElementById('platform').addEventListener('change', fetchData);
    
    function showDashboard() {
      loginPage.style.display = 'none';
      dashboard.classList.add('show');
    }
    
    async function fetchData() {
      const days = document.getElementById('dateRange').value;
      const platform = document.getElementById('platform').value;
      const end = new Date().toISOString();
      const start = days === 'all' ? '' : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      let url = API + '/api/analytics/admin-dashboard?endDate=' + end;
      if (start) url += '&startDate=' + start;
      if (platform) url += '&platform=' + platform;
      
      document.getElementById('timingTable').innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading...</span></div>';
      
      try {
        const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.status === 401) { document.getElementById('logoutBtn').click(); return; }
        
        const data = await res.json();
        
        if (data.success && data.data) {
          renderTimingTable(data.data.funnelAnalytics || {});
        } else {
          document.getElementById('timingTable').innerHTML = '<div class="empty-state"><h4>Error</h4><p>' + (data.message || 'Failed to load data') + '</p></div>';
        }
      } catch (err) { 
        console.error('Fetch error:', err);
        document.getElementById('timingTable').innerHTML = '<div class="empty-state"><h4>Connection Error</h4><p>' + (err.message || 'Network error') + '</p></div>';
      }
    }
    
    function formatTime(ms) {
      if (!ms || ms === 0) return '—';
      if (ms < 1000) return ms + 'ms';
      if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
      if (ms < 3600000) return (ms / 60000).toFixed(1) + 'm';
      return (ms / 3600000).toFixed(1) + 'h';
    }
    
    function renderTimingTable(f) {
      const operations = [
        {
          name: 'Onboarding',
          desc: 'User signup & profile setup',
          icon: 'onboarding',
          emoji: '🚀',
          data: f.onboarding || {}
        },
        {
          name: 'Project Creation',
          desc: 'Creating a new project',
          icon: 'project',
          emoji: '📁',
          data: f.projectCreation || {}
        },
        {
          name: 'Draft Update',
          desc: 'Updating a draft project',
          icon: 'draft',
          emoji: '📝',
          data: f.draftUpdate || {}
        },
        {
          name: 'Client Creation',
          desc: 'Adding a new client',
          icon: 'client',
          emoji: '👤',
          data: f.clientCreation || {}
        }
      ];
      
      const hasAnyData = operations.some(op => op.data.started > 0 || op.data.completed > 0);
      
      if (!hasAnyData) {
        document.getElementById('timingTable').innerHTML = '<div class="empty-state"><h4>No Data Yet</h4><p>Start using the mobile app to track operation timings.<br>Events will appear here once users perform these actions.</p></div>';
        return;
      }
      
      let html = '<table class="timing-table">';
      html += '<thead><tr><th>Operation</th><th>Started</th><th>Completed</th><th>Avg Time</th><th>Completion Rate</th></tr></thead>';
      html += '<tbody>';
      
      operations.forEach(op => {
        const started = op.data.started || 0;
        const completed = op.data.completed || 0;
        const avgTime = op.data.avgCompletionTimeMs || 0;
        const rate = op.data.completionRate || 0;
        const minTime = op.data.minCompletionTimeMs || 0;
        const maxTime = op.data.maxCompletionTimeMs || 0;
        
        html += '<tr>';
        html += '<td><div class="op-name"><div class="op-icon ' + op.icon + '">' + op.emoji + '</div><div><div class="op-label">' + op.name + '</div><div class="op-desc">' + op.desc + '</div></div></div></td>';
        html += '<td><span class="count-badge started">' + started + '</span></td>';
        html += '<td><span class="count-badge completed">' + completed + '</span></td>';
        html += '<td><div class="time-display">' + formatTime(avgTime) + '</div>';
        if (minTime > 0 || maxTime > 0) {
          html += '<div class="time-range">Min: ' + formatTime(minTime) + ' / Max: ' + formatTime(maxTime) + '</div>';
        }
        html += '</td>';
        html += '<td><div class="rate-bar"><div class="rate-bar-track"><div class="rate-bar-fill" style="width:' + Math.min(rate, 100) + '%"></div></div><span class="rate-value">' + rate + '%</span></div></td>';
        html += '</tr>';
      });
      
      html += '</tbody></table>';
      document.getElementById('timingTable').innerHTML = html;
    }
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(funnelHTML);
});

// Push Notification Admin Page
app.get("/admin/notifications", (req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:* https://*.vercel.app"
  );
  const notificationsHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Push Notifications - Create App</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-50: #eff6ff; --primary-100: #dbeafe; --primary-200: #bfdbfe;
      --primary-500: #3b82f6; --primary-600: #2563eb; --primary-700: #1d4ed8;
      --primary-900: #0f172a;
      --success-100: #dcfce7; --success-500: #22c55e; --success-600: #16a34a;
      --warning-100: #fef3c7; --warning-500: #f59e0b;
      --error-100: #fee2e2; --error-500: #ef4444;
      --neutral-50: #f8fafc; --neutral-100: #f1f5f9; --neutral-200: #e2e8f0;
      --text-primary: #0f172a; --text-secondary: #475569; --text-tertiary: #64748b;
      --bg-primary: #f8fafc; --bg-secondary: #ffffff;
      --border-light: #e2e8f0;
      --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg-primary); min-height: 100vh; color: var(--text-primary); }
    
    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-900) 0%, #1e3a5f 100%); padding: 20px; }
    .login-card { background: var(--bg-secondary); border-radius: var(--radius-xl); padding: 40px; width: 100%; max-width: 400px; box-shadow: var(--shadow-md); }
    .login-logo { font-size: 28px; font-weight: 800; color: var(--primary-600); text-align: center; margin-bottom: 8px; }
    .login-subtitle { color: var(--text-tertiary); text-align: center; margin-bottom: 32px; font-size: 14px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); font-size: 14px; font-family: inherit; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: var(--primary-500); box-shadow: 0 0 0 3px var(--primary-100); }
    .form-group textarea { min-height: 100px; resize: vertical; }
    .login-btn, .send-btn { width: 100%; padding: 14px; background: var(--primary-600); color: white; border: none; border-radius: var(--radius-md); font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .login-btn:hover, .send-btn:hover { background: var(--primary-700); }
    .login-btn:disabled, .send-btn:disabled { opacity: 0.7; cursor: not-allowed; }
    .login-error, .message { padding: 12px; border-radius: var(--radius-md); margin-bottom: 20px; font-size: 14px; display: none; }
    .login-error { background: var(--error-100); color: var(--error-500); }
    .message.success { background: var(--success-100); color: var(--success-600); display: block; }
    .message.error { background: var(--error-100); color: var(--error-500); display: block; }
    .login-error.show { display: block; }
    
    .dashboard { display: none; }
    .dashboard.show { display: block; }
    .header { background: var(--bg-secondary); border-bottom: 1px solid var(--border-light); padding: 16px 24px; position: sticky; top: 0; z-index: 100; }
    .header-content { max-width: 900px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-logo { font-size: 22px; font-weight: 800; color: var(--primary-600); }
    .header-title { font-size: 18px; font-weight: 600; color: var(--text-primary); }
    .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .btn { padding: 8px 16px; border-radius: var(--radius-md); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; border: 1px solid; transition: all 0.2s; text-decoration: none; }
    .btn-back { background: var(--neutral-100); color: var(--text-secondary); border-color: var(--border-light); }
    .btn-logout { background: var(--neutral-100); color: var(--text-secondary); border-color: var(--border-light); }
    .btn-logout:hover { background: var(--error-100); color: var(--error-500); }
    
    .main { max-width: 900px; margin: 0 auto; padding: 24px; }
    
    .card { background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-light); margin-bottom: 24px; overflow: hidden; }
    .card-header { padding: 20px 24px; border-bottom: 1px solid var(--border-light); background: var(--neutral-50); }
    .card-header h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px; }
    .card-body { padding: 24px; }
    
    .users-list { max-height: 200px; overflow-y: auto; border: 1px solid var(--border-light); border-radius: var(--radius-md); margin-bottom: 16px; }
    .user-item { padding: 12px 16px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s; }
    .user-item:last-child { border-bottom: none; }
    .user-item:hover { background: var(--neutral-50); }
    .user-item.selected { background: var(--primary-50); border-left: 3px solid var(--primary-500); }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--primary-100); color: var(--primary-600); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; }
    .user-info { flex: 1; }
    .user-name { font-weight: 600; font-size: 14px; }
    .user-email { font-size: 12px; color: var(--text-tertiary); }
    .user-check { color: var(--success-500); font-size: 18px; display: none; }
    .user-item.selected .user-check { display: block; }
    
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-box { background: var(--neutral-50); border-radius: var(--radius-md); padding: 16px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 700; color: var(--primary-600); }
    .stat-label { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; }
    
    .history-table { width: 100%; border-collapse: collapse; }
    .history-table th, .history-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border-light); font-size: 13px; }
    .history-table th { background: var(--neutral-50); font-weight: 600; color: var(--text-secondary); }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.sent { background: var(--success-100); color: var(--success-600); }
    .status-badge.pending { background: var(--warning-100); color: var(--warning-500); }
    .status-badge.failed { background: var(--error-100); color: var(--error-500); }
    
    .empty-state { text-align: center; padding: 40px; color: var(--text-tertiary); }
    .loading { display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-tertiary); gap: 12px; }
    .spinner { width: 24px; height: 24px; border: 3px solid var(--border-light); border-top-color: var(--primary-500); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loginPage" class="login-container">
    <div class="login-card">
      <div class="login-logo">Create</div>
      <p class="login-subtitle">Push Notifications Admin</p>
      <div id="loginError" class="login-error"></div>
      <form id="loginForm">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" placeholder="Enter admin email" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" placeholder="Enter password" required>
        </div>
        <button type="submit" class="login-btn">Sign In</button>
      </form>
    </div>
  </div>

  <div id="dashboard" class="dashboard">
    <header class="header">
      <div class="header-content">
        <div class="header-left">
          <span class="header-logo">Create</span>
          <span class="header-title">🔔 Push Notifications</span>
        </div>
        <div class="header-right">
          <a href="/admin/analytics" class="btn btn-back">📈 Analytics</a>
          <button id="logoutBtn" class="btn btn-logout">Logout</button>
        </div>
      </div>
    </header>
    
    <main class="main">
      <!-- Stats -->
      <div class="stats-row" id="statsRow">
        <div class="stat-box">
          <div class="stat-value" id="totalUsers">-</div>
          <div class="stat-label">Users with Push Tokens</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" id="totalSent">-</div>
          <div class="stat-label">Notifications Sent</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" id="totalRead">-</div>
          <div class="stat-label">Read</div>
        </div>
      </div>
      
      <!-- Send Notification -->
      <div class="card">
        <div class="card-header">
          <h3>📤 Send Push Notification</h3>
        </div>
        <div class="card-body">
          <div id="sendMessage" class="message"></div>
          <form id="sendForm">
            <div class="form-group">
              <label>Select User</label>
              <div class="users-list" id="usersList">
                <div class="loading"><div class="spinner"></div><span>Loading users...</span></div>
              </div>
              <input type="hidden" id="selectedUserId" required>
            </div>
            <div class="form-group">
              <label for="notifType">Notification Type</label>
              <select id="notifType">
                <option value="general">General</option>
                <option value="project_approved">Project Approved</option>
                <option value="project_rejected">Project Rejected</option>
                <option value="project_update">Project Update</option>
                <option value="payment_received">Payment Received</option>
                <option value="payment_pending">Payment Pending</option>
                <option value="message">Message</option>
                <option value="reminder">Reminder</option>
                <option value="system">System</option>
              </select>
            </div>
            <div class="form-group">
              <label for="notifTitle">Title</label>
              <input type="text" id="notifTitle" placeholder="Notification title" required>
            </div>
            <div class="form-group">
              <label for="notifBody">Message</label>
              <textarea id="notifBody" placeholder="Notification message..." required></textarea>
            </div>
            <button type="submit" class="send-btn" id="sendBtn">🚀 Send Notification</button>
          </form>
        </div>
      </div>
      
      <!-- Recent Notifications -->
      <div class="card">
        <div class="card-header">
          <h3>📋 Recent Notifications</h3>
        </div>
        <div class="card-body" style="padding:0">
          <div id="historyTable">
            <div class="loading"><div class="spinner"></div><span>Loading...</span></div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    const API = window.location.origin;
    let token = localStorage.getItem('analytics_token');
    let selectedUserId = null;
    
    const loginPage = document.getElementById('loginPage');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const sendForm = document.getElementById('sendForm');
    const sendMessage = document.getElementById('sendMessage');
    
    if (token) { showDashboard(); loadData(); }
    
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.remove('show');
      try {
        const res = await fetch(API + '/admin/analytics/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value })
        });
        const data = await res.json();
        if (data.success && data.token) {
          token = data.token;
          localStorage.setItem('analytics_token', data.token);
          showDashboard();
          loadData();
        } else {
          loginError.textContent = data.message || 'Invalid credentials';
          loginError.classList.add('show');
        }
      } catch (err) {
        loginError.textContent = 'Connection error';
        loginError.classList.add('show');
      }
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('analytics_token');
      token = null;
      loginPage.style.display = 'flex';
      dashboard.classList.remove('show');
    });
    
    function showDashboard() {
      loginPage.style.display = 'none';
      dashboard.classList.add('show');
    }
    
    async function loadData() {
      await Promise.all([loadUsers(), loadStats(), loadHistory()]);
    }
    
    async function loadUsers() {
      try {
        const res = await fetch(API + '/user/all', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        
        if (data.success && data.users) {
          const container = document.getElementById('usersList');
          if (data.users.length === 0) {
            container.innerHTML = '<div class="empty-state">No users found</div>';
            return;
          }
          
          container.innerHTML = data.users.map(u => {
            const initials = ((u.firstName || '')[0] || '') + ((u.lastName || '')[0] || '') || 'U';
            return '<div class="user-item" data-id="' + u.uid + '">' +
              '<div class="user-avatar">' + initials.toUpperCase() + '</div>' +
              '<div class="user-info"><div class="user-name">' + (u.firstName || '') + ' ' + (u.lastName || '') + '</div>' +
              '<div class="user-email">' + (u.email || 'No email') + '</div></div>' +
              '<span class="user-check">✓</span></div>';
          }).join('');
          
          container.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', () => {
              container.querySelectorAll('.user-item').forEach(i => i.classList.remove('selected'));
              item.classList.add('selected');
              selectedUserId = item.dataset.id;
              document.getElementById('selectedUserId').value = selectedUserId;
            });
          });
        }
      } catch (err) {
        console.error('Load users error:', err);
      }
    }
    
    async function loadStats() {
      try {
        const res = await fetch(API + '/notifications/stats', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        
        if (data.success && data.stats) {
          document.getElementById('totalUsers').textContent = data.stats.tokens?.uniqueUsers || 0;
          const sentCount = Object.values(data.stats.notifications?.byStatus || {}).reduce((a, b) => a + b, 0);
          document.getElementById('totalSent').textContent = sentCount;
          document.getElementById('totalRead').textContent = data.stats.notifications?.byStatus?.read || 0;
        }
      } catch (err) {
        console.error('Load stats error:', err);
      }
    }
    
    async function loadHistory() {
      try {
        const container = document.getElementById('historyTable');
        // This would require a new endpoint to get all notifications
        // For now, just show a message
        container.innerHTML = '<div class="empty-state">Send notifications above to see history</div>';
      } catch (err) {
        console.error('Load history error:', err);
      }
    }
    
    sendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!selectedUserId) {
        sendMessage.className = 'message error';
        sendMessage.textContent = 'Please select a user';
        return;
      }
      
      const sendBtn = document.getElementById('sendBtn');
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
      sendMessage.className = 'message';
      sendMessage.style.display = 'none';
      
      try {
        const res = await fetch(API + '/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            userId: selectedUserId,
            title: document.getElementById('notifTitle').value,
            body: document.getElementById('notifBody').value,
            type: document.getElementById('notifType').value
          })
        });
        
        const data = await res.json();
        
        if (data.success) {
          sendMessage.className = 'message success';
          sendMessage.textContent = '✅ Notification sent successfully!' + (data.pushSent ? ' (Push delivered)' : ' (Saved, no push token)');
          sendForm.reset();
          document.querySelectorAll('.user-item').forEach(i => i.classList.remove('selected'));
          selectedUserId = null;
          loadStats();
        } else {
          sendMessage.className = 'message error';
          sendMessage.textContent = '❌ ' + (data.message || 'Failed to send notification');
        }
      } catch (err) {
        sendMessage.className = 'message error';
        sendMessage.textContent = '❌ Connection error: ' + err.message;
      }
      
      sendBtn.disabled = false;
      sendBtn.textContent = '🚀 Send Notification';
    });
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(notificationsHTML);
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
  .then(async () => {
    logger.info("Database connected successfully");
    
    // Add 'funnel' to eventCategory ENUM if it doesn't exist (PostgreSQL specific)
    try {
      await db.sequelize.query(`
        DO $$ BEGIN
          ALTER TYPE "enum_analytics_eventCategory" ADD VALUE IF NOT EXISTS 'funnel';
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      logger.info("Analytics eventCategory ENUM updated with 'funnel' value");
    } catch (enumError) {
      // Ignore errors if the enum type doesn't exist yet (first run)
      logger.warn("Could not update eventCategory ENUM (may not exist yet):", enumError.message);
    }
    
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
