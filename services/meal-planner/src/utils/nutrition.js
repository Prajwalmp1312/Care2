function detectMood(text = "") {
  const positive = ["happy", "great", "good", "excited", "energetic", "motivated"];
  const negative = ["sad", "tired", "stressed", "down", "exhausted", "comfort"];
  const value = String(text).toLowerCase();
  const positives = positive.filter((word) => value.includes(word)).length;
  const negatives = negative.filter((word) => value.includes(word)).length;
  if (positives > negatives) return "happy";
  if (negatives > positives) return "sad";
  return "neutral";
}

function calculateDailyCalories(user) {
  if (!user) return 2000;
  const age = Number(user.age) || 30;
  const weight = Number(user.weight) || 70;
  const unit = String(user.weight_unit || "kg").toLowerCase();
  const weightKg = unit.startsWith("lb") ? weight * 0.45359237 : weight;
  const sex = String(user.sex || "Other").toLowerCase();

  const maleBmr = 88.362 + 13.397 * weightKg + 4.799 * 170 - 5.677 * age;
  const femaleBmr = 447.593 + 9.247 * weightKg + 3.098 * 165 - 4.33 * age;
  let bmr = sex === "male" ? maleBmr : sex === "female" ? femaleBmr : (maleBmr + femaleBmr) / 2;
  let calories = bmr * 1.55;
  const purpose = String(user.purpose || "").toLowerCase();
  if (purpose.includes("weight loss")) calories *= 0.85;
  if (purpose.includes("weight gain") || purpose.includes("muscle")) calories *= 1.15;
  return Math.round(calories);
}

module.exports = { detectMood, calculateDailyCalories };
