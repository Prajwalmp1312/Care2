// Menstrual-cycle phase + nutrition helpers (pure functions).
function calculateCyclePhase(lastPeriodDate, cycleLength = 28) {
  if (!lastPeriodDate) return null;

  const today = new Date();
  const lastPeriod = new Date(lastPeriodDate);
  const daysSinceLastPeriod = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24));
  const dayInCycle = (daysSinceLastPeriod % cycleLength) + 1;

  if (dayInCycle >= 1 && dayInCycle <= 5) return 'menstrual';
  if (dayInCycle >= 6 && dayInCycle <= 13) return 'follicular';
  if (dayInCycle >= 14 && dayInCycle <= 16) return 'ovulation';
  if (dayInCycle >= 17) return 'luteal';

  return 'unknown';
}

function predictNextPeriod(lastPeriodDate, cycleLength = 28) {
  if (!lastPeriodDate) return null;

  const lastPeriod = new Date(lastPeriodDate);
  const nextPeriod = new Date(lastPeriod);
  nextPeriod.setDate(nextPeriod.getDate() + cycleLength);
  return nextPeriod;
}

function daysUntilPeriod(lastPeriodDate, cycleLength = 28) {
  if (!lastPeriodDate) return null;

  const nextPeriod = predictNextPeriod(lastPeriodDate, cycleLength);
  const today = new Date();
  return Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24));
}

function isApproachingPeriod(lastPeriodDate, cycleLength = 28, warningDays = 3) {
  const days = daysUntilPeriod(lastPeriodDate, cycleLength);
  return days !== null && days <= warningDays && days > 0;
}

function getPhaseNutritionAdvice(phase) {
  const advice = {
    menstrual: "Iron-rich foods (spinach, red meat, lentils), Omega-3s (salmon, walnuts), Magnesium (dark chocolate, avocado, nuts), warm comfort foods, ginger tea for cramps",
    follicular: "Fresh vegetables, lean proteins, fermented foods (yogurt, kimchi), energy-boosting meals, whole grains",
    ovulation: "Fiber-rich foods, antioxidants (berries, leafy greens), lighter meals, colorful vegetables, anti-inflammatory foods",
    luteal: "Complex carbs (sweet potato, quinoa, brown rice), B vitamins, calcium-rich foods, magnesium, reduce salt and caffeine to minimize bloating"
  };
  return advice[phase] || "Balanced, nutritious meals";
}

function getPhaseKeyNutrients(phase) {
  const nutrients = {
    menstrual: "iron, magnesium, omega-3 fatty acids, vitamin B12",
    follicular: "protein, B vitamins, probiotics, antioxidants",
    ovulation: "fiber, antioxidants, zinc, vitamin E",
    luteal: "complex carbohydrates, calcium, magnesium, B vitamins, vitamin D"
  };
  return nutrients[phase] || "balanced nutrients";
}

function getCravingFriendlySubstitutes(craving) {
  const substitutes = {
    'chocolate': 'dark chocolate (70%+ cacao), cocoa nibs, chocolate protein smoothie',
    'sweet': 'dates, fresh fruit, honey, dark chocolate',
    'salty': 'roasted nuts, olives, pickles, miso soup, seaweed snacks',
    'carbs': 'sweet potato, quinoa, whole grain toast, oatmeal',
    'ice cream': 'frozen banana nice cream, Greek yogurt with honey, protein ice cream',
    'chips': 'baked vegetable chips, air-popped popcorn, roasted chickpeas',
    'pizza': 'cauliflower crust pizza, whole wheat pita pizza, veggie-loaded flatbread'
  };

  const lowerCraving = craving.toLowerCase();
  for (const [key, value] of Object.entries(substitutes)) {
    if (lowerCraving.includes(key)) {
      return value;
    }
  }
  return null;
}


module.exports = {
  calculateCyclePhase, predictNextPeriod, daysUntilPeriod, isApproachingPeriod,
  getPhaseNutritionAdvice, getPhaseKeyNutrients, getCravingFriendlySubstitutes,
};
