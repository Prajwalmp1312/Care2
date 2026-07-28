const express = require("express");
const ctrl = require("../controllers/careconnect.controller");

const router = express.Router();
router.post("/careconnect/session", ctrl.createSession);
module.exports = router;
