const express = require("express");
const ctrl = require("../controllers/users.controller");
const { authenticate, requireOwnership, requireAdmin } = require("../middleware/auth");


const router = express.Router();

router.get("/users/:id", authenticate, requireOwnership("id"), ctrl.getUserById);
router.put("/users/:id", authenticate, requireOwnership("id"), ctrl.updateUser);
router.get("/users", authenticate, requireAdmin, ctrl.listUsers);

module.exports = router;
