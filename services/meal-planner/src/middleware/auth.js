const { verifyToken } = require("../utils/auth");

// Require a valid Bearer JWT. Attaches req.user = { id, email }.
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Ensure the authenticated user owns the resource identified by req.params[param].
// Compares against the numeric user id in the JWT.
function requireOwnership(param = "id") {
  return (req, res, next) => {
    const target = String(req.params[param]);
    if (!req.user || String(req.user.id) !== target) {
      return res.status(403).json({ error: "Forbidden: you can only access your own data" });
    }
    return next();
  };
}

// Restrict to admins (role claim in JWT). Extend as your roles model grows.
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
}

module.exports = { authenticate, requireOwnership, requireAdmin };
