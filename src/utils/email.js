/**
 * Email Service using Resend
 * @see https://resend.com/docs
 */

const { Resend } = require("resend");
const logger = require("./logger");

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender email (must be verified in Resend dashboard)
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || "Create App <noreply@createit.pk>";

/**
 * Send password reset email with new temporary password
 * @param {string} to - Recipient email address
 * @param {string} newPassword - The new temporary password
 * @param {string} firstName - User's first name
 * @returns {Promise<boolean>} - True if email sent successfully
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
              <!-- Header -->
              <tr>
                <td style="background-color: #0a1a33; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Create</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px; color: #0a1a33; font-size: 24px; font-weight: 600;">Your New Password</h2>
                  
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Hello ${firstName},
                  </p>
                  
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    We received a request to reset your password for your Create account. Your new temporary password is:
                  </p>
                  
                  <!-- Password Box -->
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
                    Please use this password to log in to your account. We strongly recommend changing your password after logging in for security purposes.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
                  
                  <p style="margin: 0 0 10px; color: #ff6b6b; font-size: 14px; line-height: 1.5; font-weight: 600;">
                    ⚠️ Security Notice
                  </p>
                  
                  <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                    If you didn't request a password reset, please contact us immediately at <a href="mailto:dev@createit.pk" style="color: #0a1a33;">dev@createit.pk</a> as someone may be trying to access your account.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
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

  const text = `
Hello ${firstName},

We received a request to reset your password for your Create account.

Your new temporary password is: ${newPassword}

Please use this password to log in to your account. We strongly recommend changing your password after logging in for security purposes.

If you didn't request a password reset, please contact us immediately at dev@createit.pk

- The Create App Team
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: "Reset your Create App password",
      html: html,
      text: text,
    });

    if (error) {
      logger.error("Failed to send password reset email via Resend", { error, to });
      return false;
    }

    logger.info("Password reset email sent successfully", { emailId: data.id, to });
    return true;
  } catch (error) {
    logger.error("Error sending password reset email", { error: error.message, to });
    return false;
  }
};

/**
 * Send welcome email after signup
 * @param {string} to - Recipient email address
 * @param {string} firstName - User's first name
 * @returns {Promise<boolean>}
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
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Start managing your projects, clients, and finances all in one place.
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

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: "Welcome to Create App! 🎉",
      html: html,
    });

    if (error) {
      logger.error("Failed to send welcome email", { error, to });
      return false;
    }

    logger.info("Welcome email sent", { emailId: data.id, to });
    return true;
  } catch (error) {
    logger.error("Error sending welcome email", { error: error.message, to });
    return false;
  }
};

/**
 * Send password reset link email (secure token-based)
 * @param {string} to - Recipient email address
 * @param {string} resetUrl - The password reset URL with token
 * @param {string} firstName - User's first name
 * @returns {Promise<boolean>} - True if email sent successfully
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
              <!-- Header -->
              <tr>
                <td style="background-color: #0a1a33; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Create</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px; color: #0a1a33; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                  
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Hello ${firstName},
                  </p>
                  
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    We received a request to reset your password. Click the button below to choose a new password:
                  </p>
                  
                  <!-- CTA Button -->
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
                  
                  <p style="margin: 0 0 10px; color: #ff6b6b; font-size: 14px; line-height: 1.5; font-weight: 600;">
                    ⚠️ Didn't request this?
                  </p>
                  
                  <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                    If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
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

  const text = `
Hello ${firstName},

We received a request to reset your password.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

- The Create App Team
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: "Reset your Create App password",
      html: html,
      text: text,
    });

    if (error) {
      logger.error("Failed to send password reset link email via Resend", { error, to });
      return false;
    }

    logger.info("Password reset link email sent successfully", { emailId: data.id, to });
    return true;
  } catch (error) {
    logger.error("Error sending password reset link email", { error: error.message, to });
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendPasswordResetLinkEmail,
  sendWelcomeEmail,
};

