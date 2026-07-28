const fs = require("fs").promises;
const path = require("path");
const { db } = require("../lib/db");
const { getBaseUrl, uploadsDir } = require("../middleware/upload");

function withPhotoUrl(review) {
  return {
    ...review,
    photo_url: review.photo_url ? `${getBaseUrl()}${review.photo_url}` : null,
  };
}

exports.listReviews = async (_req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM reviews ORDER BY created_at DESC");
    res.json(rows.map(withPhotoUrl));
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
};

exports.createReview = async (req, res) => {
  try {
    const content = String(req.body.content || "").trim();
    const rating = Number(req.body.rating);
    if (!content || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: "Content and a rating from 1 to 5 are required" });
    }

    const [users] = await db.execute("SELECT id, name FROM users WHERE id = ?", [req.user.id]);
    if (!users.length) return res.status(404).json({ error: "User not found" });

    const photoUrl = req.file ? `/uploads/reviews/${req.file.filename}` : null;
    const photoFilename = req.file?.filename || null;
    const [result] = await db.execute(
      "INSERT INTO reviews (name, content, rating, user_id, photo_url, photo_filename) VALUES (?, ?, ?, ?, ?, ?)",
      [users[0].name, content, rating, req.user.id, photoUrl, photoFilename]
    );
    const [rows] = await db.execute("SELECT * FROM reviews WHERE id = ?", [result.insertId]);
    res.status(201).json(withPhotoUrl(rows[0]));
  } catch (error) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    console.error("Error adding review:", error);
    res.status(500).json({ error: "Failed to add review", details: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT photo_filename FROM reviews WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Review not found" });

    await db.execute("DELETE FROM reviews WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (rows[0].photo_filename) {
      await fs.unlink(path.join(uploadsDir, rows[0].photo_filename)).catch(() => {});
    }
    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
};
