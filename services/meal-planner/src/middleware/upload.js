const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const config = require("../config");

const uploadsDir = path.join(__dirname, "..", "..", "uploads", "reviews");

async function ensureUploadsDir() {
  try {
    await fs.access(uploadsDir);
  } catch (error) {
    await fs.mkdir(uploadsDir, { recursive: true });
    console.log("Created uploads directory for reviews");
  }
}


const reviewPhotoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadsDir();
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: review_timestamp_original.ext
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `review_${timestamp}_${Math.random()
      .toString(36)
      .substring(7)}${ext}`;
    cb(null, filename);
  },
});

const uploadReviewPhoto = multer({
  storage: reviewPhotoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for review photos
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Initialize Google Vision API

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB limit
});

// Enhanced CORS Configuration

const getBaseUrl = () => {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  // Fallback for development
  return `http://localhost:${config.port}`;
};


module.exports = { upload, uploadReviewPhoto, ensureUploadsDir, getBaseUrl, uploadsDir };
