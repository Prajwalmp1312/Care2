const { db } = require("../lib/db");

async function getRandomMealByCategory(category) {
  const [rows] = await db.execute(
    "SELECT * FROM meals WHERE category = ? ORDER BY RAND() LIMIT 1",
    [category]
  );
  return rows[0];
}

// Get all meals

module.exports = { getRandomMealByCategory };
