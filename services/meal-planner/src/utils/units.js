// Weight unit normalization.
function normalizeWeightToKg(weight, unit = "kg") {
  const u = (unit || "kg").toLowerCase();
  return u === "lb" || u === "lbs" ? weight * 0.45359237 : weight;
}

// Enhanced mapping with more comprehensive detection

module.exports = { normalizeWeightToKg };
