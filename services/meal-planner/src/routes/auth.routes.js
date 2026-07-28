const express = require("express");
const ctrl = require("../controllers/auth.controller");



const router = express.Router();

router.get("/validate/email/:email", ctrl.validateEmail);
router.get("/validate/username/:username", ctrl.validateUsername);
router.post("/validate/password", ctrl.validatePassword);
router.post("/login", ctrl.login);
router.get("/users/check/:email", ctrl.checkUserByEmail);
router.post("/users", ctrl.register);

module.exports = router;
