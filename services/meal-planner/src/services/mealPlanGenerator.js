const { queryGemini } = require("../lib/gemini");

const MEAL_KEYS = ["breakfast", "lunch", "dinner", "snack"];

function cleanArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function healthSummary(context) {
  if (!context) return null;
  return {
    patient: {
      age: context.patient?.age,
      gender: context.patient?.gender,
      health_status: context.patient?.health_status,
    },
    active_prescriptions: (context.active_prescriptions || []).map((item) => ({
      diagnosis: item.diagnosis,
      medicines: (item.medicines || []).map((medicine) => medicine.medicine_name),
    })),
    recent_records: (context.recent_records || []).map((record) => ({
      type: record.type,
      category: record.category,
      summary: String(record.analysis_summary || "").slice(0, 700),
      key_findings: (record.key_findings || []).slice(0, 5),
    })),
  };
}

function parseJson(text) {
  let value = String(text || "").trim();
  value = value.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Gemini did not return JSON");
  return JSON.parse(value.slice(start, end + 1));
}

function normalizePlan(plan, mood) {
  if (!plan || typeof plan !== "object") throw new Error("Invalid meal plan");
  let total = 0;
  for (const key of MEAL_KEYS) {
    const meal = plan[key];
    if (!meal?.name || !Array.isArray(meal.ingredients)) throw new Error(`Missing ${key}`);
    meal.calories = Math.max(0, parseInt(meal.calories, 10) || 0);
    meal.prep_time = Math.max(0, parseInt(meal.prep_time, 10) || 0);
    meal.ingredients = cleanArray(meal.ingredients);
    meal.instructions = Array.isArray(meal.instructions)
      ? meal.instructions.join(" ")
      : String(meal.instructions || "");
    total += meal.calories;
  }
  plan.mood_context = mood;
  plan.total_calories = total;
  plan.plan_id = plan.plan_id || `${mood}_${Date.now()}`;
  plan.warnings = cleanArray(plan.warnings);
  return plan;
}

async function generateMealPlanWithGemini(
  mood,
  dietary,
  cuisine,
  availableIngredients = [],
  allergies = [],
  menstrualData = null,
  careContext = null
) {
  const input = {
    mood: mood || "healthy",
    dietary: dietary || "any",
    cuisine: cuisine || "any",
    available_ingredients: cleanArray(availableIngredients),
    allergies: cleanArray(allergies),
    menstrual_context: menstrualData?.tracking ? menstrualData : null,
    careconnect_context: healthSummary(careContext),
  };

  const prompt = `You are the nutrition feature inside CareConnect Pro. Create one practical day of meals.

SAFETY RULES:
- This is general wellness guidance, not diagnosis or medical treatment.
- Exclude every declared allergy. Never merely warn while still including an allergen.
- Respect the dietary preference.
- Never stop, replace, change, or recommend a dose for a prescription.
- Never claim a medication-food interaction is safe or unsafe. If prescriptions are present, add a warning to confirm interactions with a clinician or pharmacist.
- Do not infer a diagnosis from record summaries.
- Do not recommend supplements or herbal remedies as treatment.
- Use available ingredients only where they fit naturally; necessary common ingredients may be added.
- Menstrual-cycle suggestions must remain supportive food guidance, not medical advice.

REQUEST AND APPROVED CONTEXT:
${JSON.stringify(input, null, 2)}

Return ONLY valid JSON:
{
  "mood_context": "${input.mood}",
  "breakfast": {"name":"", "calories":0, "prep_time":0, "ingredients":[], "instructions":""},
  "lunch": {"name":"", "calories":0, "prep_time":0, "ingredients":[], "instructions":""},
  "dinner": {"name":"", "calories":0, "prep_time":0, "ingredients":[], "instructions":""},
  "snack": {"name":"", "calories":0, "prep_time":0, "ingredients":[], "instructions":""},
  "total_calories": 0,
  "warnings": []
}`;

  try {
    const plan = normalizePlan(parseJson(await queryGemini(prompt)), input.mood);
    if (careContext?.active_prescriptions?.length) {
      const warning = "Active prescriptions are on file. Confirm condition-specific food restrictions and possible interactions with a clinician or pharmacist.";
      if (!plan.warnings.includes(warning)) plan.warnings.push(warning);
    }
    plan.context_used = {
      careconnect: Boolean(careContext),
      active_prescriptions: careContext?.active_prescriptions?.length || 0,
      recent_records: careContext?.recent_records?.length || 0,
    };
    return plan;
  } catch (error) {
    console.error(`Gemini meal generation failed: ${error.message}`);
    return generateStaticFallback(
      input.mood,
      input.dietary,
      input.cuisine,
      input.available_ingredients,
      input.allergies,
      careContext
    );
  }
}

