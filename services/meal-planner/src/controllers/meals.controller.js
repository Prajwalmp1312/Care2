// Auto-organized from the original monolith. Handler logic preserved verbatim.
const { db } = require("../lib/db");
const { generateMealPlanWithGemini } = require("../services/mealPlanGenerator");
const { getRandomMealByCategory } = require("../services/meals");
const { optionalCareConnectContext } = require("../lib/careconnect");

// POST /api/meal-plan
exports.createMealPlan = async (req, res) => {
  try {
    const { mood, isNewPlan = false, userId } = req.body;

    if (!mood) {
      return res.status(400).json({ error: "Mood is required" });
    }

    console.log(
      `Generating ${isNewPlan ? "new" : "initial"} meal plan for mood: ${mood}${userId ? ` for user: ${userId}` : ""
      }`
    );

    // Get meals that match the specific mood
    const [breakfastMeals] = await db.execute(
      `SELECT * FROM meals WHERE category = 'breakfast' AND JSON_CONTAINS(mood_tags, ?) ORDER BY RAND() LIMIT 3`,
      [`"${mood}"`]
    );

    const [lunchMeals] = await db.execute(
      `SELECT * FROM meals WHERE category = 'lunch' AND JSON_CONTAINS(mood_tags, ?) ORDER BY RAND() LIMIT 3`,
      [`"${mood}"`]
    );

    const [dinnerMeals] = await db.execute(
      `SELECT * FROM meals WHERE category = 'dinner' AND JSON_CONTAINS(mood_tags, ?) ORDER BY RAND() LIMIT 3`,
      [`"${mood}"`]
    );

    const [snackMeals] = await db.execute(
      `SELECT * FROM meals WHERE category = 'snack' AND JSON_CONTAINS(mood_tags, ?) ORDER BY RAND() LIMIT 3`,
      [`"${mood}"`]
    );

    // Select random meals from the mood-specific results
    const breakfast =
      breakfastMeals[Math.floor(Math.random() * breakfastMeals.length)] ||
      (await getRandomMealByCategory("breakfast"));
    const lunch =
      lunchMeals[Math.floor(Math.random() * lunchMeals.length)] ||
      (await getRandomMealByCategory("lunch"));
    const dinner =
      dinnerMeals[Math.floor(Math.random() * dinnerMeals.length)] ||
      (await getRandomMealByCategory("dinner"));
    const snack =
      snackMeals[Math.floor(Math.random() * snackMeals.length)] ||
      (await getRandomMealByCategory("snack"));

    const totalCalories =
      breakfast.calories + lunch.calories + dinner.calories + snack.calories;

    // Save meal plan to database (with optional user_id)
    const [result] = await db.execute(
      "INSERT INTO meal_plans (user_id, mood_context, breakfast_meal_id, lunch_meal_id, dinner_meal_id, snack_meal_id, total_calories) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        userId || null,
        mood,
        breakfast.id,
        lunch.id,
        dinner.id,
        snack.id,
        totalCalories,
      ]
    );

    const mealPlan = {
      plan_id: result.insertId,
      user_id: userId || null,
      breakfast: {
        id: breakfast.id,
        name: breakfast.name,
        calories: breakfast.calories,
        prep_time: breakfast.prep_time,
        ingredients: JSON.parse(breakfast.ingredients || "[]"),
        instructions: breakfast.instructions,
      },
      lunch: {
        id: lunch.id,
        name: lunch.name,
        calories: lunch.calories,
        prep_time: lunch.prep_time,
        ingredients: JSON.parse(lunch.ingredients || "[]"),
        instructions: lunch.instructions,
      },
      dinner: {
        id: dinner.id,
        name: dinner.name,
        calories: dinner.calories,
        prep_time: dinner.prep_time,
        ingredients: JSON.parse(dinner.ingredients || "[]"),
        instructions: dinner.instructions,
      },
      snack: {
        id: snack.id,
        name: snack.name,
        calories: snack.calories,
        prep_time: snack.prep_time,
        ingredients: JSON.parse(snack.ingredients || "[]"),
        instructions: snack.instructions,
      },
      total_calories: totalCalories,
      mood_context: mood,
      generated_at: new Date().toISOString(),
    };

    res.json(mealPlan);
  } catch (error) {
    console.error("Error generating meal plan:", error);
    res.status(500).json({ error: "Failed to generate meal plan" });
  }
};

// GET /api/meals
exports.listMeals = async (req, res) => {
  try {
    const { category, mood } = req.query;
    let query = "SELECT * FROM meals";
    let params = [];

    if (category || mood) {
      query += " WHERE";
      const conditions = [];

      if (category) {
        conditions.push(" category = ?");
        params.push(category);
      }

      if (mood) {
        conditions.push(" JSON_CONTAINS(mood_tags, ?)");
        params.push(`"${mood}"`);
      }

      query += conditions.join(" AND");
    }

    query += " ORDER BY name";

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching meals:", error);
    res.status(500).json({ error: "Failed to fetch meals" });
  }
};

// GET /api/meals/:id
exports.getMealById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute("SELECT * FROM meals WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Meal not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching meal:", error);
    res.status(500).json({ error: "Failed to fetch meal" });
  }
};

