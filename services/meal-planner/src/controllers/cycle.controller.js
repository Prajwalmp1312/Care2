const PORT = require("../config").port;
// Auto-organized from the original monolith. Handler logic preserved verbatim.
const { db } = require("../lib/db");
const { queryGemini } = require("../lib/gemini");
const { calculateCyclePhase, predictNextPeriod, daysUntilPeriod, isApproachingPeriod, getPhaseNutritionAdvice, getPhaseKeyNutrients } = require("../utils/cycle");

// GET /api/cycle-info/:userId
exports.getCycleInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    const [users] = await db.execute(
      "SELECT track_menstrual_cycle, last_period_date, cycle_length, menstrual_preferences FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    if (!user.track_menstrual_cycle || !user.last_period_date) {
      return res.json({
        tracking: false,
        message: "Menstrual cycle tracking not enabled"
      });
    }

    const currentPhase = calculateCyclePhase(user.last_period_date, user.cycle_length);
    const nextPeriod = predictNextPeriod(user.last_period_date, user.cycle_length);
    const daysUntil = daysUntilPeriod(user.last_period_date, user.cycle_length);
    const approaching = isApproachingPeriod(user.last_period_date, user.cycle_length);

    // Get recent cravings from logs
    const [recentLogs] = await db.execute(
      "SELECT cravings, symptoms FROM menstrual_cycle_logs WHERE user_id = ? ORDER BY period_start_date DESC LIMIT 3",
      [userId]
    );

    res.json({
      tracking: true,
      currentPhase,
      nextPeriod,
      daysUntilPeriod: daysUntil,
      isApproachingPeriod: approaching,
      nutritionAdvice: getPhaseNutritionAdvice(currentPhase),
      keyNutrients: getPhaseKeyNutrients(currentPhase),
      preferences: user.menstrual_preferences ? JSON.parse(user.menstrual_preferences) : null,
      recentCravings: recentLogs.map(log => log.cravings).filter(c => c)
    });
  } catch (error) {
    console.error("Error fetching cycle info:", error);
    res.status(500).json({ error: "Failed to fetch cycle information" });
  }
};

// POST /api/log-period
exports.logPeriod = async (req, res) => {
  try {
    const { period_start_date, cravings, symptoms, notes } = req.body;
    const user_id = req.user.id;

    if (!period_start_date) {
      return res.status(400).json({ error: "period_start_date is required" });
    }

    const [result] = await db.execute(
      "INSERT INTO menstrual_cycle_logs (user_id, period_start_date, log_date, cravings, symptoms, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [
        user_id,
        period_start_date,
        period_start_date,
        cravings ? JSON.stringify(cravings) : null,
        symptoms ? JSON.stringify(symptoms) : null,
        notes || null
      ]
    );

    // Update user's last_period_date
    await db.execute(
      "UPDATE users SET last_period_date = ? WHERE id = ?",
      [period_start_date, user_id]
    );

    res.status(201).json({
      message: "Period logged successfully",
      log_id: result.insertId
    });
  } catch (error) {
    console.error("Error logging period:", error);
    res.status(500).json({ error: "Failed to log period" });
  }
};

