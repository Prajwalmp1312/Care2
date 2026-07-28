// Auto-organized from the original monolith. Handler logic preserved verbatim.
const { getAllowedOrigins } = require("../config/cors");
const { genAI, model, queryGemini, listAvailableModels } = require("../lib/gemini");
const { visionClient } = require("../lib/vision");
const { getBaseUrl } = require("../middleware/upload");

// GET /api/test-gemini
exports.testGemini = async (req, res) => {
  try {
    console.log("Testing Gemini API connection and models...");

    if (!genAI) {
      return res.status(503).json({
        status: "NOT_CONFIGURED",
        gemini_api_key_configured: false,
        message: "Set GEMINI_API_KEY to test live Gemini responses",
      });
    }

    // List available models
    let availableModels = [];
    try {
      const models = await genAI.listModels();
      availableModels = models.map((model) => ({
        name: model.name,
        displayName: model.displayName,
        version: model.version,
        description: model.description,
      }));
    } catch (listError) {
      console.error("Could not list models:", listError);
    }

    // Test different models
    const testModels = [
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-3.1-pro-preview",
    ];

    const testResults = {};

    for (const modelName of testModels) {
      try {
        console.log(`Testing model: ${modelName}`);
        const testModel = genAI.getGenerativeModel({ model: modelName });
        const result = await testModel.generateContent(
          'Say "Hello from ' + modelName + '"'
        );
        const response = await result.response;
        testResults[modelName] = {
          status: "success",
          response: response.text().substring(0, 100),
        };
        console.log(`✅ ${modelName} works`);
        break; // Use the first working model
      } catch (error) {
        console.log(`❌ ${modelName} failed:`, error.message);
        testResults[modelName] = {
          status: "failed",
          error: error.message,
        };
      }
    }

    res.json({
      status: "OK",
      gemini_api_key_configured: !!process.env.GEMINI_API_KEY,
      available_models: availableModels,
      test_results: testResults,
      recommendation: "Use the first working model from test results",
    });
  } catch (error) {
    console.error("Gemini test error:", error);
    res.status(500).json({
      status: "ERROR",
      error: error.message,
      gemini_api_key_configured: !!process.env.GEMINI_API_KEY,
      suggestion: "Check your GEMINI_API_KEY and internet connection",
    });
  }
};

// GET /api/health
exports.health = async (req, res) => {
  const healthInfo = {
    status: "OK",
    message: "Meal Planner API with Gemini AI and Vision API is running",
    environment: process.env.NODE_ENV,
    database: process.env.DB_NAME,
    database_host: process.env.DB_HOST ? "[CONFIGURED]" : "localhost",
    ai_service: "Google Gemini",
    vision_service: visionClient ? "Google Vision API" : "Fallback detection",
    base_url: getBaseUrl(),
    timestamp: new Date().toISOString(),
    cors_origins: getAllowedOrigins(),
    server_host: process.env.HOST || "0.0.0.0",
    frontend_url: process.env.FRONTEND_URL || "detected from origins",
  };

  // Test Gemini connection if requested
  if (req.query.test_ai === "true") {
    try {
      console.log("Testing Gemini AI connection...");
      const testResponse = await queryGemini('Say "Hello" if you can respond.');
      healthInfo.ai_test = {
        status: "success",
        response: testResponse.substring(0, 100), // First 100 chars
      };
    } catch (error) {
      console.error("Gemini AI test failed:", error);
      healthInfo.ai_test = {
        status: "failed",
        error: error.message,
      };

      // List available models for debugging
      try {
        const models = await listAvailableModels();
        healthInfo.ai_test.available_models = models.map((m) => m.name);
      } catch (listError) {
        healthInfo.ai_test.model_list_error = listError.message;
      }
    }
  }

  // Test Vision API if requested
  if (req.query.test_vision === "true") {
    if (visionClient) {
      healthInfo.vision_test = {
        status: "available",
        message: "Google Vision API client initialized",
        credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
          ? "Service Account File"
          : process.env.GOOGLE_VISION_API_KEY
            ? "API Key"
            : "Default Credentials",
      };
    } else {
      healthInfo.vision_test = {
        status: "not_configured",
        message: "Google Vision API not available",
        fallback: "Using demo ingredient detection",
      };
    }
  }

  res.json(healthInfo);
};

// GET /api
exports.apiRoot = (req, res) => {
  res.json({
    name: "Meal Planner API with Gemini AI and Google Vision",
    version: "2.1.0",
    description:
      "Backend API for Meal Planner - Mood-based meal planning platform with Gemini AI and Vision API",
    cors: `enabled for origins: ${getAllowedOrigins().join(", ")}`,
    ai_service: "Google Gemini Pro",
    vision_service: visionClient ? "Google Vision API" : "Fallback detection",
    endpoints: {
      health: "/api/health",
      chat: "/api/chat",
      generateAIMeal: "/api/generate-ai-meal",
      detectIngredients: "/api/detect-ingredients",
      testVision: "/api/test-vision",
      testGemini: "/api/test-gemini",
      users: "/api/users",
      userCheck: "/api/users/check/:email",
      reviews: "/api/reviews",
      meals: "/api/meals",
      mealPlan: "/api/meal-plan",
      mealPlans: "/api/meal-plans",
      savedMealPlans: "/api/saved-meal-plans",
    },
    features: {
      ingredient_detection: visionClient ? "Google Vision API" : "Demo mode",
      meal_generation: "Google Gemini AI",
      user_management: "MySQL database",
      meal_planning: "AI-powered with fallback",
    },
  });
};
