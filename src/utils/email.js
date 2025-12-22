/**
 * Email Service using Nodemailer (Gmail SMTP) with Resend fallback
 * Gmail SMTP works immediately without domain verification
 */

const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const logger = require("./logger");

// Initialize Resend (fallback)
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Gmail transporter
const createGmailTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
    },
  });
};

// Default sender
const DEFAULT_FROM = process.env.GMAIL_USER || process.env.RESEND_FROM_EMAIL || "noreply@createit.pk";

/**
 * Send email using Gmail SMTP (primary) or Resend (fallback)
 * @param {Object} options - Email options
 * @returns {Promise<boolean>}
 */
const sendEmail = async ({ to, subject, html, text }) => {
  logger.info("Attempting to send email", { 
    to, 
    subject,
    hasGmailUser: !!process.env.GMAIL_USER,
    hasGmailPassword: !!process.env.GMAIL_APP_PASSWORD,
    hasResendKey: !!process.env.RESEND_API_KEY
  });

  // Try Gmail SMTP first (works without domain verification)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      logger.info("Using Gmail SMTP", { user: process.env.GMAIL_USER });
      const transporter = createGmailTransporter();
      
      const result = await transporter.sendMail({
        from: `Create App <${process.env.GMAIL_USER}>`,
        to: to,
        subject: subject,
        html: html,
        text: text,
      });

      logger.info("Email sent via Gmail SMTP", { messageId: result.messageId, to });
      return true;
    } catch (error) {
      logger.error("Gmail SMTP failed", { 
        error: error.message, 
        code: error.code,
        command: error.command,
        to 
      });
    }
  } else {
    logger.warn("Gmail credentials not configured", {
      GMAIL_USER: process.env.GMAIL_USER ? "SET" : "NOT SET",
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? "SET" : "NOT SET"
    });
  }

  // Fallback to Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Create App <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: html,
        text: text,
      });

      if (error) {
        logger.error("Resend failed", { error, to });
        return false;
      }

      logger.info("Email sent via Resend", { emailId: data.id, to });
      return true;
    } catch (error) {
      logger.error("Resend error", { error: error.message, to });
      return false;
    }
  }

  logger.error("No email service configured", { to });
  return false;
};

/**
 * Send password reset email with new temporary password
 */
const sendPasswordResetEmail = async (to, newPassword, firstName = "User") => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your New Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background-color: #0a1a33; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Create</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px; color: #0a1a33; font-size: 24px; font-weight: 600;">Your New Password</h2>
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Hello ${firstName},
                  </p>
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Your new temporary password is:
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <div style="display: inline-block; padding: 20px 40px; background-color: #f0f4f8; border: 2px dashed #0a1a33; border-radius: 12px;">
                          <span style="font-size: 24px; font-weight: 700; color: #0a1a33; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                            ${newPassword}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Please change your password after logging in.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} Create App. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Hello ${firstName},\n\nYour new temporary password is: ${newPassword}\n\nPlease change your password after logging in.\n\n- The Create App Team`;

  return sendEmail({
    to,
    subject: "Reset your Create App password",
    html,
    text,
  });
};

/**
 * Send welcome email after signup
 */
const sendWelcomeEmail = async (to, firstName = "User") => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background-color: #0a1a33; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Welcome to Create!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Hello ${firstName},
                  </p>
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Welcome to Create App! We're excited to have you on board.
                  </p>
                  <p style="margin: 0; color: #666666; font-size: 14px;">
                    - The Create App Team
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: "Welcome to Create App! 🎉",
    html,
  });
};

/**
 * Send password reset link email (secure token-based)
 */
const sendPasswordResetLinkEmail = async (to, resetUrl, firstName = "User") => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background-color: #0a1a33; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Create</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px; color: #0a1a33; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Hello ${firstName},
                  </p>
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    We received a request to reset your password. Click the button below to choose a new password:
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}" 
                           style="display: inline-block; padding: 16px 40px; background-color: #0a1a33; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0 0 10px; color: #666666; font-size: 14px; line-height: 1.6;">
                    Or copy and paste this link into your browser:
                  </p>
                  <p style="margin: 0 0 20px; color: #0a1a33; font-size: 14px; word-break: break-all;">
                    ${resetUrl}
                  </p>
                  <p style="margin: 0 0 20px; color: #333333; font-size: 14px; line-height: 1.6;">
                    <strong>This link will expire in 1 hour.</strong>
                  </p>
                  <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
                  <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                    If you didn't request a password reset, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="margin: 0 0 10px; color: #666666; font-size: 13px;">
                    Need help? Contact us at <a href="mailto:dev@createit.pk" style="color: #0a1a33;">dev@createit.pk</a>
                  </p>
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} Create App. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Hello ${firstName},\n\nWe received a request to reset your password.\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.\n\n- The Create App Team`;

  return sendEmail({
    to,
    subject: "Reset your Create App password",
    html,
    text,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordResetLinkEmail,
  sendWelcomeEmail,
};