// GET /api/meal-plans
exports.listMealPlans = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT mp.*,
             b.name as breakfast_name, b.calories as breakfast_calories,
             l.name as lunch_name, l.calories as lunch_calories,
             d.name as dinner_name, d.calories as dinner_calories,
             s.name as snack_name, s.calories as snack_calories
      FROM meal_plans mp
      LEFT JOIN meals b ON mp.breakfast_meal_id = b.id
      LEFT JOIN meals l ON mp.lunch_meal_id = l.id
      LEFT JOIN meals d ON mp.dinner_meal_id = d.id
      LEFT JOIN meals s ON mp.snack_meal_id = s.id
      ORDER BY mp.created_at DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching meal plans:", error);
    res.status(500).json({ error: "Failed to fetch meal plans" });
  }
};

// GET /api/meal-plans/:id
exports.getMealPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `
      SELECT mp.*,
             b.name as breakfast_name, b.calories as breakfast_calories, b.prep_time as breakfast_prep_time,
             l.name as lunch_name, l.calories as lunch_calories, l.prep_time as lunch_prep_time,
             d.name as dinner_name, d.calories as dinner_calories, d.prep_time as dinner_prep_time,
             s.name as snack_name, s.calories as snack_calories, s.prep_time as snack_prep_time
      FROM meal_plans mp
      LEFT JOIN meals b ON mp.breakfast_meal_id = b.id
      LEFT JOIN meals l ON mp.lunch_meal_id = l.id
      LEFT JOIN meals d ON mp.dinner_meal_id = d.id
      LEFT JOIN meals s ON mp.snack_meal_id = s.id
      WHERE mp.id = ?
    `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Meal plan not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching meal plan:", error);
    res.status(500).json({ error: "Failed to fetch meal plan" });
  }
};

// POST /api/generate-ai-meal
exports.generateAiMeal = async (req, res) => {
  try {
    const { mood, dietary, cuisine, available_ingredients, allergies, menstrualData } =
      req.body;

    console.log("Generating meal plan:", {
      mood,
      dietary,
      cuisine,
      available_ingredients,
      allergies,
    });

    const careContext = await optionalCareConnectContext(req);
    const mealPlan = await generateMealPlanWithGemini(
      mood,
      dietary,
      cuisine,
      available_ingredients || [],
      allergies || [],
      menstrualData || null,
      careContext
    );

    res.json(mealPlan);
  } catch (error) {
    console.error("Error generating meal plan:", error);
    res.status(500).json({
      error: "Failed to generate meal plan",
      details: error.message,
    });
  }
};

// POST /api/save-meal-plan
exports.saveMealPlan = async (req, res) => {
  try {
    const {
      userEmail,
      mealPlanName,
      moodContext,
      breakfast,
      lunch,
      dinner,
      snack,
      totalCalories,
    } = req.body;

    if (userEmail && userEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: "You can only save meal plans to your own account" });
    }

    const ownerEmail = req.user.email;

    if (
      !ownerEmail ||
      !moodContext ||
      !breakfast ||
      !lunch ||
      !dinner ||
      !snack
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: userEmail, moodContext, and all meal data are required",
      });
    }

    const [userExists] = await db.execute(
      "SELECT email FROM users WHERE email = ?",
      [ownerEmail]
    );

    if (userExists.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const [result] = await db.execute(
      `
      INSERT INTO saved_meal_plans (
        user_email, meal_plan_name, mood_context,
        breakfast_name, breakfast_calories,
        lunch_name, lunch_calories,
        dinner_name, dinner_calories,
        snack_name, snack_calories,
        total_calories
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        ownerEmail,
        mealPlanName || "My Meal Plan",
        moodContext,
        breakfast.name,
        breakfast.calories,
        lunch.name,
        lunch.calories,
        dinner.name,
        dinner.calories,
        snack.name,
        snack.calories,
        totalCalories,
      ]
    );

    const [savedPlan] = await db.execute(
      "SELECT * FROM saved_meal_plans WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      message: "Meal plan saved successfully",
      savedPlan: savedPlan[0],
    });
  } catch (error) {
    console.error("Error saving meal plan:", error);
    res.status(500).json({
      error: "Failed to save meal plan",
      details: error.message,
    });
  }
};

// GET /api/saved-meal-plans/:email
exports.getSavedMealPlans = async (req, res) => {
  try {
    const requestedEmail = decodeURIComponent(req.params.email || "").toLowerCase();
    if (requestedEmail && requestedEmail !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: "You can only access your own meal plans" });
    }

    const [rows] = await db.execute(
      "SELECT * FROM saved_meal_plans WHERE user_email = ? ORDER BY date_created DESC",
      [req.user.email]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching saved meal plans:", error);
    res.status(500).json({ error: "Failed to fetch saved meal plans" });
  }
};

// DELETE /api/saved-meal-plans/:id
exports.deleteSavedMealPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      "DELETE FROM saved_meal_plans WHERE id = ? AND user_email = ?",
      [id, req.user.email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Meal plan not found" });
    }

    res.json({ message: "Meal plan deleted successfully" });
  } catch (error) {
    console.error("Error deleting saved meal plan:", error);
    res.status(500).json({ error: "Failed to delete meal plan" });
  }
};
