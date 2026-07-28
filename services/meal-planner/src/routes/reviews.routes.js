const express = require("express");
const ctrl = require("../controllers/reviews.controller");
const { authenticate } = require("../middleware/auth");
const { uploadReviewPhoto } = require("../middleware/upload");

const router = express.Router();

router.get("/reviews", ctrl.listReviews);
router.post("/reviews", authenticate, uploadReviewPhoto.single("photo"), ctrl.createReview);
router.delete("/reviews/:id", authenticate, ctrl.deleteReview);

module.exports = router;
