const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const pinoHttp = require("pino-http");
const config = require("./config");
const logger = require("./lib/logger");
const { apiLimiter } = require("./middleware/rateLimit");
const { notFound, errorHandler } = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const cycleRoutes = require("./routes/cycle.routes");
const mealsRoutes = require("./routes/meals.routes");
const detectionRoutes = require("./routes/detection.routes");
const reviewsRoutes = require("./routes/reviews.routes");
const chatRoutes = require("./routes/chat.routes");
const systemRoutes = require("./routes/system.routes");
const careconnectRoutes = require("./routes/careconnect.routes");

const app = express();

// --- Security & infrastructure middleware ---
app.use(helmet());
app.use(pinoHttp({ logger }));

const allowedOrigins = [
  config.frontendUrl,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...config.allowedOrigins,
];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CareConnect-Token"],
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Static serving for review photos
app.use("/uploads/reviews", express.static(path.join(__dirname, "..", "uploads", "reviews")));

// Rate limit all API traffic
app.use("/api", apiLimiter);

// --- Routes (all mounted under /api) ---
app.use("/api", careconnectRoutes);
app.use("/api", authRoutes);
app.use("/api", usersRoutes);
app.use("/api", cycleRoutes);
app.use("/api", mealsRoutes);
app.use("/api", detectionRoutes);
app.use("/api", reviewsRoutes);
app.use("/api", chatRoutes);
app.use("/api", systemRoutes);

// --- 404 + centralized error handling ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
