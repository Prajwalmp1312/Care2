const { db } = require("../lib/db");
const { normalizeWeightToKg } = require("../utils/units");

const USER_FIELDS = `id, username, name, age, email, sex, weight, weight_unit,
  purpose, track_menstrual_cycle, last_period_date, cycle_length,
  profile_completed, auth_provider, created_at, updated_at`;

exports.getUserById = async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = req.params.id;
    const { username, name, age, sex, weight, purpose, weight_unit } = req.body;
    const [existingRows] = await db.execute(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [id]);
    if (!existingRows.length) return res.status(404).json({ error: "User not found" });
    const existing = existingRows[0];

    const next = {
      username: String(username ?? existing.username ?? "").trim(),
      name: String(name ?? existing.name ?? "").trim(),
      age: Number(age ?? existing.age),
      sex: sex ?? existing.sex,
      weight_unit: String(weight_unit ?? existing.weight_unit ?? "kg").toLowerCase(),
      purpose: String(purpose ?? existing.purpose ?? "").trim(),
    };

    if (!/^[a-zA-Z0-9_]{3,255}$/.test(next.username)) {
      return res.status(400).json({ error: "Username must be 3-255 characters using letters, numbers, or underscores" });
    }
    const [duplicate] = await db.execute("SELECT id FROM users WHERE username = ? AND id != ?", [next.username, id]);
    if (duplicate.length) return res.status(409).json({ error: "Username already taken" });
    if (!next.name) return res.status(400).json({ error: "Name is required" });
    if (!Number.isInteger(next.age) || next.age < 1 || next.age > 120) {
      return res.status(400).json({ error: "Age must be between 1 and 120" });
    }
    if (!["Male", "Female", "Other"].includes(next.sex)) {
      return res.status(400).json({ error: "Sex must be Male, Female, or Other" });
    }
    if (!["kg", "lb"].includes(next.weight_unit)) {
      return res.status(400).json({ error: "weight_unit must be 'kg' or 'lb'" });
    }
    if (!next.purpose) return res.status(400).json({ error: "Purpose is required" });

    const displayWeight = Number(weight ?? (next.weight_unit === "lb" ? existing.weight / 0.45359237 : existing.weight));
    const min = next.weight_unit === "lb" ? 44 : 20;
    const max = next.weight_unit === "lb" ? 1100 : 500;
    if (!Number.isFinite(displayWeight) || displayWeight < min || displayWeight > max) {
      return res.status(400).json({ error: `Weight must be between ${min} and ${max} ${next.weight_unit}` });
    }
    const weightKg = normalizeWeightToKg(displayWeight, next.weight_unit);

    await db.execute(
      `UPDATE users SET username = ?, name = ?, age = ?, sex = ?, weight = ?,
        weight_unit = ?, purpose = ?, profile_completed = TRUE,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [next.username, next.name, next.age, next.sex, weightKg, next.weight_unit, next.purpose, id]
    );

    const [updated] = await db.execute(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [id]);
    res.json({ message: "User updated successfully", user: updated[0] });
  } catch (error) {
    console.error("Error updating user:", error);
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Username already taken" });
    res.status(500).json({ error: "Failed to update user" });
  }
};

exports.listUsers = async (_req, res) => {
  try {
    const [rows] = await db.execute(`SELECT ${USER_FIELDS} FROM users ORDER BY created_at DESC`);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
