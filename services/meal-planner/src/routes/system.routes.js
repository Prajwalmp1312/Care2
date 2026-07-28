const express = require("express");
const ctrl = require("../controllers/system.controller");



const router = express.Router();

router.get("/test-gemini", ctrl.testGemini);
router.get("/health", ctrl.health);
router.get("/", ctrl.apiRoot);

module.exports = router;
