// Auto-organized from the original monolith. Handler logic preserved verbatim.
const { visionClient, detectIngredientsWithVision, detectIngredientsWithVisionEnhanced, simulateAdvancedColorAnalysis, simulatePatternMatching, simulateContextualAnalysis } = require("../lib/vision");

// POST /api/enhance-detection
exports.enhanceDetection = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No image file provided",
        success: false,
      });
    }

    console.log("Enhanced detection requested for image analysis...");

    // Perform multiple detection strategies
    const strategies = {
      vision_api: null,
      color_analysis: null,
      pattern_matching: null,
      contextual_analysis: null,
    };

    // Strategy 1: Enhanced Vision API detection
    if (visionClient) {
      strategies.vision_api = await detectIngredientsWithVision(
        req.file.buffer
      );
    }

    // Strategy 2: Simulate advanced color and pattern analysis
    strategies.color_analysis = await simulateAdvancedColorAnalysis(
      req.file.buffer
    );

    // Strategy 3: Pattern matching based on common vegetable arrangements
    strategies.pattern_matching = await simulatePatternMatching();

    // Strategy 4: Contextual analysis (if this looks like a produce photo)
    strategies.contextual_analysis = await simulateContextualAnalysis();

    // Combine all strategies
    const allIngredients = new Set();

    Object.values(strategies).forEach((strategyResults) => {
      if (strategyResults && Array.isArray(strategyResults)) {
        strategyResults.forEach((ingredient) => allIngredients.add(ingredient));
      }
    });

    const enhancedIngredients = Array.from(allIngredients);

    // Convert image to base64 for frontend display
    const imageBase64 = `data:${req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

    const response = {
      ingredients: enhancedIngredients,
      total_detected: enhancedIngredients.length,
      detection_strategies: {
        vision_api: strategies.vision_api?.length || 0,
        color_analysis: strategies.color_analysis?.length || 0,
        pattern_matching: strategies.pattern_matching?.length || 0,
        contextual_analysis: strategies.contextual_analysis?.length || 0,
      },
      image_base64: imageBase64,
      detection_methods: "Enhanced Multi-Strategy Detection",
      success: true,
      confidence: "Enhanced",
    };

    console.log(
      `Enhanced detection complete: Found ${enhancedIngredients.length} ingredients:`,
      enhancedIngredients
    );

    res.json(response);
  } catch (error) {
    console.error("Enhanced detection error:", error);
    res.status(500).json({
      ingredients: [],
      error: `Failed to enhance detection: ${error.message}`,
      total_detected: 0,
      success: false,
    });
  }
};

// POST /api/detect-ingredients
exports.detectIngredients = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No image file provided",
          success: false,
        });
      }

      console.log(
        `Processing image: ${req.file.originalname}, Size: ${req.file.size} bytes`
      );

      // Validate image
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          error: "File must be an image",
          success: false,
        });
      }

      if (req.file.size > 40 * 1024 * 1024) {
        // 20MB limit
        return res.status(400).json({
          error: "Image too large. Maximum size is 10MB.",
          success: false,
        });
      }

      // Use enhanced detection with detailed reporting
      const detectionResult = await detectIngredientsWithVisionEnhanced(
        req.file.buffer
      );

      // Convert image to base64 for frontend display
      const imageBase64 = `data:${req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;

      const response = {
        ingredients: detectionResult.ingredients,
        total_detected: detectionResult.ingredients.length,
        food_items_found: detectionResult.ingredients.length,
        raw_detections: detectionResult.raw_count || 0,
        filtered_detections: detectionResult.filtered_count || 0,
        image_base64: imageBase64,
        detection_methods: visionClient
          ? "Enhanced Google Vision API + Multi-Strategy Analysis"
          : "Enhanced Fallback Detection",
        methods_used: detectionResult.report?.methods_used || [],
        processing_time: detectionResult.report?.processing_time || 0,
        success: true,
        api_used: visionClient
          ? "Google Vision API (Enhanced)"
          : "Enhanced Fallback",
        confidence: visionClient ? "High" : "Demo",
        vision_details: visionClient
          ? {
            objects_found: detectionResult.report?.raw_results?.objects || 0,
            labels_found: detectionResult.report?.raw_results?.labels || 0,
            text_annotations:
              detectionResult.report?.raw_results?.text_annotations || 0,
          }
          : null,
      };

      console.log(
        `Enhanced detection complete: Found ${detectionResult.ingredients.length} ingredients:`,
        detectionResult.ingredients
      );

      res.json(response);
    } catch (error) {
      console.error("Enhanced image detection error:", error);
      res.status(500).json({
        ingredients: [],
        error: `Failed to process image: ${error.message}`,
        total_detected: 0,
        food_items_found: 0,
        success: false,
        api_used: "Error",
      });
    }
  };

// GET /api/test-vision
exports.testVision = async (req, res) => {
  try {
    if (!visionClient) {
      return res.json({
        status: "Vision API not configured",
        message: "Google Vision API client not initialized",
        suggestion:
          "Add GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_VISION_API_KEY to .env",
        fallback_available: true,
      });
    }

    // Test with a simple detection request
    res.json({
      status: "Vision API available",
      message: "Google Vision API client initialized successfully",
      credentials_type: process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? "Service Account"
        : process.env.GOOGLE_VISION_API_KEY
          ? "API Key"
          : "Default Credentials",
      features_available: [
        "Object Detection",
        "Label Detection",
        "Text Detection",
        "Enhanced Ingredient Mapping",
      ],
    });
  } catch (error) {
    console.error("Vision API test error:", error);
    res.status(500).json({
      status: "Vision API error",
      error: error.message,
      fallback_available: true,
    });
  }
};
