require("dotenv").config();

// Centralized, validated configuration. Fail fast on missing critical secrets.
function required(name) {
  const v = process.env[name];
  if (!v && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
    .split(",").map((o) => o.trim()).filter(Boolean),

  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_LIMIT || "10", 10),
    queueLimit: 0,
  },
  db360: {
    host: process.env.DB360_HOST,
    user: process.env.DB360_USER,
    password: process.env.DB360_PASSWORD,
    database: process.env.DB360_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },

  jwt: {
    secret: required("JWT_SECRET") || "dev-only-insecure-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  },
  google: {
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    visionApiKey: process.env.GOOGLE_VISION_API_KEY || null,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || null,
  },
  email: {
    user: process.env.EMAIL_USER || "",
    password: process.env.EMAIL_PASSWORD || "",
    service: process.env.EMAIL_SERVICE || "gmail",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX || "300", 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "10", 10),
  },
  careConnect: {
    apiUrl: (process.env.CARECONNECT_API_URL || "http://localhost:8000").replace(/\/$/, ""),
    jwtSecret: required("CARECONNECT_JWT_SECRET") || "dev-only-careconnect-secret",
    jwtAlgorithm: process.env.CARECONNECT_JWT_ALGORITHM || "HS256",
  },

  uploadLimitMb: parseInt(process.env.UPLOAD_LIMIT_MB || "40", 10),
};

module.exports = config;