// PUT /api/update-cycle/:userId
exports.updateCycle = async (req, res) => {
  try {
    const { userId } = req.params;
    const { cycle_length, last_period_date, cravings, track_menstrual_cycle } = req.body;

    const updates = [];
    const values = [];

    if (cycle_length !== undefined) {
      updates.push("cycle_length = ?");
      values.push(parseInt(cycle_length));
    }
    if (last_period_date !== undefined) {
      updates.push("last_period_date = ?");
      values.push(last_period_date);
    }
    if (cravings !== undefined) {
      updates.push("menstrual_preferences = ?");
      values.push(JSON.stringify({ cravings }));
    }
    if (track_menstrual_cycle !== undefined) {
      updates.push("track_menstrual_cycle = ?");
      values.push(track_menstrual_cycle);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(userId);

    await db.execute(
      `UPDATE users SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    res.json({ message: "Cycle information updated successfully" });
  } catch (error) {
    console.error("Error updating cycle info:", error);
    res.status(500).json({ error: "Failed to update cycle information" });
  }
};

// GET /api/cycle-logs/:userId
exports.getCycleLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const [logs] = await db.execute(
      "SELECT * FROM menstrual_cycle_logs WHERE user_id = ? ORDER BY period_start_date DESC LIMIT ?",
      [userId, parseInt(limit)]
    );

    res.json(logs);
  } catch (error) {
    console.error("Error fetching cycle logs:", error);
    res.status(500).json({ error: "Failed to fetch cycle logs" });
  }
};

// GET /api/users/cycle/:userId
exports.getUserCycle = async (req, res) => {
  try {
    const { userId } = req.params;

    const [users] = await db.execute(
      `SELECT id, sex, track_menstrual_cycle, last_period_date,
              cycle_length, menstrual_preferences
       FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Only return cycle data for female users with tracking enabled
    if (user.sex !== 'Female' || !user.track_menstrual_cycle || !user.last_period_date) {
      return res.json({
        tracking_enabled: false,
        message: "Cycle tracking not enabled or not applicable"
      });
    }

    // Calculate cycle information
    const lastPeriod = new Date(user.last_period_date);
    const today = new Date();
    const daysSinceLastPeriod = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24));
    const currentDay = (daysSinceLastPeriod % user.cycle_length) + 1;

    // Determine current phase
    let currentPhase;
    if (currentDay <= 5) {
      currentPhase = 'menstrual';
    } else if (currentDay <= 13) {
      currentPhase = 'follicular';
    } else if (currentDay <= 16) {
      currentPhase = 'ovulation';
    } else {
      currentPhase = 'luteal';
    }

    // Calculate next period date
    const nextPeriod = new Date(lastPeriod);
    nextPeriod.setDate(nextPeriod.getDate() + user.cycle_length);

    // Days until next period
    const daysUntilPeriod = Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24));

    // Get recent cravings from logs if available
    let recentCravings = [];
    try {
      const [logs] = await db.execute(
        "SELECT cravings FROM menstrual_cycle_logs WHERE user_id = ? ORDER BY period_start_date DESC LIMIT 3",
        [userId]
      );
      recentCravings = logs
        .map(log => log.cravings ? JSON.parse(log.cravings) : null)
        .filter(c => c)
        .flat();
    } catch (logError) {
      console.log("No cycle logs found");
    }

    const cycleData = {
      tracking_enabled: true,
      current_phase: currentPhase,
      current_day: currentDay,
      cycle_length: user.cycle_length,
      period_length: 5, // Default, you can add this to user table if needed
      last_period_date: user.last_period_date,
      predicted_next_period: nextPeriod.toISOString().split('T')[0],
      days_until_period: daysUntilPeriod,
      is_approaching_period: daysUntilPeriod <= 3 && daysUntilPeriod > 0,
      nutrition_advice: getPhaseNutritionAdvice(currentPhase),
      key_nutrients: getPhaseKeyNutrients(currentPhase),
      recent_cravings: recentCravings,
      preferences: user.menstrual_preferences ? JSON.parse(user.menstrual_preferences) : null
    };

    res.json(cycleData);
  } catch (error) {
    console.error("Error fetching cycle data:", error);
    res.status(500).json({
      error: "Failed to fetch cycle data",
      details: error.message
    });
  }
};

// PUT /api/users/cycle/:userId
exports.updateUserCycle = async (req, res) => {
  try {
    const { userId } = req.params;
    const { last_period_date, cycle_length, period_length } = req.body;

    const updates = [];
    const values = [];

    if (last_period_date) {
      updates.push("last_period_date = ?");
      values.push(last_period_date);
    }

    if (cycle_length) {
      const len = parseInt(cycle_length);
      if (isNaN(len) || len < 21 || len > 45) {
        return res.status(400).json({ error: "Cycle length must be between 21 and 45 days" });
      }
      updates.push("cycle_length = ?");
      values.push(len);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(userId);

    await db.execute(
      `UPDATE users SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    // Return updated cycle data
    const response = await fetch(`http://localhost:${PORT}/api/users/cycle/${userId}`, {
      headers: { Authorization: req.headers.authorization },
    });
    const cycleData = await response.json();

    res.json({
      message: "Cycle settings updated successfully",
      cycleData
    });
  } catch (error) {
    console.error("Error updating cycle settings:", error);
    res.status(500).json({
      error: "Failed to update cycle settings",
      details: error.message
    });
  }
};

