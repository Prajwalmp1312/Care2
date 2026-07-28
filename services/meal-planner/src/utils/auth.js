const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");

async function hashPassword(password) {
  const salt = await bcryptjs.genSalt(10);
  return await bcryptjs.hash(password, salt);
}

// Helper function to compare passwords
async function comparePasswords(plainPassword, hashedPassword) {
  return await bcryptjs.compare(plainPassword, hashedPassword);
}

// Helper function to send reset email

function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { hashPassword, comparePasswords, signToken, verifyToken };
