import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ChefHat,
  Clock,
  Heart,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Utensils,
  X,
} from "lucide-react";
import Chatbot from "./Chatbot";
import CycleDashboard from "./CycleDashboard";
import CycleLogger from "./CycleLogger";
import CyclePhaseBadge from "./CyclePhaseBadge";
import UserDashboard from "./UserDashboard";
import UserMealPlans from "./UserMealPlans";
import {
  API_BASE_URL,
  authFetch,
  createCareConnectMealSession,
} from "./services/api";

const MOODS = [
  ["energetic", "⚡", "Energetic"],
  ["comfort", "🤗", "Comfort"],
  ["healthy", "🥗", "Healthy"],
  ["indulgent", "🍰", "Indulgent"],
  ["fresh", "🌿", "Fresh"],
  ["spicy", "🌶️", "Spicy"],
];

const DIETS = ["Any", "vegetarian", "vegan", "gluten-free", "keto-friendly", "high-protein", "low-carb", "dairy-free", "paleo", "mediterranean"];
const CUISINES = ["Any", "Italian", "Asian", "Mexican", "Indian", "American", "Mediterranean", "French", "Thai", "Japanese", "Greek", "Chinese"];
const COMMON_INGREDIENTS = ["Chicken", "Eggs", "Rice", "Pasta", "Tomatoes", "Spinach", "Broccoli", "Quinoa", "Salmon", "Lentils", "Potatoes", "Avocado"];
const COMMON_ALLERGIES = ["Peanuts", "Milk", "Eggs", "Fish", "Tree Nuts", "Shellfish", "Soy", "Wheat", "Sesame"];
const MEAL_LABELS = { breakfast: "🌅 Breakfast", lunch: "🥗 Lunch", dinner: "🍽️ Dinner", snack: "🍎 Snack" };

