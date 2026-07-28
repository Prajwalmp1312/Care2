const nodemailer = require("nodemailer");
const crypto = require("crypto");
const config = require("../config");
const logger = require("./logger");

const emailUser = config.email.user;
const emailPassword = config.email.password;
const emailService = config.email.service;

let emailTransporter;
if (emailUser && emailPassword) {
  emailTransporter = nodemailer.createTransport({
    service: emailService,
    auth: { user: emailUser, pass: emailPassword },
  });
  emailTransporter.verify((error) => {
    if (error) logger.warn({ err: error.message }, "Email verification failed");
    else logger.info("Email service ready");
  });
} else {
  logger.warn("Email credentials not configured; password reset emails disabled");
  emailTransporter = {
    sendMail: async (options) => {
      logger.info({ to: options.to }, "Email suppressed (service disabled)");
      return { response: "Email service disabled" };
    },
    verify: (cb) => cb(new Error("Email service not configured")),
  };
}

function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

// Helper function to hash password

async function sendPasswordResetEmail(email, resetToken, userName) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Request - Meal Planner',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF9500 0%, #FF6B6B 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍽️ Meal Planner</h1>
        </div>
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hello ${userName || 'User'},</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to set a new password.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #FF9500 0%, #FF6B6B 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            Or copy and paste this link in your browser:<br>
            <span style="color: #666; word-break: break-all;">${resetUrl}</span>
          </p>
          <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px;">
            <p style="color: #999; font-size: 12px;">
              This password reset link will expire in 24 hours.
            </p>
            <p style="color: #999; font-size: 12px;">
              If you didn't request this email, you can ignore it safely.
            </p>
          </div>
        </div>
      </div>
    `
  };

  return new Promise((resolve, reject) => {
    emailTransporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending reset email:", error);
        reject(error);
      } else {
        console.log("Reset email sent:", info.response);
        resolve(info);
      }
    });
  });
}

// Comprehensive food ingredient mapping for better detection (Enhanced)

module.exports = { emailTransporter, generateResetToken, sendPasswordResetEmail };