// POST /api/log-cycle-entry
exports.logCycleEntry = async (req, res) => {
  try {
    const { log_date, cravings, symptoms, mood, energy_level, notes } = req.body;
    const user_id = req.user.id;

    if (!log_date) {
      return res.status(400).json({ error: "log_date is required" });
    }

    // Check if entry already exists for this date
    const [existing] = await db.execute(
      "SELECT id FROM menstrual_cycle_logs WHERE user_id = ? AND log_date = ?",
      [user_id, log_date]
    );

    if (existing.length > 0) {
      // Update existing entry
      await db.execute(
        `UPDATE menstrual_cycle_logs
         SET cravings = ?, symptoms = ?, mood = ?, energy_level = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          cravings ? JSON.stringify(cravings) : null,
          symptoms ? JSON.stringify(symptoms) : null,
          mood || null,
          energy_level || null,
          notes || null,
          existing[0].id
        ]
      );

      res.json({ message: "Entry updated successfully", id: existing[0].id });
    } else {
      // Create new entry
      const [result] = await db.execute(
        `INSERT INTO menstrual_cycle_logs
         (user_id, log_date, cravings, symptoms, mood, energy_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          log_date,
          cravings ? JSON.stringify(cravings) : null,
          symptoms ? JSON.stringify(symptoms) : null,
          mood || null,
          energy_level || null,
          notes || null
        ]
      );

      res.status(201).json({ message: "Entry logged successfully", id: result.insertId });
    }
  } catch (error) {
    console.error("Error logging cycle entry:", error);
    res.status(500).json({ error: "Failed to log entry", details: error.message });
  }
};