const ChipInput = ({ value, onChange, suggestions, placeholder, tone = "green" }) => {
  const [text, setText] = useState("");
  const add = (item) => {
    const clean = String(item || "").trim();
    if (clean && !value.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
      onChange([...value, clean]);
    }
    setText("");
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(text);
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-orange-400"
        />
        <button type="button" onClick={() => add(text)} className="rounded-lg bg-orange-500 px-3 text-white hover:bg-orange-600">
          <Plus size={18} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button
            type="button"
            key={item}
            disabled={value.includes(item)}
            onClick={() => add(item)}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-40"
          >
            {item}
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((item) => (
            <span key={item} className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${tone === "red" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
              {item}
              <button type="button" onClick={() => onChange(value.filter((entry) => entry !== item))} aria-label={`Remove ${item}`}>
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const MealCard = ({ type, meal, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(meal)}
    className="w-full rounded-xl border border-orange-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <p className="text-sm font-semibold text-orange-700">{MEAL_LABELS[type]}</p>
    <h4 className="mt-1 text-lg font-bold text-gray-800">{meal.name}</h4>
    <p className="mt-2 text-sm text-gray-500">{meal.calories} cal • {meal.prep_time} min</p>
  </button>
);

const RecipeModal = ({ meal, onClose }) => {
  if (!meal) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-orange-600">{meal.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{meal.calories} calories • {meal.prep_time} minutes</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-gray-100"><X /></button>
        </div>
        <h4 className="mt-6 font-bold text-gray-800">Ingredients</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
          {(meal.ingredients || []).map((item) => <li key={item}>{item}</li>)}
        </ul>
        <h4 className="mt-6 font-bold text-gray-800">Instructions</h4>
        <p className="mt-2 whitespace-pre-wrap text-gray-700">{Array.isArray(meal.instructions) ? meal.instructions.join("\n") : meal.instructions}</p>
      </div>
    </div>
  );
};

const MealPlanner = ({ careConnectUser }) => {
  const [user, setUser] = useState(null);
  const [careContext, setCareContext] = useState(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");
  const [mood, setMood] = useState("healthy");
  const [diet, setDiet] = useState("Any");
  const [cuisine, setCuisine] = useState("Any");
  const [ingredients, setIngredients] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [plan, setPlan] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showCycle, setShowCycle] = useState(false);
  const [showCycleLogger, setShowCycleLogger] = useState(false);
  const [cycleData, setCycleData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [review, setReview] = useState({ content: "", rating: 5, photo: null });
  const [reviewing, setReviewing] = useState(false);
  const imageInput = useRef(null);
  const chatRef = useRef(null);

  const allergyStorageKey = useMemo(() => `careconnect:meal-allergies:${careConnectUser?.email || "patient"}`, [careConnectUser?.email]);

  const loadCycle = useCallback(async (mealUser) => {
    if (!mealUser?.id) return;
    try {
      const response = await authFetch(`${API_BASE_URL}/users/cycle/${mealUser.id}`);
      if (response.ok) setCycleData(await response.json());
    } catch (requestError) {
      console.warn("Cycle data unavailable", requestError);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/reviews`);
      if (response.ok) setReviews(await response.json());
    } catch (requestError) {
      console.warn("Reviews unavailable", requestError);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setBooting(true);
        const session = await createCareConnectMealSession();
        if (!active) return;
        setUser(session.user);
        setCareContext(session.care_context);
        setShowProfile(!Boolean(session.user.profile_completed));
        const savedAllergies = JSON.parse(localStorage.getItem(allergyStorageKey) || "[]");
        setAllergies(Array.isArray(savedAllergies) ? savedAllergies : []);
        await Promise.all([loadCycle(session.user), loadReviews()]);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => { active = false; };
  }, [allergyStorageKey, loadCycle, loadReviews]);

  useEffect(() => {
    localStorage.setItem(allergyStorageKey, JSON.stringify(allergies));
  }, [allergies, allergyStorageKey]);

  const detectIngredients = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setDetecting(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await authFetch(`${API_BASE_URL}/detect-ingredients`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ingredient detection failed");
      setIngredients((current) => [...new Set([...current, ...(data.ingredients || [])])]);
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setDetecting(false);
    }
  };

  const generatePlan = async () => {
    setGenerating(true);
    setError("");
    try {
      let menstrualData = null;
      if (user?.sex === "Female" && user?.track_menstrual_cycle) {
        const cycleResponse = await authFetch(`${API_BASE_URL}/cycle-info/${user.id}`);
        if (cycleResponse.ok) menstrualData = await cycleResponse.json();
      }
      const response = await authFetch(`${API_BASE_URL}/generate-ai-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          dietary: diet === "Any" ? "any" : diet,
          cuisine: cuisine === "Any" ? "any" : cuisine,
          available_ingredients: ingredients,
          allergies,
          menstrualData,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Meal generation failed");
      setPlan(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setGenerating(false);
    }
  };

  const savePlan = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/save-meal-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: user.email,
          mealPlanName: saveName || `${mood} Meal Plan`,
          moodContext: plan.mood_context,
          breakfast: plan.breakfast,
          lunch: plan.lunch,
          dinner: plan.dinner,
          snack: plan.snack,
          totalCalories: plan.total_calories,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the meal plan");
      setShowSave(false);
      setSaveName("");
      alert("Meal plan saved");
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewing(true);
    try {
      const formData = new FormData();
      formData.append("content", review.content);
      formData.append("rating", review.rating);
      if (review.photo) formData.append("photo", review.photo);
      const response = await authFetch(`${API_BASE_URL}/reviews`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save review");
      setReviews((current) => [data, ...current]);
      setReview({ content: "", rating: 5, photo: null });
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setReviewing(false);
    }
  };

  const deleteReview = async (id) => {
    if (!window.confirm("Delete this review?")) return;
    const response = await authFetch(`${API_BASE_URL}/reviews/${id}`, { method: "DELETE" });
    if (response.ok) setReviews((current) => current.filter((item) => item.id !== id));
  };

  if (booting) {
    return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={42} /></div>;
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="font-bold">Meal Planner could not start</h2>
        <p className="mt-2">{error || "Confirm that the Meal Planner API is running and shares the CareConnect JWT secret."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-orange-500 to-emerald-600 p-6 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2"><ChefHat /><span className="font-semibold uppercase tracking-wide">CareConnect Meal Planner</span></div>
            <h2 className="mt-2 text-3xl font-bold">Mood-aware meals connected to your care profile</h2>
            <p className="mt-2 max-w-3xl text-orange-50">One login powers meal planning, ingredient recognition, cycle-aware guidance, saved plans, reviews, and the nutrition chatbot.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowProfile(true)} className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 hover:bg-white/25"><UserRound size={18} /> Profile</button>
            <button type="button" onClick={() => setShowPlans(true)} className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 hover:bg-white/25"><Heart size={18} /> Saved plans</button>
            {user.sex === "Female" && <button type="button" onClick={() => setShowCycle(true)} className="rounded-lg bg-white/15 px-4 py-2 hover:bg-white/25">Cycle dashboard</button>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1">Status: {careContext?.health_status || "not specified"}</span>
          <span className="rounded-full bg-white/15 px-3 py-1">Active prescriptions: {careContext?.active_prescription_count || 0}</span>
          <span className="rounded-full bg-white/15 px-3 py-1">Recent records: {careContext?.recent_record_count || 0}</span>
          <CyclePhaseBadge cycleData={cycleData} onClick={() => setShowCycle(true)} />
        </div>
      </section>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertTriangle className="mt-0.5" />{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div>
            <h3 className="font-bold text-gray-800">1. Current mood</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {MOODS.map(([id, emoji, label]) => (
                <button type="button" key={id} onClick={() => setMood(id)} className={`rounded-lg border p-3 text-left ${mood === id ? "border-orange-500 bg-orange-50 text-orange-800" : "border-gray-200 hover:border-orange-200"}`}>
                  <span className="mr-2">{emoji}</span>{label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-gray-800">2. Dietary preference</h3>
            <select value={diet} onChange={(event) => setDiet(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2">
              {DIETS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <h3 className="font-bold text-gray-800">3. Cuisine</h3>
            <select value={cuisine} onChange={(event) => setCuisine(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2">
              {CUISINES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <button type="button" onClick={generatePlan} disabled={generating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-60">
            {generating ? <Loader2 className="animate-spin" /> : <Sparkles />} {generating ? "Generating..." : "Generate meal plan"}
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><h3 className="font-bold text-gray-800">Available ingredients</h3><button type="button" onClick={() => imageInput.current?.click()} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"><Camera size={17} />{detecting ? "Detecting..." : "Scan photo"}</button></div>
              <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={detectIngredients} />
              <div className="mt-4"><ChipInput value={ingredients} onChange={setIngredients} suggestions={COMMON_INGREDIENTS} placeholder="Add an ingredient" /></div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-gray-800">Food allergies</h3>
              <p className="mt-1 text-xs text-gray-500">These are always excluded from generated meals.</p>
              <div className="mt-4"><ChipInput value={allergies} onChange={setAllergies} suggestions={COMMON_ALLERGIES} placeholder="Add an allergy" tone="red" /></div>
            </div>
          </div>

          {!plan ? (
            <div className="rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-12 text-center">
              <Utensils className="mx-auto text-orange-400" size={52} />
              <h3 className="mt-4 text-xl font-bold text-gray-800">Your personalized plan will appear here</h3>
              <p className="mt-2 text-gray-600">The plan uses mood, preferences, ingredients, cycle data, and the limited CareConnect context available to you.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div><p className="text-sm font-semibold uppercase text-orange-600">{plan.mood_context} plan</p><h3 className="text-2xl font-bold text-gray-800">{plan.total_calories} estimated calories</h3></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={generatePlan} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2"><RefreshCw size={17} /> New plan</button>
                    <button type="button" onClick={() => setShowSave(true)} className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white"><Save size={17} /> Save</button>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {Object.keys(MEAL_LABELS).map((type) => plan[type] && <MealCard key={type} type={type} meal={plan[type]} onOpen={setSelectedMeal} />)}
                </div>
              </div>
              {plan.warnings?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <h4 className="font-bold">Safety reminders</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between"><div><h3 className="text-xl font-bold text-gray-800">Community reviews</h3><p className="text-sm text-gray-500">Share how the planner worked for you.</p></div><Star className="text-orange-400" /></div>
        <form onSubmit={submitReview} className="mt-5 grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <textarea required value={review.content} onChange={(event) => setReview((current) => ({ ...current, content: event.target.value }))} placeholder="Write a review" rows={2} className="rounded-lg border border-gray-200 px-3 py-2" />
          <select value={review.rating} onChange={(event) => setReview((current) => ({ ...current, rating: Number(event.target.value) }))} className="rounded-lg border border-gray-200 px-3 py-2">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}</select>
          <div className="flex gap-2"><label className="flex cursor-pointer items-center rounded-lg border border-gray-200 px-3"><Camera size={18} /><input type="file" accept="image/*" className="hidden" onChange={(event) => setReview((current) => ({ ...current, photo: event.target.files?.[0] || null }))} /></label><button disabled={reviewing} className="rounded-lg bg-orange-500 px-5 font-semibold text-white disabled:opacity-60">{reviewing ? "Saving" : "Post"}</button></div>
        </form>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews.slice(0, 9).map((item) => (
            <article key={item.id} className="rounded-xl border border-gray-100 p-4">
              {item.photo_url && <img src={item.photo_url} alt="Review" className="mb-3 h-36 w-full rounded-lg object-cover" />}
              <div className="flex justify-between gap-2"><div><p className="font-bold text-gray-800">{item.name}</p><p className="text-sm text-orange-500">{"★".repeat(item.rating)}</p></div>{Number(item.user_id) === Number(user.id) && <button type="button" onClick={() => deleteReview(item.id)} className="text-red-500"><Trash2 size={17} /></button>}</div>
              <p className="mt-3 text-sm text-gray-600">{item.content}</p>
            </article>
          ))}
        </div>
      </section>

      <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">Meal plans are general wellness suggestions. They do not replace medical advice, a prescribed diet, or medication guidance.</p>

      <RecipeModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      {showSave && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSave(false)}><div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(event) => event.stopPropagation()}><h3 className="text-xl font-bold">Save meal plan</h3><input autoFocus value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder={`${mood} Meal Plan`} className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2" /><div className="mt-4 flex gap-3"><button type="button" onClick={() => setShowSave(false)} className="flex-1 rounded-lg bg-gray-100 py-2">Cancel</button><button type="button" onClick={savePlan} disabled={saving} className="flex-1 rounded-lg bg-purple-600 py-2 text-white">{saving ? "Saving..." : "Save"}</button></div></div></div>}
      {showProfile && <UserDashboard user={user} onClose={() => setShowProfile(false)} onUserUpdate={(updated) => { setUser(updated); localStorage.setItem("mealPlannerUser", JSON.stringify(updated)); }} />}
      {showPlans && <UserMealPlans user={user} onClose={() => setShowPlans(false)} />}
      {showCycle && <CycleDashboard user={user} cycleData={cycleData} onClose={() => setShowCycle(false)} onUpdateCycle={(updated) => setCycleData(updated)} onOpenLogger={() => { setShowCycle(false); setShowCycleLogger(true); }} />}
      {showCycleLogger && <CycleLogger user={user} cycleData={cycleData} onClose={() => setShowCycleLogger(false)} onLogSaved={() => loadCycle(user)} />}
      <Chatbot ref={chatRef} user={user} />
    </div>
  );
};

export default MealPlanner;
