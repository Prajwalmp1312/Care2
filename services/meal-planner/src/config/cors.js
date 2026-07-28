// Computes the list of allowed CORS origins from environment/config.
const getAllowedOrigins = () => {
  const origins = [];

  // Development origins
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  // Production/deployment origins
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  // Additional allowed origins from environment
  if (process.env.ALLOWED_ORIGINS) {
    const additionalOrigins = process.env.ALLOWED_ORIGINS.split(",");
    origins.push(...additionalOrigins);
  }

  return origins;
};

module.exports = { getAllowedOrigins };
