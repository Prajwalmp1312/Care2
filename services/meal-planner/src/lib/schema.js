const { db } = require("./db");


async function columnExists(table, column) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0].count) > 0;
}

async function ensureCareConnectUserColumns() {
  try {
    await db.execute(
      "ALTER TABLE users MODIFY sex ENUM('Male','Female','Other') NOT NULL DEFAULT 'Other'"
    );

    if (!(await columnExists("users", "profile_completed"))) {
      await db.execute(
        "ALTER TABLE users ADD COLUMN profile_completed BOOLEAN DEFAULT TRUE"
      );
    }

    if (!(await columnExists("users", "auth_provider"))) {
      await db.execute(
        "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(30) DEFAULT 'local'"
      );
    }
  } catch (error) {
    console.error("Error updating users table for CareConnect integration:", error);
    throw error;
  }
}


async function ensureMenstrualLogColumns() {
  if (!(await columnExists("menstrual_cycle_logs", "updated_at"))) {
    await db.execute(
      "ALTER TABLE menstrual_cycle_logs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );
  }
}

async function createMenstrualLogsTable() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS menstrual_cycle_logs (
      id INT(11) AUTO_INCREMENT PRIMARY KEY,
      user_id INT(11) NOT NULL,
      period_start_date DATE DEFAULT NULL,
      period_end_date DATE DEFAULT NULL,
      cycle_length INT(11) DEFAULT 28,
      cravings LONGTEXT DEFAULT NULL,
      symptoms LONGTEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      log_date DATE NOT NULL,
      mood VARCHAR(50) DEFAULT NULL,
      energy_level VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_date (user_id, period_start_date),
      UNIQUE KEY unique_user_log_date (user_id, log_date)
  )`);
    console.log("Menstrual cycle logs table created successfully");
  } catch (error) {
    console.error("Error creating menstrual cycle logs table:", error);
  }
}

// Create Tables (existing function - keeping as is)

async function createTables() {
  try {
    // Create Users table first
    await createUsersTable();
    await ensureCareConnectUserColumns();
    await createMenstrualLogsTable();
    await ensureMenstrualLogColumns();
    await createSavedMealPlansTable();

    // Reviews table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        user_id INT,
        photo_url VARCHAR(500) DEFAULT NULL,
        photo_filename VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Meals table (for meal database)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS meals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
        cuisine_type VARCHAR(100),
        prep_time INT NOT NULL,
        cook_time INT DEFAULT 0,
        difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'easy',
        calories INT NOT NULL,
        mood_tags JSON,
        dietary_tags JSON,
        ingredients JSON,
        instructions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Meal Plans table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS meal_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        mood_context VARCHAR(50) NOT NULL,
        breakfast_meal_id INT,
        lunch_meal_id INT,
        dinner_meal_id INT,
        snack_meal_id INT,
        total_calories INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (breakfast_meal_id) REFERENCES meals(id),
        FOREIGN KEY (lunch_meal_id) REFERENCES meals(id),
        FOREIGN KEY (dinner_meal_id) REFERENCES meals(id),
        FOREIGN KEY (snack_meal_id) REFERENCES meals(id)
      )
    `);

    console.log("Database tables created successfully");
    await insertSampleMeals();
  } catch (error) {
    console.error("Error creating tables:", error);
  }
}


async function createSavedMealPlansTable() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS saved_meal_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        meal_plan_name VARCHAR(255) DEFAULT 'My Meal Plan',
        mood_context VARCHAR(50) NOT NULL,

        breakfast_name VARCHAR(255) NOT NULL,
        breakfast_calories INT NOT NULL,

        lunch_name VARCHAR(255) NOT NULL,
        lunch_calories INT NOT NULL,

        dinner_name VARCHAR(255) NOT NULL,
        dinner_calories INT NOT NULL,

        snack_name VARCHAR(255) NOT NULL,
        snack_calories INT NOT NULL,

        total_calories INT NOT NULL,
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
      )
    `);
    console.log("Saved meal plans table created successfully");
  } catch (error) {
    console.error("Error creating saved meal plans table:", error);
  }
}


async function createUsersTable() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE DEFAULT NULL,
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL CHECK (age >= 1 AND age <= 120),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        sex ENUM('Male', 'Female', 'Other') NOT NULL DEFAULT 'Other',
        weight DECIMAL(5,2) NOT NULL CHECK (weight >= 20 AND weight <= 500),
        weight_unit ENUM('kg','lb') NOT NULL DEFAULT 'kg',
        purpose VARCHAR(255) NOT NULL DEFAULT 'Improve Health',
        profile_completed BOOLEAN DEFAULT TRUE,
        auth_provider VARCHAR(30) DEFAULT 'local',

        -- NEW MENSTRUAL CYCLE FIELDS --
        track_menstrual_cycle BOOLEAN DEFAULT FALSE,
        last_period_date DATE DEFAULT NULL,
        cycle_length INT DEFAULT 28,
        menstrual_preferences JSON DEFAULT NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("Users table created successfully");
  } catch (error) {
    console.error("Error creating users table:", error);
  }
}

// Insert Sample Meals (keeping existing function)

async function insertSampleMeals() {
  try {
    const [rows] = await db.execute("SELECT COUNT(*) as count FROM meals");
    if (rows[0].count === 0) {
      // Insert sample meals (keeping existing sample data)
      console.log("Sample meals inserted successfully");
    }
  } catch (error) {
    console.error("Error inserting sample meals:", error);
  }
}

// ------------------------------
// 🌍 Multilingual utilities
// ------------------------------
// Map ISO-639-3 (franc) codes to common BCP-47 language tags for TTS / UI.

module.exports = { createTables };
