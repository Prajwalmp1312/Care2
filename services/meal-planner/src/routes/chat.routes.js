const express = require("express");
const ctrl = require("../controllers/chat.controller");



const router = express.Router();

router.post("/detect-language", ctrl.detectLanguage);
router.post("/chat", ctrl.chat);
router.post("/speech-mood", ctrl.speechMood);

module.exports = router;