// GET /api/analyze-cycle-patterns/:userId
exports.analyzeCyclePatterns = async (req, res) => {
  try {
    const { userId } = req.params;

    const [logs] = await db.execute(
      `SELECT * FROM menstrual_cycle_logs
       WHERE user_id = ?
       ORDER BY log_date DESC
       LIMIT 50`,
      [userId]
    );

    if (logs.length < 3) {
      return res.json({
        message: "Not enough data for pattern analysis",
        totalLogs: logs.length
      });
    }

    // Analyze cravings
    const cravingCount = {};
    const symptomCount = {};
    const moodCount = {};
    const phasePatterns = {
      menstrual: { cravings: {}, symptoms: {} },
      follicular: { cravings: {}, symptoms: {} },
      ovulation: { cravings: {}, symptoms: {} },
      luteal: { cravings: {}, symptoms: {} }
    };

    // Get user's cycle data for phase calculation
    const [users] = await db.execute(
      "SELECT last_period_date, cycle_length FROM users WHERE id = ?",
      [userId]
    );
    const user = users[0];

    logs.forEach(log => {
      // Calculate phase for this log date
      if (user && user.last_period_date) {
        const logDate = new Date(log.log_date);
        const lastPeriod = new Date(user.last_period_date);
        const daysSince = Math.floor((logDate - lastPeriod) / (1000 * 60 * 60 * 24));
        const dayInCycle = ((daysSince % user.cycle_length) + user.cycle_length) % user.cycle_length;

        let phase;
        if (dayInCycle < 5) phase = 'menstrual';
        else if (dayInCycle < 13) phase = 'follicular';
        else if (dayInCycle < 16) phase = 'ovulation';
        else phase = 'luteal';

        // Track phase-specific patterns
        if (log.cravings) {
          const cravings = JSON.parse(log.cravings);
          cravings.forEach(craving => {
            cravingCount[craving] = (cravingCount[craving] || 0) + 1;
            phasePatterns[phase].cravings[craving] = (phasePatterns[phase].cravings[craving] || 0) + 1;
          });
        }

        if (log.symptoms) {
          const symptoms = JSON.parse(log.symptoms);
          symptoms.forEach(symptom => {
            symptomCount[symptom] = (symptomCount[symptom] || 0) + 1;
            phasePatterns[phase].symptoms[symptom] = (phasePatterns[phase].symptoms[symptom] || 0) + 1;
          });
        }
      }

      if (log.mood) {
        moodCount[log.mood] = (moodCount[log.mood] || 0) + 1;
      }
    });

    // Sort and get top items
    const topCravings = Object.entries(cravingCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const topSymptoms = Object.entries(symptomCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const moodTrends = Object.entries(moodCount)
      .sort((a, b) => b[1] - a[1])
      .map(([mood, count]) => ({ mood, count }));

    // Format phase patterns
    const formattedPhasePatterns = {};
    Object.keys(phasePatterns).forEach(phase => {
      const commonCravings = Object.entries(phasePatterns[phase].cravings)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const commonSymptoms = Object.entries(phasePatterns[phase].symptoms)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      if (commonCravings.length > 0 || commonSymptoms.length > 0) {
        formattedPhasePatterns[phase] = {
          commonCravings,
          commonSymptoms
        };
      }
    });

    res.json({
      totalLogs: logs.length,
      topCravings,
      topSymptoms,
      moodTrends,
      phasePatterns: formattedPhasePatterns
    });
  } catch (error) {
    console.error("Error analyzing patterns:", error);
    res.status(500).json({ error: "Failed to analyze patterns", details: error.message });
  }
};

// POST /api/generate-cycle-insights
exports.generateCycleInsights = async (req, res) => {
  try {
    const { userId, logs, cycleData } = req.body;

    if (!logs || logs.length < 5) {
      return res.json({
        message: "Need at least 5 log entries for AI insights",
        summary: "Keep logging your symptoms and cravings to get personalized AI insights!"
      });
    }

    // Prepare data for Gemini
    const logSummary = logs.map(log => ({
      date: log.log_date,
      cravings: log.cravings ? JSON.parse(log.cravings) : [],
      symptoms: log.symptoms ? JSON.parse(log.symptoms) : [],
      mood: log.mood,
      energy: log.energy_level
    }));

    const prompt = `You are a women's health and nutrition AI assistant. Analyze this menstrual cycle tracking data and provide personalized insights.

User's Cycle Data:
- Current Phase: ${cycleData.current_phase}
- Cycle Length: ${cycleData.cycle_length} days
- Days until period: ${cycleData.days_until_period}

Recent Log Entries (last ${logs.length} entries):
${JSON.stringify(logSummary, null, 2)}

Please provide:
1. A brief, empathetic summary (2-3 sentences) of the user's patterns
2. 3-5 specific, actionable recommendations for managing symptoms and cravings
3. Healthy alternatives for their top 3 most common cravings
4. Natural remedies or tips for their top 3 most common symptoms

Format your response as JSON:
{
  "summary": "Brief empathetic summary",
  "recommendations": ["rec1", "rec2", "rec3", ...],
  "cravingAlternatives": {
    "craving1": "healthy alternatives",
    "craving2": "healthy alternatives"
  },
  "symptomManagement": {
    "symptom1": "management tips",
    "symptom2": "management tips"
  }
}

Be supportive, scientifically accurate, and focus on practical, achievable advice.`;

    const geminiResponse = await queryGemini(prompt);

    // Parse JSON response
    let cleanResponse = geminiResponse.trim();
    if (cleanResponse.startsWith("```json")) {
      cleanResponse = cleanResponse.replace(/```json\n?/, "").replace(/\n?```$/, "");
    } else if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse.replace(/```\n?/, "").replace(/\n?```$/, "");
    }

    const jsonStart = cleanResponse.indexOf("{");
    const jsonEnd = cleanResponse.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
    }

    const insights = JSON.parse(cleanResponse);
    res.json(insights);

  } catch (error) {
    console.error("Error generating AI insights:", error);
    res.status(500).json({
      error: "Failed to generate insights",
      summary: "We're having trouble generating insights right now. Please try again later.",
      details: error.message
    });
  }
};
