const crypto = require("crypto");
const { db } = require("../lib/db");
const { fetchCareConnectContext, readBearer } = require("../lib/careconnect");
const { hashPassword, signToken } = require("../utils/auth");

function cleanUsername(email) {
  const base = String(email || "patient")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 40) || "patient";
  return `cc_${base}`;
}

function mapSex(gender) {
  const value = String(gender || "").toLowerCase();
  if (value === "male" || value === "m") return "Male";
  if (value === "female" || value === "f") return "Female";
  return "Other";
}

async function uniqueUsername(email) {
  const base = cleanUsername(email);
  let candidate = base;
  let suffix = 1;
  while (true) {
    const [rows] = await db.execute("SELECT id FROM users WHERE username = ?", [candidate]);
    if (!rows.length) return candidate;
    candidate = `${base}_${suffix++}`;
  }
}

exports.createSession = async (req, res) => {
  try {
    const careToken = readBearer(req);
    const context = await fetchCareConnectContext(careToken, { useCache: false });
    const patient = context.patient;
    const email = patient.email.trim().toLowerCase();

    let [rows] = await db.execute(
      `SELECT id, username, name, age, email, sex, weight, weight_unit, purpose,
              track_menstrual_cycle, last_period_date, cycle_length,
              profile_completed, auth_provider, created_at, updated_at
         FROM users WHERE email = ?`,
      [email]
    );

    if (!rows.length) {
      const username = await uniqueUsername(email);
      const password = await hashPassword(crypto.randomBytes(32).toString("hex"));
      const age = Math.min(120, Math.max(1, Number(patient.age) || 30));
      const sex = mapSex(patient.gender);

      const [result] = await db.execute(
        `INSERT INTO users
          (username, name, age, email, password, sex, weight, weight_unit, purpose,
           profile_completed, auth_provider)
         VALUES (?, ?, ?, ?, ?, ?, 70, 'kg', 'Improve Health', FALSE, 'careconnect')`,
        [username, patient.name || "CareConnect Patient", age, email, password, sex]
      );

      [rows] = await db.execute(
        `SELECT id, username, name, age, email, sex, weight, weight_unit, purpose,
                track_menstrual_cycle, last_period_date, cycle_length,
                profile_completed, auth_provider, created_at, updated_at
           FROM users WHERE id = ?`,
        [result.insertId]
      );
    } else {
      await db.execute(
        `UPDATE users
            SET name = ?, age = ?, sex = ?, auth_provider = 'careconnect'
          WHERE id = ?`,
        [
          patient.name || rows[0].name,
          Number(patient.age) || rows[0].age,
          patient.gender ? mapSex(patient.gender) : rows[0].sex,
          rows[0].id,
        ]
      );
      [rows] = await db.execute(
        `SELECT id, username, name, age, email, sex, weight, weight_unit, purpose,
                track_menstrual_cycle, last_period_date, cycle_length,
                profile_completed, auth_provider, created_at, updated_at
           FROM users WHERE id = ?`,
        [rows[0].id]
      );
    }

    const user = rows[0];
    const token = signToken({
      id: user.id,
      email: user.email,
      role: "user",
      provider: "careconnect",
    });

    res.json({
      token,
      user,
      care_context: {
        health_status: patient.health_status,
        blood_type: patient.blood_type,
        active_prescription_count: context.active_prescriptions?.length || 0,
        recent_record_count: context.recent_records?.length || 0,
      },
    });
  } catch (error) {
    req.log?.warn({ err: error.message }, "CareConnect session exchange failed");
    res.status(401).json({ error: error.message || "Unable to create Meal Planner session" });
  }
};
