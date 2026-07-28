const express = require("express");
const ctrl = require("../controllers/meals.controller");
const { authenticate } = require("../middleware/auth");


const router = express.Router();

router.post("/meal-plan", ctrl.createMealPlan);
router.get("/meals", ctrl.listMeals);
router.get("/meals/:id", ctrl.getMealById);
router.get("/meal-plans", ctrl.listMealPlans);
router.get("/meal-plans/:id", ctrl.getMealPlanById);
router.post("/generate-ai-meal", ctrl.generateAiMeal);
router.post("/save-meal-plan", authenticate, ctrl.saveMealPlan);
router.get("/saved-meal-plans/:email", authenticate, ctrl.getSavedMealPlans);
router.delete("/saved-meal-plans/:id", authenticate, ctrl.deleteSavedMealPlan);

module.exports = router;
