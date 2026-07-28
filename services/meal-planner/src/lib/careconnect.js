const jwt = require("jsonwebtoken");
const config = require("../config");

const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

function readBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

function readCareConnectToken(req) {
  return req.headers["x-careconnect-token"] || readBearer(req);
}

function verifyCareConnectToken(token) {
  if (!token) throw new Error("CareConnect token is required");
  const payload = jwt.verify(token, config.careConnect.jwtSecret, {
    algorithms: [config.careConnect.jwtAlgorithm],
  });
  if (!payload.sub || payload.role !== "patient") {
    throw new Error("A CareConnect patient session is required");
  }
  return payload;
}

async function fetchCareConnectContext(token, { useCache = true } = {}) {
  const payload = verifyCareConnectToken(token);
  const key = payload.sub;
  const cached = cache.get(key);
  if (useCache && cached && Date.now() - cached.savedAt < CACHE_MS) {
    return cached.value;
  }

  const response = await fetch(
    `${config.careConnect.apiUrl}/api/integrations/meal-planner/context`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CareConnect context request failed (${response.status}): ${body}`);
  }

  const value = await response.json();
  cache.set(key, { value, savedAt: Date.now() });
  return value;
}

async function optionalCareConnectContext(req) {
  const token = req.headers["x-careconnect-token"];
  if (!token) return null;
  try {
    return await fetchCareConnectContext(token);
  } catch (error) {
    req.log?.warn({ err: error.message }, "CareConnect context unavailable");
    return null;
  }
}

module.exports = {
  fetchCareConnectContext,
  optionalCareConnectContext,
  readBearer,
  readCareConnectToken,
  verifyCareConnectToken,
};
