const mysql = require("mysql2/promise");
const config = require("../config");
const logger = require("./logger");

let pool = null;
let pool360 = null;

// Proxy lets existing handler code keep calling db.execute(...) / db.query(...)
// even though the pool is created asynchronously at startup.
function makeProxy(getPool, label) {
  return new Proxy({}, {
    get(_t, prop) {
      const p = getPool();
      if (!p) throw new Error(`${label} pool not initialized. Call initializeDB() first.`);
      const val = p[prop];
      return typeof val === "function" ? val.bind(p) : val;
    },
  });
}

const db = makeProxy(() => pool, "Primary DB");
const db360 = makeProxy(() => pool360, "360 DB");

async function initializeDB() {
  pool = await mysql.createPool(config.db);
  await pool.query("SELECT 1");
  logger.info({ database: config.db.database }, "Connected to MySQL");
  const { createTables } = require("./schema");
  await createTables();
}

async function initialize360DB() {
  try {
    pool360 = await mysql.createPool(config.db360);
    await pool360.query("SELECT 1");
    logger.info({ database: config.db360.database }, "Connected to 360 MySQL");
  } catch (error) {
    logger.warn({ err: error.message }, "360 DB connection skipped");
  }
}

module.exports = { db, db360, initializeDB, initialize360DB };