function generateStaticFallback(mood, dietary, cuisine, availableIngredients = [], allergies = [], careContext = null) {
  const diet = String(dietary || "any").toLowerCase();
  const allergyText = cleanArray(allergies).join(" ").toLowerCase();
  const vegan = diet.includes("vegan");
  const vegetarian = vegan || diet.includes("vegetarian");
  const glutenFree = diet.includes("gluten") || /gluten|wheat/.test(allergyText);
  const dairyFree = vegan || diet.includes("dairy") || /milk|dairy|lactose/.test(allergyText);
  const nutFree = /peanut|almond|walnut|cashew|tree nut|nuts/.test(allergyText);

  const oats = glutenFree ? "certified gluten-free oats" : "rolled oats";
  const yogurt = dairyFree ? "unsweetened coconut yogurt" : "plain Greek yogurt";
  const seed = nutFree ? "pumpkin seeds" : "almonds";
  const lunchProtein = vegetarian ? "roasted chickpeas" : "grilled chicken";
  const dinnerProtein = vegan ? "lentils" : vegetarian ? "tofu" : "baked salmon";
  const cuisineLabel = cuisine && String(cuisine).toLowerCase() !== "any" ? `${cuisine} ` : "";
  const moodLabels = {
    energetic: "Energizing",
    comfort: "Comforting",
    healthy: "Balanced",
    indulgent: "Satisfying",
    fresh: "Fresh",
    spicy: "Spiced",
  };
  const label = moodLabels[mood] || "Balanced";

  const extras = cleanArray(availableIngredients)
    .filter((item) => !allergyText.includes(item.toLowerCase()))
    .slice(0, 4);

  const meals = {
    breakfast: {
      name: `${label} ${cuisineLabel}Berry Oats`,
      calories: 390,
      prep_time: 10,
      ingredients: [oats, yogurt, "berries", "chia seeds", seed],
      instructions: "Combine the ingredients and chill overnight, or cook the oats and add the toppings before serving.",
    },
    lunch: {
      name: `${label} ${cuisineLabel}Quinoa Bowl`,
      calories: 520,
      prep_time: 20,
      ingredients: [lunchProtein, "quinoa", "spinach", "tomato", "cucumber", "lemon"],
      instructions: "Cook the quinoa and protein, then combine with vegetables and a simple lemon dressing.",
    },
    dinner: {
      name: `${label} ${cuisineLabel}${dinnerProtein} and Roasted Vegetables`,
      calories: 570,
      prep_time: 30,
      ingredients: [dinnerProtein, "sweet potato", "broccoli", "olive oil", "herbs"],
      instructions: "Roast the vegetables until tender, cook the protein thoroughly, and serve together.",
    },
    snack: {
      name: `${label} Fruit Cup`,
      calories: 190,
      prep_time: 5,
      ingredients: [yogurt, "seasonal fruit", seed],
      instructions: "Combine and serve chilled.",
    },
  };

  if (extras.length) meals.lunch.ingredients.push(...extras);
  const warnings = ["This fallback plan is general wellness guidance and not a prescribed medical diet."];
  if (careContext?.active_prescriptions?.length) {
    warnings.push("Active prescriptions are on file. Confirm condition-specific restrictions and interactions with a clinician or pharmacist.");
  }

  return normalizePlan({
    mood_context: mood,
    ...meals,
    warnings,
    context_used: {
      careconnect: Boolean(careContext),
      active_prescriptions: careContext?.active_prescriptions?.length || 0,
      recent_records: careContext?.recent_records?.length || 0,
      fallback: true,
    },
  }, mood);
}

module.exports = { generateMealPlanWithGemini, generateStaticFallback };
