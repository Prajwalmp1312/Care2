const express = require("express");
const ctrl = require("../controllers/cycle.controller");
const { authenticate, requireOwnership } = require("../middleware/auth");


const router = express.Router();

router.get("/cycle-info/:userId", authenticate, requireOwnership("userId"), ctrl.getCycleInfo);
router.post("/log-period", authenticate, ctrl.logPeriod);
router.put("/update-cycle/:userId", authenticate, requireOwnership("userId"), ctrl.updateCycle);
router.get("/cycle-logs/:userId", authenticate, requireOwnership("userId"), ctrl.getCycleLogs);
router.get("/users/cycle/:userId", authenticate, requireOwnership("userId"), ctrl.getUserCycle);
router.put("/users/cycle/:userId", authenticate, requireOwnership("userId"), ctrl.updateUserCycle);
router.post("/log-cycle-entry", authenticate, ctrl.logCycleEntry);
router.get("/analyze-cycle-patterns/:userId", authenticate, requireOwnership("userId"), ctrl.analyzeCyclePatterns);
router.post("/generate-cycle-insights", authenticate, ctrl.generateCycleInsights);

module.exports = router;
