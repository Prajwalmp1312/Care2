// Auto-organized from the original monolith. Handler logic preserved verbatim.
const { queryGemini, detectUserLanguage, translateWithGemini, normalizeToEnglish } = require("../lib/gemini");
const { daysUntilPeriod, isApproachingPeriod } = require("../utils/cycle");
const { detectMood, calculateDailyCalories } = require("../utils/nutrition");
const { optionalCareConnectContext } = require("../lib/careconnect");

// POST /api/detect-language
exports.detectLanguage = (req, res) => {
  const { text } = req.body || {};
  const language = detectUserLanguage(text || "");
  res.json({ language });
};

// POST /api/chat
exports.chat = async (req, res) => {
  try {
    const {
      message,
      history,
      user,
      menstrualData,
      // Optional: frontend can pass a preferred language (e.g. "en", "es", "hi")
      preferredLanguage,
      // Optional: if true, we auto-detect from message even if preferredLanguage is set
      autoDetectLanguage,
    } = req.body;

    // 1) Decide which language the user is speaking/typing
    // If the frontend provides a preferred language AND doesn't want auto-detect, we honor it.
    // Otherwise we detect from the current message.
    const detectedLanguage =
      preferredLanguage && !autoDetectLanguage
        ? preferredLanguage
        : detectUserLanguage(message);

    // 2) Normalize to English for mood detection + prompt consistency
    // If message is non-English, translate message + history to English for context.
    const { message_en, history_en } =
      detectedLanguage === "en"
        ? { message_en: message, history_en: history || [] }
        : await normalizeToEnglish(message, history);

    const mood = detectMood(message_en);
    const careContext = await optionalCareConnectContext(req);

    // Build system prompt based on user context
    let systemPrompt = "You are a helpful AI chef and nutritionist.";

    if (user) {
      const dailyCalories = calculateDailyCalories(user);
      const weightText =
        user.weight_unit === "lb"
          ? `${(user.weight / 0.45359237).toFixed(1)} lb`
          : `${parseFloat(user.weight).toFixed(1)} kg`;

      systemPrompt = `You are a helpful AI chef and nutritionist. The user is ${user.name}, a ${user.age
        }-year-old ${user.sex.toLowerCase()} who weighs ${weightText}.
        Their goal is: ${user.purpose}. Their estimated daily calorie needs are around ${dailyCalories} calories.
        The user is currently feeling ${mood}.`;

      // NEW: Add menstrual cycle context
      if (menstrualData && menstrualData.tracking) {
        const { currentPhase, daysUntilPeriod, isApproachingPeriod, nutritionAdvice } = menstrualData;

        systemPrompt += `\n\n🌸 MENSTRUAL CYCLE CONTEXT:
        - Current Phase: ${currentPhase}
        - Days until next period: ${daysUntilPeriod}
        ${isApproachingPeriod ? '- ⚠️ Period is approaching soon! Be extra supportive and ask about cravings.' : ''}

        Phase-Specific Nutrition Guidance:
        ${nutritionAdvice}

        IMPORTANT INSTRUCTIONS:
        1. ${isApproachingPeriod ? 'Proactively ask if the user has any cravings or PMS symptoms' : 'Mention cycle-appropriate nutrition when relevant'}
        2. Suggest healthy alternatives for cravings (e.g., dark chocolate instead of candy)
        3. Include iron-rich foods if in menstrual phase
        4. Recommend anti-bloating foods if in luteal phase
        5. Be empathetic and supportive about cycle-related challenges
        6. If user mentions cravings, provide healthy satisfying alternatives`;
      }

      systemPrompt += `\n\nProvide personalized meal suggestions that:
        1. Match their current mood (${mood})
        2. Align with their goal (${user.purpose})
        3. Are appropriate for their age and gender
        4. Consider their calorie needs (${dailyCalories} calories/day)
        ${menstrualData && menstrualData.tracking ? '5. Support their current menstrual cycle phase' : ''}

        Be encouraging, helpful, and specific. Include calorie estimates and prep times when suggesting meals.`;
    } else {
      systemPrompt += ` The user is feeling ${mood}. Suggest meals accordingly.`;
    }

    if (careContext) {
      const medicationNames = (careContext.active_prescriptions || [])
        .flatMap((prescription) => prescription.medicines || [])
        .map((medicine) => medicine.medicine_name)
        .filter(Boolean);
      const recordSummaries = (careContext.recent_records || [])
        .map((record) => String(record.analysis_summary || "").slice(0, 500))
        .filter(Boolean);

      systemPrompt += `

CARECONNECT HEALTH CONTEXT:
- Health status: ${careContext.patient?.health_status || "not specified"}
- Active prescriptions on file: ${medicationNames.length ? medicationNames.join(", ") : "none listed"}
- Recent record summaries: ${recordSummaries.length ? recordSummaries.join(" | ") : "none available"}

SAFETY RULES:
1. Do not diagnose from these summaries.
2. Do not advise changing, stopping, or replacing medication.
3. Do not claim a medication-food interaction is safe or unsafe. Recommend confirmation with a clinician or pharmacist.
4. Keep suggestions as general meal-planning guidance.
5. For condition-specific diets, recommend clinician or registered-dietitian review.`;
    }

    // Handle ingredient detection messages
    if (message_en.includes("I have these ingredients:")) {
      const ingredients = message_en
        .split("I have these ingredients:")[1]
        .trim();
      systemPrompt += ` The user has the following ingredients available: ${ingredients}. Suggest meals using them.`;
    }

    if (message_en.includes("I have these allergies:")) {
      const allergies = message_en
        .split("I have these allergies:")[1]
        .trim();
      systemPrompt += ` The user has the following allergies: ${allergies}. Do not suggest meals using those ingredients.`;
    }

    if (
      message_en.toLowerCase().includes("craving") ||
      message_en.toLowerCase().includes("want to eat")
    ) {
      systemPrompt += `\n\nThe user mentioned a craving. Provide healthy, satisfying alternatives and be understanding about their needs.`;
    }

    // Build conversation history for context
    const conversationContext = history_en
      .map(
        (entry) =>
          `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content}`
      )
      .join("\n");

    const fullPrompt = `${systemPrompt}

 Previous conversation:
 ${conversationContext}

 Current user message: ${message_en}

Please provide a helpful, personalized response about meal planning and nutrition.`;

    const response_en = await queryGemini(fullPrompt);

    // 3) Translate assistant response back to the user's language (if needed)
    const response =
      detectedLanguage === "en"
        ? response_en
        : await translateWithGemini(response_en, detectedLanguage);

    res.json({
      response: response,
      mood: mood,
      language: detectedLanguage,
      user_context: {
        daily_calories: user ? calculateDailyCalories(user) : null,
        personalized: !!user,
        cycle_aware: menstrualData && menstrualData.tracking,
        careconnect_aware: Boolean(careContext),
        active_prescriptions: careContext?.active_prescriptions?.length || 0
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Failed to save meal plan",
      details: error.message,
    });
  }
};

// POST /api/speech-mood
exports.speechMood = async (req, res) => {
  try {
    const { transcript, preferredLanguage, autoDetectLanguage } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: "transcript is required" });
    }

    // Detect language for the transcript (or honor preferredLanguage if autoDetect is off)
    const detectedLanguage =
      preferredLanguage && !autoDetectLanguage
        ? preferredLanguage
        : detectUserLanguage(transcript);

    const transcript_en =
      detectedLanguage === "en"
        ? transcript
        : await translateWithGemini(transcript, "en");

    const mood = detectMood(transcript_en);

    // Optional: very lightweight confidence heuristic
    const confidence =
      transcript.trim().split(/\s+/).length >= 4 ? 0.75 : 0.55;

    return res.json({ mood, confidence, language: detectedLanguage });
  } catch (e) {
    console.error("speech-mood error:", e);
    return res.status(500).json({ error: "Failed to detect mood" });
  }
};
