const { comparePasswords, signToken, hashPassword } = require("../utils/auth");
// Auto-organized from the original monolith. Handler logic preserved verbatim.
const { db, db360 } = require("../lib/db");
const { normalizeWeightToKg } = require("../utils/units");

// GET /api/validate/email/:email
exports.validateEmail = async (req, res) => {
  const { email } = req.params;
  try {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      res.json({ available: false, message: 'Email already taken' });
    } else {
      res.json({ available: true, message: 'Email is available' });
    }
  } catch (error) {
    console.error('Email validation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/validate/username/:username
exports.validateUsername = async (req, res) => {
  const { username } = req.params;

  // Basic format validation
  const usernameRegex = /^[a-zA-Z0-9_]{3,255}$/;
  if (!usernameRegex.test(username)) {
    return res.json({
      available: false,
      valid: false,
      message: 'Username must be 3-255 characters (letters, numbers, _)'
    });
  }

  try {
    const [rows] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
      res.json({ available: false, valid: true, message: 'Username already taken' });
    } else {
      res.json({ available: true, valid: true, message: 'Username is available' });
    }
  } catch (error) {
    console.error('Username validation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/validate/password
exports.validatePassword = (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.json({ valid: false, strength: 'weak', message: 'Password is required' });
  }

  const issues = [];
  if (password.length < 6) issues.push('At least 6 characters');
  if (!/[A-Z]/.test(password)) issues.push('One uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('One lowercase letter');
  if (!/\d/.test(password)) issues.push('One number');
  if (!/[@$!%*?&()[\]{}#^+=._-]/.test(password)) issues.push('One special character');

  let strength = 'weak';
  if (issues.length === 0) strength = 'strong';
  else if (issues.length <= 2) strength = 'medium';

  res.json({
    valid: issues.length === 0,
    strength,
    issues,
    message: issues.length === 0 ? 'Password is secure' : 'Password needs improvement'
  });
};

// POST /api/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists and get password
    const [users] = await db.execute(
      "SELECT id, username, name, age, email, sex, weight, weight_unit, purpose, password, track_menstrual_cycle, last_period_date, cycle_length FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];

    // Verify hashed password
    const passwordValid = await comparePasswords(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Remove password from response
    delete user.password;

    const token = signToken({ id: user.id, email: user.email });

    res.json({
      message: "Login successful",
      token,
      user: user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
};

// GET /api/users/check/:email
exports.checkUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    console.log('Checking if user exists:', cleanEmail);

    // First check 360 database for user info
    let user360 = null;
    try {
      const [rows360] = await db360.execute(
        "SELECT UserName, firstName, lastName, Birthday FROM User WHERE Email = ?",
        [cleanEmail]
      );

      if (rows360.length > 0) {
        const name360 = rows360[0].firstName + " " + rows360[0].lastName;

        const dob360 = new Date(rows360[0].Birthday);
        if (isNaN(dob360.getTime())) {
          throw new Error("Invalid birth date provided");
        }
        const today = new Date();

        let age360 = today.getFullYear() - dob360.getFullYear();
        const monthDiff = today.getMonth() - dob360.getMonth();

        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < dob360.getDate())
        ) {
          age360--;
        }

        user360 = {
          username: rows360[0].UserName,
          name: name360,
          age: age360,
        };
        console.log('Found user in 360 database:', user360);
      }
    } catch (error360) {
      console.error("Error checking 360 database:", error360);
    }

    const [rows] = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (rows.length > 0) {
      console.log('User exists in meal planner DB');
      res.json({
        exists: true,
        in360: user360 !== null,
        data360: user360
      });
    } else if (user360) {
      console.log('User exists in 360 but not in meal planner');
      res.json({
        exists: false,
        in360: true,
        data360: user360,
      });
    } else {
      console.log('User does not exist in any database');
      res.json({
        exists: false,
        in360: false,
      });
    }
  } catch (error) {
    console.error("Error checking user:", error);
    res.status(500).json({ error: "Failed to check user" });
  }
};

// POST /api/users
exports.register = async (req, res) => {
  try {
    const { username, name, age, email, password, sex, weight, purpose, weight_unit, track_menstrual_cycle, last_period_date, cycle_length } =
      req.body;

    console.log('Registration request received:', { username, email, age, sex, weight_unit });

    // Validation
    if (!username || !name || !age || !email || !password || !sex || !weight || !purpose) {
      console.log('Missing required fields');
      return res.status(400).json({
        error: "All fields are required: username, name, age, password, email, sex, weight, purpose",
      });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&()[\]{}#^+=._-])[A-Za-z\d@$!%*?&()[\]{}#^+=._-]{6,}$/;

    if (!passwordRegex.test(password)) {
      console.log('Password does not meet complexity requirements');
      return res.status(400).json({
        error:
          "Password must be at least 6 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character",
      });
    }

    const unit = (weight_unit || "kg").toLowerCase();
    if (!["kg", "lb"].includes(unit)) {
      console.log('Invalid weight unit:', unit);
      return res.status(400).json({ error: "weight_unit must be 'kg' or 'lb'" });
    }

    // Validate Username
    const usernameRegex = /^[a-zA-Z0-9_]{3,255}$/;
    if (!usernameRegex.test(username)) {
      console.log('Invalid username format:', username);
      return res.status(400).json({
        error: "Username must be 3-255 characters and can only contain letters, numbers, and underscores",
      });
    }
    // Clean email
    const cleanEmail = email.trim().toLowerCase();
    console.log('Checking for existing user with email:', cleanEmail);

    // Check for duplicate EMAIL FIRST (most important)
    const [existingEmail] = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [cleanEmail]
    );
    if (existingEmail.length > 0) {
      console.log('Email already exists:', cleanEmail);
      return res.status(409).json({ error: "User with this email already exists" });
    }

    // Check for duplicate username
    const [existingUsername] = await db.execute(
      "SELECT id FROM users WHERE username = ?",
      [username.trim()]
    );
    if (existingUsername.length > 0) {
      console.log('Username already taken:', username);
      return res.status(409).json({ error: "Username already taken" });
    }

    // Validate age
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      console.log('Invalid age:', age);
      return res.status(400).json({ error: "Age must be between 1 and 120" });
    }

    // Validate weight
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum)) {
      console.log('Invalid weight:', weight);
      return res.status(400).json({ error: "Weight must be a number" });
    }

    // Unit-aware range checks: 20–500 kg OR 44–1100 lb
    if (
      (unit === "kg" && (weightNum < 20 || weightNum > 500)) ||
      (unit === "lb" && (weightNum < 44 || weightNum > 1100))
    ) {
      console.log('Weight out of range:', weightNum, unit);
      return res.status(400).json({
        error:
          unit === "kg"
            ? "Weight must be between 20 and 500 kg"
            : "Weight must be between 44 and 1100 lb",
      });
    }

    // Store normalized kg for calculations, but also persist the user's unit
    const weightKg = normalizeWeightToKg(weightNum, unit);

    // Validate sex
    if (!["Male", "Female"].includes(sex)) {
      console.log('Invalid sex:', sex);
      return res.status(400).json({ error: "Sex must be either Male or Female" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      console.log('Invalid email format:', cleanEmail);
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    // Check if user already exists
    const [existingUser] = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (existingUser.length > 0) {
      return res
        .status(409)
        .json({ error: "User with this email already exists" });
    }

    let trackCycle = false;
    let lastPeriod = null;
    let cycleLen = 28;

    if (sex === 'Female' && track_menstrual_cycle) {
      trackCycle = true;

      if (last_period_date) {
        const periodDate = new Date(last_period_date);
        if (isNaN(periodDate.getTime())) {
          console.log('Invalid period date:', last_period_date);
          return res.status(400).json({ error: "Invalid last period date" });
        }
        lastPeriod = last_period_date;
      }

      if (cycle_length) {
        const len = parseInt(cycle_length);
        if (isNaN(len) || len < 21 || len > 45) {
          console.log('Invalid cycle length:', cycle_length);
          return res.status(400).json({ error: "Cycle length must be between 21 and 45 days" });
        }
        cycleLen = len;
      }
    }

    console.log('All validations passed, inserting user...');

    // Hash the password before storing
    const hashedPassword = await hashPassword(password);

    // Insert new user
    const [result] = await db.execute(
      `INSERT INTO users (
        username, name, age, email, password, sex, weight, weight_unit, purpose,
        track_menstrual_cycle, last_period_date, cycle_length
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username.trim(),
        name.trim(),
        ageNum,
        cleanEmail,
        hashedPassword,
        sex,
        weightKg,
        unit,
        purpose.trim(),
        trackCycle,
        lastPeriod,
        cycleLen
      ]
    );

    console.log('User inserted successfully with ID:', result.insertId);

    // Fetch the newly created user
    const [newUser] = await db.execute(
      `SELECT id, username, name, age, email, sex, weight, weight_unit, purpose,
       track_menstrual_cycle, last_period_date, cycle_length, created_at
       FROM users WHERE id = ?`,
      [result.insertId]
    );

    console.log('Registration successful for:', cleanEmail);

    const token = signToken({ id: result.insertId, email: cleanEmail });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: newUser[0],
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ error: "User with this email already exists" });
    }

    res.status(500).json({
      error: "Failed to register user",
      details: error.message,
    });
  }
};
