const express = require("express");
const ctrl = require("../controllers/detection.controller");

const { upload } = require("../middleware/upload");

const router = express.Router();

router.post("/enhance-detection", upload.single("image"), ctrl.enhanceDetection);
router.post("/detect-ingredients", upload.single("image"), ctrl.detectIngredients);
router.get("/test-vision", ctrl.testVision);

module.exports = router;
