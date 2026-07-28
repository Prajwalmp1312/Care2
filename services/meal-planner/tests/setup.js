// Test environment defaults so config doesn't throw on missing secrets.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-key";
