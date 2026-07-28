export const API_BASE_URL = (import.meta.env.VITE_MEAL_API_URL || "/api/meal-planner").replace(/\/$/, "");

const TOKEN_KEY = "mealPlannerToken";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => token && localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function authFetch(input, options = {}) {
  const url = /^https?:\/\//.test(input) || input.startsWith(API_BASE_URL)
    ? input
    : `${API_BASE_URL}${input.startsWith("/") ? "" : "/"}${input}`;
  const headers = new Headers(options.headers || {});
  const careToken = localStorage.getItem("access_token");
  if (careToken) headers.set("Authorization", `Bearer ${careToken}`);

  const response = await fetch(url, { ...options, headers });
  return response;
}

export async function createCareConnectMealSession() {
  const careToken = localStorage.getItem("access_token");
  if (!careToken) throw new Error("CareConnect login is required");
  const response = await fetch(`${API_BASE_URL}/careconnect/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${careToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Unable to start Meal Planner");
  clearToken();
  localStorage.setItem("mealPlannerUser", JSON.stringify(data.user));
  return data;
}

export default authFetch;
