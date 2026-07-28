import { authFetch } from './services/api';
import React, {
  useState,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useRef,
  useCallback,
} from "react";

import { API_BASE_URL } from './services/api';

// Custom CSS animations - Enhanced with welcome message animations
const styles = `
  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-10px); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { 
      box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4);
      transform: scale(1);
    }
    50% { 
      box-shadow: 0 0 0 8px rgba(249, 115, 22, 0);
      transform: scale(1.05);
    }
  }
  
  @keyframes slide-progress {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(0%); }
    100% { transform: translateX(100%); }
  }

  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fade-in-delayed {
    0%, 30% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes fade-in-content {
    0%, 50% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes fade-in-late {
    0%, 70% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes stagger-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes float-delayed {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }

  @keyframes bounce-slow {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  @keyframes bounce-gentle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  @keyframes pulse-glow-welcome {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 20px rgba(251, 146, 60, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 30px rgba(251, 146, 60, 0.5);
    }
  }
  
  .typing-animation { animation: typing 1.4s infinite; }
  .pulse-glow { animation: pulse-glow 2s infinite; }
  .slide-progress { animation: slide-progress 2s infinite; }

  .animate-fade-in-up {
    animation: fade-in-up 0.8s ease-out;
  }

  .animate-fade-in {
    animation: fade-in 0.6s ease-out;
  }

  .animate-fade-in-delayed {
    animation: fade-in-delayed 1.2s ease-out;
  }

  .animate-fade-in-content {
    animation: fade-in-content 1.5s ease-out;
  }

  .animate-fade-in-late {
    animation: fade-in-late 2s ease-out;
  }

  .animate-slide-in {
    animation: slide-in 0.6s ease-out 0.3s both;
  }

  .animate-slide-up {
    animation: slide-up 0.4s ease-out;
  }

  .animate-stagger-in {
    animation: stagger-in 0.5s ease-out 0.8s both;
  }

  .animate-float {
    animation: float 3s ease-in-out infinite;
  }

  .animate-float-delayed {
    animation: float-delayed 3s ease-in-out infinite 0.5s;
  }

  .animate-bounce-slow {
    animation: bounce-slow 2s ease-in-out infinite 1s;
  }

  .animate-bounce-gentle {
    animation: bounce-gentle 2s ease-in-out infinite;
  }

  .animate-pulse-glow-welcome {
    animation: pulse-glow-welcome 2s ease-in-out infinite;
  }
`;

