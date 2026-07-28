const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");
const logger = require("./logger");

let franc = null;
try {
  franc = require("franc-min");
} catch (_error) {
  logger.warn("franc-min unavailable; language detection defaults to English");
}

const genAI = config.gemini.apiKey
  ? new GoogleGenerativeAI(config.gemini.apiKey)
  : null;
const model = genAI
  ? genAI.getGenerativeModel({ model: config.gemini.model })
  : null;

async function queryGemini(prompt) {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const candidates = [...new Set([config.gemini.model, "gemini-2.5-flash"])];
  let lastError;
  for (const modelName of candidates) {
    try {
      const candidate = genAI.getGenerativeModel({ model: modelName });
      const result = await candidate.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      lastError = error;
      logger.warn({ model: modelName, err: error.message }, "Gemini request failed");
    }
  }
  throw new Error(`Gemini request failed: ${lastError?.message || "unknown error"}`);
}

async function listAvailableModels() {
  if (!genAI || typeof genAI.listModels !== "function") return [];
  try {
    return await genAI.listModels();
  } catch (error) {
    logger.warn({ err: error.message }, "Unable to list Gemini models");
    return [];
  }
}

const FRANC_TO_BCP47 = {
  eng: "en", spa: "es", fra: "fr", deu: "de", ita: "it", por: "pt",
  rus: "ru", hin: "hi", tel: "te", tam: "ta", kan: "kn", mar: "mr",
  ben: "bn", pan: "pa", guj: "gu", urd: "ur", ara: "ar", zho: "zh",
  jpn: "ja", kor: "ko",
};

function detectUserLanguage(text) {
  if (!franc) return "en";
  try {
    const code = franc(text || "", { minLength: 3 });
    return !code || code === "und" ? "en" : FRANC_TO_BCP47[code] || "en";
  } catch (_error) {
    return "en";
  }
}

async function translateWithGemini(text, targetLang) {
  if (!text?.trim() || !targetLang || targetLang === "en") return text;
  return (await queryGemini(
    `Translate the text into ${targetLang}. Return only the translation. Keep numbers, emojis, and food names unchanged.\n\n${text}`
  )).trim();
}

async function normalizeToEnglish(message, history = []) {
  const detectedLanguage = detectUserLanguage(message);
  if (detectedLanguage === "en") {
    return { detectedLanguage, message_en: message, history_en: history };
  }
  return {
    detectedLanguage,
    message_en: await translateWithGemini(message, "en"),
    history_en: await Promise.all(history.map(async (item) => ({
      ...item,
      content: await translateWithGemini(String(item?.content || ""), "en"),
    }))),
  };
}

module.exports = {
  genAI,
  model,
  queryGemini,
  listAvailableModels,
  FRANC_TO_BCP47,
  detectUserLanguage,
  translateWithGemini,
  normalizeToEnglish,
};