// Inject styles
if (typeof document !== "undefined" && !document.getElementById("chatbot-styles")) {
  const styleSheet = document.createElement("style");
  styleSheet.id = "chatbot-styles";
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

const Chatbot = forwardRef(({ user }, ref) => {
const [visible, setVisible] = useState(false);
const [input, setInput] = useState("");
const [history, setHistory] = useState([]);
const [typing, setTyping] = useState(false);
const [mood, setMood] = useState("");

const [preferredLanguage, setPreferredLanguage] = useState(
    () => localStorage.getItem("mealplanner_lang") || "auto"
  );
// lastDetectedLanguage: what backend detected for the most recent message
const [lastDetectedLanguage, setLastDetectedLanguage] = useState("en");
const [showUploadMenu, setShowUploadMenu] = useState(false);
const [isProcessingImage, setIsProcessingImage] = useState(false);
const [showWelcome, setShowWelcome] = useState(true);

// ✅ Voice / Speech / Tone features
const [ttsEnabled, setTtsEnabled] = useState(true);
const [emotion, setEmotion] = useState(""); // tone emotion label (excited/sad/angry/calm)
const [listening, setListening] = useState(false);
const [recording, setRecording] = useState(false);

const [showImageConfirm, setShowImageConfirm] = useState(false);
const [pendingImageFile, setPendingImageFile] = useState(null);
const [pendingImagePreview, setPendingImagePreview] = useState("");
const [imageUserComment, setImageUserComment] = useState("");

  const messagesEndRef = useRef(null);

  // Keep the latest input without adding it to speech effect deps
  const inputRef = useRef("");
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Persist language preference
  useEffect(() => {
    try {
      localStorage.setItem("mealplanner_lang", preferredLanguage);
    } catch {}
  }, [preferredLanguage]);

  // Speech / Audio refs
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const micStreamRef = useRef(null);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const toneStatsRef = useRef({
    frames: 0,
    rmsSum: 0,
    rmsMax: 0,
    pitchSum: 0,
    pitchFrames: 0,
    zcrSum: 0,
  });

  const ttsUtterRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const queueImageForConfirmation = (file) => {
    if (!file) return;

    if (showWelcome) setShowWelcome(false);

    const previewUrl = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPendingImagePreview(previewUrl);
    setImageUserComment("");
    setShowImageConfirm(true);

    // Close upload menu if open
    setShowUploadMenu(false);
  };

  function calculateCyclePhase(lastPeriodDate, cycleLength = 28) {
    if (!lastPeriodDate) return null;
    const today = new Date();
    const lastPeriod = new Date(lastPeriodDate);
    const daysSinceLastPeriod = Math.floor(
      (today - lastPeriod) / (1000 * 60 * 60 * 24)
    );
    const dayInCycle = (daysSinceLastPeriod % cycleLength) + 1;

    if (dayInCycle >= 1 && dayInCycle <= 5) return "menstrual";
    if (dayInCycle >= 6 && dayInCycle <= 13) return "follicular";
    if (dayInCycle >= 14 && dayInCycle <= 16) return "ovulation";
    if (dayInCycle >= 17) return "luteal";
    return "unknown";
  }

  function daysUntilPeriod(lastPeriodDate, cycleLength = 28) {
    if (!lastPeriodDate) return null;
    const lastPeriod = new Date(lastPeriodDate);
    const nextPeriod = new Date(lastPeriod);
    nextPeriod.setDate(nextPeriod.getDate() + cycleLength);
    const today = new Date();
    return Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24));
  }

  // Map short language codes (en/es/hi/te...) to common locales for Web Speech APIs
  const langToLocale = (lang) => {
    const l = (lang || "").toLowerCase();
    const map = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
      de: "de-DE",
      it: "it-IT",
      pt: "pt-PT",
      ru: "ru-RU",
      hi: "hi-IN",
      te: "te-IN",
      ta: "ta-IN",
      kn: "kn-IN",
      mr: "mr-IN",
      bn: "bn-IN",
      pa: "pa-IN",
      gu: "gu-IN",
      ur: "ur-PK",
      ar: "ar-SA",
      zh: "zh-CN",
      ja: "ja-JP",
      ko: "ko-KR",
    };
    return map[l] || "en-US";
  };

  // ✅ Voice reply (TTS)
  const stopSpeaking = () => {
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {}
  };

  const speak = (text) => {
    try {
      if (!ttsEnabled) return;
      if (!("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      // Speak in the same language the backend detected for the last message
      utter.lang = langToLocale(lastDetectedLanguage);

      // Optional: tune voice by detected tone emotion
      if (emotion === "excited") {
        utter.rate = 1.08;
        utter.pitch = 1.15;
      } else if (emotion === "sad") {
        utter.rate = 0.95;
        utter.pitch = 0.9;
      } else if (emotion === "angry") {
        utter.rate = 1.1;
        utter.pitch = 1.05;
      } else {
        utter.rate = 1.0;
        utter.pitch = 1.0;
      }

      utter.volume = 1.0;

      ttsUtterRef.current = utter;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.error("TTS speak error:", e);
    }
  };

  // Cleanup on unmount: stop mic, analyser raf, tts
  useEffect(() => {
    return () => {
      try {
        stopSpeaking();
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to get initial message based on user
  const getInitialMessage = useCallback(() => {
    if (user) {
      let cycleMessage = "";

      // Add menstrual cycle greeting if applicable
      if (user.sex === "Female" && user.track_menstrual_cycle && user.last_period_date) {
        const phase = calculateCyclePhase(user.last_period_date, user.cycle_length || 28);
        const daysUntil = daysUntilPeriod(user.last_period_date, user.cycle_length || 28);

        if (daysUntil <= 3 && daysUntil > 0) {
          cycleMessage = `\n\n🌸 I notice your period is coming in ${daysUntil} day${
            daysUntil !== 1 ? "s" : ""
          }. Would you like meal suggestions that help with PMS symptoms or satisfy specific cravings?`;
        } else if (phase) {
          cycleMessage = `\n\n🌸 You're currently in the ${phase} phase. I can suggest meals optimized for your nutritional needs right now!`;
        }
      }

      return {
        role: "assistant",
        content: `👋 Hi ${user.name}! I'm your Meal Planning Assistant.\n\nI see you're ${user.age} years old and your goal is ${user.purpose.toLowerCase()}. Perfect! I can help you create personalized meal plans.${cycleMessage}\n\nTo get started, tell me:\n1. What's your mood today?\n2. Is this for breakfast, lunch, or dinner?\n3. Any specific ingredients you'd like to include?\n4. Do you have any allergies?\n\nOr choose 'Add photos and files' below to detect ingredients from an image.`,
        isWelcome: true,
      };
    }

    return {
      role: "assistant",
      content:
        "👋 Hi there! I'm your Meal Planning Assistant.\nTo get started, tell me a bit about what you need:\n\n1. What's your mood today?\n2. Is this for breakfast, lunch, or dinner?\n3. How many calories are you aiming for?\n4. Any main ingredient you'd like to include? Or choose 'Add photos and files' below to detect ingredients.\n5. Do you have any allergies?",
      isWelcome: true,
    };
  }, [user]);

  // Initialize chat history when user changes or component mounts
  useEffect(() => {
    setHistory([getInitialMessage()]);
    setShowWelcome(true);
  }, [user, getInitialMessage]);

  // Function to clear chat history
  const clearChat = () => {
    setHistory([getInitialMessage()]);
    setMood("");
    setEmotion("");
    setInput("");
    setTyping(false);
    setIsProcessingImage(false);
    setShowUploadMenu(false);
    setShowWelcome(true);
    stopSpeaking();
  };

  useImperativeHandle(ref, () => ({
    openChat: () => setVisible(true),
  }));

  // ✅ Mood from transcript (you already had this; kept + improved)
  const detectMoodFromTranscript = async (transcript) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/speech-mood`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          preferredLanguage: preferredLanguage === "auto" ? null : preferredLanguage,
          autoDetectLanguage: preferredLanguage === "auto",
        }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data?.language) setLastDetectedLanguage(data.language);
      if (data?.mood) {
        setMood(data.mood);

        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `🎧 I detected your mood as **${data.mood}** from your voice. If that’s wrong, just tell me your mood.`,
          },
        ]);
      }
      return data;
    } catch (e) {
      console.error("detectMoodFromTranscript error:", e);
      return null;
    }
  };

  // --------------------------
  // ✅ Tone emotion from audio
  // --------------------------
  const computeRMS = (timeDomain) => {
    let sumSq = 0;
    for (let i = 0; i < timeDomain.length; i++) {
      const v = (timeDomain[i] - 128) / 128; // normalize [-1,1]
      sumSq += v * v;
    }
    return Math.sqrt(sumSq / timeDomain.length);
  };

  const computeZCR = (timeDomain) => {
    let crossings = 0;
    let prev = (timeDomain[0] - 128) / 128;
    for (let i = 1; i < timeDomain.length; i++) {
      const cur = (timeDomain[i] - 128) / 128;
      if ((prev >= 0 && cur < 0) || (prev < 0 && cur >= 0)) crossings++;
      prev = cur;
    }
    return crossings / timeDomain.length;
  };

  const estimatePitchHz = (timeDomain, sampleRate) => {
    const buf = new Float32Array(timeDomain.length);
    for (let i = 0; i < timeDomain.length; i++) {
      buf[i] = (timeDomain[i] - 128) / 128;
    }

    let bestOffset = -1;
    let bestCorr = 0;

    const minHz = 70;
    const maxHz = 300;
    const minLag = Math.floor(sampleRate / maxHz);
    const maxLag = Math.floor(sampleRate / minHz);

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < buf.length - lag; i++) {
        corr += buf[i] * buf[i + lag];
      }
      if (corr > bestCorr) {
        bestCorr = corr;
        bestOffset = lag;
      }
    }

    if (bestOffset <= 0) return null;
    const hz = sampleRate / bestOffset;

    if (bestCorr < 5) return null; // weak correlation guard
    return hz;
  };

  const classifyEmotionFromTone = ({ avgRms, maxRms, avgPitch, avgZcr }) => {
    const highEnergy = avgRms > 0.08 || maxRms > 0.18;
    const lowEnergy = avgRms < 0.04 && maxRms < 0.10;

    const highPitch = avgPitch && avgPitch > 185;
    const lowPitch = avgPitch && avgPitch < 140;

    const fast = avgZcr > 0.12;
    const slow = avgZcr < 0.08;

    if (highEnergy && highPitch && fast) return "excited";
    if (highEnergy && fast && !highPitch) return "angry";
    if (lowEnergy && (lowPitch || slow)) return "sad";
    return "calm";
  };

  const startToneCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    source.connect(analyser);

    toneStatsRef.current = {
      frames: 0,
      rmsSum: 0,
      rmsMax: 0,
      pitchSum: 0,
      pitchFrames: 0,
      zcrSum: 0,
    };

    const timeData = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (!analyserRef.current || !audioCtxRef.current) return;

      analyserRef.current.getByteTimeDomainData(timeData);

      const rms = computeRMS(timeData);
      const zcr = computeZCR(timeData);
      const pitch = estimatePitchHz(timeData, audioCtxRef.current.sampleRate);

      const s = toneStatsRef.current;
      s.frames += 1;
      s.rmsSum += rms;
      s.rmsMax = Math.max(s.rmsMax, rms);
      s.zcrSum += zcr;

      if (pitch) {
        s.pitchSum += pitch;
        s.pitchFrames += 1;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    // Optional: keep recorder for future server-side SER model
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recorder.start();
  };

  const stopToneCapture = async () => {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }

      if (audioCtxRef.current) {
        await audioCtxRef.current.close();
        audioCtxRef.current = null;
      }

      const s = toneStatsRef.current;
      const avgRms = s.frames ? s.rmsSum / s.frames : 0;
      const avgZcr = s.frames ? s.zcrSum / s.frames : 0;
      const avgPitch = s.pitchFrames ? s.pitchSum / s.pitchFrames : null;

      const label = classifyEmotionFromTone({
        avgRms,
        maxRms: s.rmsMax,
        avgPitch,
        avgZcr,
      });

      setEmotion(label);

      setHistory((prev) => [
        ...prev,
        { role: "assistant", content: `🎙️ Tone emotion detected: **${label}** (based on your voice).` },
      ]);
    } catch (e) {
      console.error("stopToneCapture error:", e);
    }
  };

  // --------------------------
  // ✅ SpeechRecognition init
  // --------------------------
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      console.warn("Speech Recognition not supported");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    // Use user-selected language for speech recognition, or browser language when in Auto mode.
    const baseLang =
      preferredLanguage === "auto"
        ? (navigator.language || "en").split("-")[0]
        : preferredLanguage;
    recognition.lang = langToLocale(baseLang);
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);

    recognition.onerror = (e) => {
      console.error("Speech error:", e);

      setListening(false);
      setRecording(false);
      stopToneCapture().catch(() => {});

      const msg =
        e?.error === "not-allowed"
          ? "🎙️ Microphone permission is blocked. Please allow mic access in Chrome settings."
          : e?.error === "audio-capture"
          ? "🎙️ Microphone is busy (another feature/app is using it). Close other apps or try again."
          : "🎙️ Speech-to-text failed on this device. Please type your request.";

      setHistory((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    };


    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");

      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      detectMoodFromTranscript(transcript);
    };

    recognition.onend = () => {
      setListening(false);

      if (recording) {
        if (!isMobile()) stopToneCapture().catch(() => {});
        setRecording(false);

        const text = (inputRef.current || "").trim();
        if (text) setTimeout(() => sendMessage(), 150);
      }
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleVoice = async () => {
    try {
      if (!recognitionRef.current) {
        setHistory((prev) => [...prev, { role: "assistant", content: "⚠️ Speech-to-text is not supported on this browser." }]);
        return;
      }

      // Stop current session
      if (recording || listening) {
        recognitionRef.current.stop();
        if (!isMobile()) await stopToneCapture();
        setRecording(false);
        setListening(false);
        return;
      }

      // Start session
      setRecording(true);

      const baseLang =
        preferredLanguage === "auto"
          ? (navigator.language || "en").split("-")[0]
          : preferredLanguage;

      recognitionRef.current.lang = langToLocale(baseLang);

      // ✅ Mobile: STT only
      if (isMobile()) {
        recognitionRef.current.start();
        return;
      }

      // ✅ Desktop: tone + STT (if it works for you there)
      await startToneCapture();
      recognitionRef.current.start();
    } catch (e) {
      console.error("toggleVoice error:", e);
      setRecording(false);
      setListening(false);
      stopToneCapture().catch(() => {});
      setHistory((prev) => [...prev, { role: "assistant", content: "⚠️ Voice input failed. Please type your request." }]);
    }
  };


  const sendMessage = async () => {
    if (!input.trim()) return;

    // Hide welcome message after first user interaction
    if (showWelcome) setShowWelcome(false);

    const userText = input;
    const newHistory = [...history, { role: "user", content: userText }];
    setHistory(newHistory);
    setInput("");
    setTyping(true);

    try {
      let menstrualData = null;
      if (user && user.sex === "Female" && user.track_menstrual_cycle) {
        try {
          const cycleRes = await authFetch(`${API_BASE_URL}/cycle-info/${user.id}`);
          if (cycleRes.ok) {
            menstrualData = await cycleRes.json();
          }
        } catch (err) {
          console.log("Could not fetch cycle info:", err);
        }
      }

      const chatPayload = {
        message: userText,
        history,
        user: user
          ? {
              name: user.name,
              age: user.age,
              sex: user.sex,
              weight: user.weight,
              purpose: user.purpose,
            }
          : null,
        menstrualData,
        // Optional: include tone emotion to help the backend tailor meals
        toneEmotion: emotion || null,
        preferredLanguage:
          preferredLanguage === "auto" ? null : preferredLanguage,
        autoDetectLanguage: preferredLanguage === "auto",
      };

      const res = await authFetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatPayload),
      });

      const data = await res.json();
      setMood(data.mood);
      if (data?.language) setLastDetectedLanguage(data.language);
      if (data.language) setLastDetectedLanguage(data.language);

      const words = (data.response || "").split(" ");
      let responseText = "";

      await new Promise((resolve) => setTimeout(resolve, 800));

      for (let i = 0; i < words.length; i++) {
        responseText += words[i] + " ";
        setHistory([...newHistory, { role: "assistant", content: responseText.trim() }]);

        let delay = 30;
        const word = words[i];

        if (word.includes(".") || word.includes("!") || word.includes("?")) {
          delay = 150;
        } else if (word.includes(",")) {
          delay = 100;
        } else if (word.length > 8) {
          delay = 60;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // ✅ Voice reply after the message is fully rendered
      speak(data.response || "");
    } catch (err) {
      console.error("Chat error:", err);
      setHistory([
        ...newHistory,
        {
          role: "assistant",
          content:
            "⚠️ Failed to fetch a response. Please try again or confirm the CareConnect API is running on port 8000.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };


  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setHistory((prev) => [
          ...prev,
          { role: "assistant", content: "❌ Please upload a valid image file (JPG, PNG, etc.)" },
        ]);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setHistory((prev) => [
          ...prev,
          { role: "assistant", content: "❌ Image too large. Please upload an image smaller than 10MB." },
        ]);
        return;
      }

      queueImageForConfirmation(file);
    }
    setShowUploadMenu(false);
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
          queueImageForConfirmation(file);
        },
        "image/jpeg",
        0.8
      );

      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error("Camera capture error:", err);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "⚠️ **Camera Access Error**\n\nCouldn't access your camera. Please check:\n• Camera permissions are enabled\n• No other app is using the camera\n• Your device has a camera\n\nYou can try uploading an image instead.",
        },
      ]);
    }
    setShowUploadMenu(false);
  };

  const quickActions = [
    { text: "I'm feeling energetic", emoji: "⚡" },
    { text: "I want comfort food", emoji: "🤗" },
    { text: "Something healthy please", emoji: "🥗" },
    { text: "I want to indulge today", emoji: "🍰" },
    { text: "Quick breakfast ideas", emoji: "🌅" },
    { text: "Lunch for work", emoji: "🍱" },
    { text: "Family dinner", emoji: "👨‍👩‍👧‍👦" },
    { text: "Late night snack", emoji: "🌙" },
  ];

  const WelcomeMessage = ({ message, user }) => (
    <div className="flex justify-start mb-6">
      <div className="max-w-[90%] order-1">
        <div className="relative bg-gradient-to-br from-orange-50 via-white to-green-50 border-2 border-orange-100 rounded-2xl shadow-lg overflow-hidden animate-fade-in-up">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-4 w-12 h-12 bg-orange-400 rounded-full animate-float"></div>
            <div className="absolute top-8 right-8 w-8 h-8 bg-green-400 rounded-full animate-float-delayed"></div>
            <div className="absolute bottom-6 left-1/3 w-6 h-6 bg-yellow-400 rounded-full animate-bounce-slow"></div>
          </div>

          <div className="relative p-6 pb-4">
            <div className="flex items-center space-x-4 mb-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-green-500 rounded-full flex items-center justify-center text-2xl animate-pulse-glow-welcome">
                  🍽️
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs text-white animate-bounce">
                  AI
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent animate-fade-in">
                  {user ? `Welcome back, ${user.name}! 👋` : "Welcome to Your AI Meal Assistant! 👋"}
                </h3>
                <p className="text-sm text-gray-600 mt-1 animate-fade-in-delayed">
                  Powered by Google Gemini AI • Personalized just for you
                </p>
              </div>
            </div>

            {user && (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 mb-4 border border-orange-100 animate-slide-in">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🎯</span>
                    <div>
                      <p className="font-semibold text-gray-700">Goal</p>
                      <p className="text-orange-600">{user.purpose}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📊</span>
                    <div>
                      <p className="font-semibold text-gray-700">Profile</p>
                      <p className="text-green-600">
                        {user.age}y • {user.weight}kg
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="prose prose-sm max-w-none">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-green-100 animate-fade-in-content">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {message.content.replace(/👋[^!]*!/, "").trim()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 animate-stagger-in">
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🔍</span>
                  <div>
                    <p className="font-medium text-orange-800 text-sm">Smart Detection</p>
                    <p className="text-xs text-orange-600">Upload food photos</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🍳</span>
                  <div>
                    <p className="font-medium text-green-800 text-sm">Custom Recipes</p>
                    <p className="text-xs text-green-600">Tailored to your goals</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-600 mb-3">🚀 Quick Start:</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.slice(0, 4).map((action, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(action.text);
                      setShowWelcome(false);
                    }}
                    className="flex items-center space-x-1 bg-white hover:bg-gradient-to-r hover:from-orange-50 hover:to-green-50 text-gray-700 text-xs px-3 py-2 rounded-full transition-all duration-300 border hover:border-orange-300 hover:shadow-md transform hover:scale-105 animate-fade-in"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <span>{action.emoji}</span>
                    <span>{action.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-2 text-left animate-fade-in-late">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );

  const renderMessage = (msg, index) => {
    const isUser = msg.role === "user";

    if (msg.isWelcome && showWelcome) {
      return <WelcomeMessage key={index} message={msg} user={user} />;
    }

    return (
      <div key={index} className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
        <div className={`max-w-[85%] ${isUser ? "order-2" : "order-1"}`}>
          <div
            className={`p-3 rounded-lg shadow-sm ${
              isUser
                ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white ml-2"
                : "bg-white border border-gray-200 text-gray-800 mr-2"
            }`}
          >
            {msg.image && (
              <div className="mb-3">
                <img
                  src={msg.image}
                  alt="Uploaded for ingredient detection"
                  className="w-full max-w-sm rounded-lg shadow-md"
                  style={{ maxHeight: "200px", objectFit: "cover" }}
                />
              </div>
            )}

            <div className="whitespace-pre-wrap break-words">{msg.content}</div>

            {msg.detectionData && msg.detectionData.success && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Detection Summary:</strong>
                </div>
                <div className="flex flex-wrap gap-2">
                  {msg.detectionData.ingredients.map((ingredient, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`text-xs text-gray-500 mt-1 ${isUser ? "text-right" : "text-left"}`}>
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    );
  };

  const confirmImageUpload = async () => {
  const file = pendingImageFile;
  const comment = imageUserComment;

  setShowImageConfirm(false);
  setPendingImageFile(null);

  await processConfirmedImageUpload({ file, comment });

  // cleanup preview URL
  try {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
  } catch {}
  setPendingImagePreview("");
  setImageUserComment("");
};

const cancelImageUpload = () => {
  setShowImageConfirm(false);
  setPendingImageFile(null);

  try {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
  } catch {}
  setPendingImagePreview("");
  setImageUserComment("");

  setHistory((prev) => [
    ...prev,
    { role: "assistant", content: "✅ Image upload cancelled." },
  ]);
};


  const processConfirmedImageUpload = async ({ file, comment }) => {
  if (!file) return;

  setIsProcessingImage(true);

  // Add the user message to chat (image + comment)
  const imageMessage = {
    role: "user",
    content: comment?.trim()
      ? `📷 Image uploaded. Note: ${comment.trim()}`
      : "📷 Image uploaded for ingredient detection",
    image: pendingImagePreview || URL.createObjectURL(file),
  };

  const baseHistory = [...history, imageMessage];
  setHistory(baseHistory);

  const formData = new FormData();
  formData.append("image", file);
  // Optional: send comment to backend (harmless if backend ignores it)
  formData.append("comment", comment || "");

  try {
    const res = await authFetch(`${API_BASE_URL}/detect-ingredients`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!data.success) {
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ **Detection Failed**\n\n${
            data.error || "I couldn't detect ingredients from this image."
          }\n\nTry a clearer image or tell me ingredients manually.`,
        },
      ]);
      return;
    }

    const ingredients = data.ingredients?.join(", ") || "no ingredients found";

    // Show detection summary (but DO NOT auto-fill textarea)
    const detectionMessage = {
      role: "assistant",
      content: `🔍 **Detected ingredients:** ${ingredients}`,
      detectionData: { ...data, enhanced: true },
    };

    const afterDetection = [...baseHistory, detectionMessage];
    setHistory(afterDetection);

    // ✅ If user gave a comment, produce an assistant response based on it
    // by calling /chat using a combined prompt.
    if (comment?.trim()) {
      setTyping(true);

      const messageForChat =
        `User comment: ${comment.trim()}\n` +
        `Detected ingredients: ${ingredients}\n\n` +
        `Respond to the user using the comment as the main instruction. If they asked for meals, suggest meals using these ingredients.`;

      const chatPayload = {
        message: messageForChat,
        history: afterDetection,
        user: user
          ? {
              name: user.name,
              age: user.age,
              sex: user.sex,
              weight: user.weight,
              purpose: user.purpose,
            }
          : null,
        toneEmotion: emotion || null,
        preferredLanguage: preferredLanguage === "auto" ? null : preferredLanguage,
        autoDetectLanguage: preferredLanguage === "auto",
      };

      const chatRes = await authFetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatPayload),
      });

      const chatData = await chatRes.json();
      if (chatData?.language) setLastDetectedLanguage(chatData.language);
      if (chatData?.mood) setMood(chatData.mood);

      setHistory((prev) => [
        ...prev,
        { role: "assistant", content: chatData.response || "✅ Done." },
      ]);

      speak(chatData.response || "");
    } else {
      // If no comment, ask what they want (without auto-filling input)
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "🍳 What would you like me to do with these ingredients?\n• Suggest meals\n• Create a meal plan\n• Filter for your goal (bulking/weight loss/etc.)",
        },
      ]);
    }
  } catch (err) {
    console.error("Image detection error:", err);
    setHistory((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "⚠️ **Service Error**\n\nFailed to process the image. Please check if the detection service is running and try again.",
      },
    ]);
  } finally {
    setIsProcessingImage(false);
    setTyping(false);
  }
};


  return (
    <>
      <button
        onClick={() => setVisible(!visible)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-orange-500 to-green-500 text-white p-4 rounded-full shadow-lg hover:from-orange-600 hover:to-green-600 transition-all transform hover:scale-110 animate-bounce-gentle"
      >
        💬
      </button>

      {visible && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-2xl h-[90vh] bg-white border rounded-2xl shadow-2xl flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex justify-between items-center bg-gradient-to-r from-orange-500 to-green-500 text-white p-4 rounded-t-2xl">
              <div className="flex flex-col">
                <span className="font-semibold text-lg">
                  {user ? `${user.name}'s Meal Assistant` : "Meal Chatbot"}
                </span>
                <span className="text-orange-100 text-sm">
                  {mood ? `Current mood: ${mood}` : "AI-powered meal planning with Gemini"}
                  {emotion ? ` • Tone: ${emotion}` : ""}
                  {user && ` • Goal: ${user.purpose}`}
                </span>
              </div>

              {/* Header buttons */}
              <div className="flex items-center space-x-2">
                {/* 🌍 Language selector */}
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  title={`Language (current: ${lastDetectedLanguage})`}
                  className="bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded-lg border border-white/20 focus:outline-none"
                  disabled={typing || isProcessingImage}
                >
                  <option value="auto">Auto</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="hi">हिन्दी</option>
                  <option value="te">తెలుగు</option>
                  <option value="ta">தமிழ்</option>
                </select>

                <button
                  onClick={clearChat}
                  className="text-white hover:text-yellow-200 text-lg font-bold bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                  title="Clear chat history"
                  disabled={typing || isProcessingImage}
                >
                  🗑️
                </button>

                <button
                  onClick={() => setVisible(false)}
                  className="text-white hover:text-red-200 text-xl font-bold bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors hover:rotate-90 duration-300"
                  title="Close chat"
                >
                  ×
                </button>
              </div>
            </div>

            {/* User Info Banner */}
            {user && (
              <div className="bg-gradient-to-r from-orange-50 to-green-50 p-3 border-b border-orange-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    📊 {user.age}y • {user.sex} • {user.weight}kg • Goal: {user.purpose}
                  </span>
                  <span className="text-orange-600 font-medium">Personalized Recommendations</span>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
              {history.map((msg, i) => renderMessage(msg, i))}

              {isProcessingImage && (
                <div className="flex justify-start mb-4">
                  <div className="bg-white border border-gray-200 text-gray-800 p-4 rounded-lg mr-2 shadow-sm animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">🔍 Analyzing image...</span>
                        <span className="text-xs text-gray-500">Detecting ingredients with AI</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {typing && (
                <div className="flex justify-start mb-4">
                  <div className="bg-gradient-to-r from-white to-gray-50 border border-orange-100 text-gray-800 p-4 rounded-lg mr-2 shadow-md animate-fade-in">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full animate-bounce"></div>
                        <div
                          className="w-3 h-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-3 h-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-orange-600">🤖 Gemini AI</span>
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-orange-400 rounded-full animate-ping"></div>
                            <div
                              className="w-1 h-1 bg-orange-400 rounded-full animate-ping"
                              style={{ animationDelay: "0.5s" }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          Generating personalized meal suggestions...
                        </span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-green-500 h-1.5 rounded-full animate-pulse"
                          style={{ width: "60%" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions - Only show if welcome is not visible */}
            {!showWelcome && history.length <= 2 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-white">
                <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
                <div className="flex flex-wrap gap-2">
                  {quickActions.slice(4, 8).map((action, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(action.text)}
                      className="flex items-center space-x-1 bg-gray-100 hover:bg-orange-50 text-gray-700 text-xs px-3 py-2 rounded-full transition-colors border hover:border-orange-200"
                    >
                      <span>{action.emoji}</span>
                      <span>{action.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl">
              <div className="flex items-end space-x-3 relative">
                {/* Upload button */}
                <div className="relative">
                  <button
                    onClick={() => setShowUploadMenu(!showUploadMenu)}
                    className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                    title="Add images or files"
                    disabled={isProcessingImage || typing}
                  >
                    <span className="text-lg">🔎</span>
                  </button>

                  {showUploadMenu && (
                    <div className="absolute bottom-12 left-0 bg-white border shadow-lg rounded-xl p-2 w-64 z-20 animate-slide-up">
                      <div className="text-xs text-gray-500 p-2 border-b">
                        📷 Add ingredient photos for detection
                      </div>

                      <button
                        onClick={handleCameraCapture}
                        className="flex items-center space-x-3 w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors"
                        disabled={isProcessingImage}
                      >
                        <span className="text-lg">📷</span>
                        <div>
                          <div className="font-medium">Take Photo</div>
                          <div className="text-xs text-gray-500">Use camera to capture ingredients</div>
                        </div>
                      </button>

                      <label className="flex items-center space-x-3 w-full px-4 py-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                        <span className="text-lg">📁</span>
                        <div>
                          <div className="font-medium">Upload Image</div>
                          <div className="text-xs text-gray-500">Select from your device</div>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                          disabled={isProcessingImage}
                        />
                      </label>

                      <button
                        onClick={() => setShowUploadMenu(false)}
                        className="flex items-center space-x-3 w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-gray-500"
                      >
                        <span className="text-lg">❌</span>
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Text input */}
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={
                      typing
                        ? "Gemini AI is responding..."
                        : user
                        ? `Hi ${user.name}! Ask me about meals for your ${user.purpose.toLowerCase()} goal...`
                        : "Type your mood or meal query..."
                    }
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none transition-all ${
                      typing
                        ? "border-orange-200 bg-orange-50 focus:ring-orange-300 cursor-not-allowed"
                        : "border-gray-200 bg-white focus:ring-orange-500 hover:border-orange-300"
                    }`}
                    disabled={typing || isProcessingImage}
                    rows="1"
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                  />

                  {typing && (
                    <div className="absolute inset-0 bg-orange-50 bg-opacity-80 rounded-xl flex items-center justify-center">
                      <div className="flex items-center space-x-2 text-orange-600">
                        <div className="w-3 h-3 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
                        <span className="text-xs font-medium">AI is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 🔊 TTS toggle */}
                <button
                  onClick={() => {
                    setTtsEnabled((v) => !v);
                    stopSpeaking();
                  }}
                  disabled={typing || isProcessingImage}
                  title={ttsEnabled ? "Voice reply ON" : "Voice reply OFF"}
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                    ttsEnabled ? "bg-green-200 hover:bg-green-300" : "bg-gray-200 hover:bg-gray-300"
                  }`}
                >
                  🔊
                </button>

                {/* 🎙️ Voice (STT + tone emotion) */}
                <button
                  onClick={toggleVoice}
                  disabled={typing || isProcessingImage}
                  title={recording || listening ? "Stop listening" : "Speak your request"}
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                    recording || listening
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-gray-200 hover:bg-orange-200"
                  }`}
                >
                  🎙️
                </button>

                {/* Send button */}
                <button
                  onClick={sendMessage}
                  disabled={typing || !input.trim() || isProcessingImage}
                  className={`flex items-center justify-center w-10 h-10 text-white rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    typing
                      ? "bg-gray-400 animate-pulse"
                      : "bg-gradient-to-r from-orange-500 to-green-500 hover:from-orange-600 hover:to-green-600 hover:scale-110"
                  }`}
                  title={typing ? "Sending..." : "Send message"}
                >
                  {typing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-lg">📤</span>
                  )}
                </button>
              </div>

              {/* Status indicators */}
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <div className="flex items-center space-x-4">
                  {isProcessingImage && (
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                      <span>Processing image...</span>
                    </span>
                  )}
                  {typing && (
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span>Responding.....</span>
                    </span>
                  )}
                  {(recording || listening) && (
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      <span>Listening… speak now</span>
                    </span>
                  )}
                </div>

                {showImageConfirm && (
                  <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border p-4">
                      <div className="text-lg font-semibold mb-2">Confirm image upload</div>
                      <div className="text-sm text-gray-600 mb-3">
                        Add a note so I respond exactly the way you want (optional).
                      </div>

                      {pendingImagePreview && (
                        <img
                          src={pendingImagePreview}
                          alt="Preview"
                          className="w-full rounded-xl border mb-3"
                          style={{ maxHeight: "240px", objectFit: "cover" }}
                        />
                      )}

                      <textarea
                        value={imageUserComment}
                        onChange={(e) => setImageUserComment(e.target.value)}
                        placeholder="Example: Suggest a high-protein dinner using these. Avoid peanuts."
                        className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        rows={3}
                        disabled={isProcessingImage || typing}
                      />

                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          onClick={cancelImageUpload}
                          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
                          disabled={isProcessingImage || typing}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmImageUpload}
                          className="px-4 py-2 rounded-xl text-white bg-gradient-to-r from-orange-500 to-green-500 hover:from-orange-600 hover:to-green-600"
                          disabled={!pendingImageFile || isProcessingImage || typing}
                        >
                          Upload
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="text-right">
                  <span>Press Enter to send • Shift+Enter for new line</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default Chatbot;
