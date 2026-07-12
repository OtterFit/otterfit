const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function createElement(id = "") {
  return {
    id,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    innerHTML: "",
    innerText: "",
    textContent: "",
    value: "",
    addEventListener() {},
    querySelector() { return createElement(); },
    querySelectorAll() { return []; },
    scrollIntoView() {}
  };
}

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); this[key] = String(value); },
  removeItem(key) { storage.delete(key); delete this[key]; },
  key(index) { return [...storage.keys()][index] || null; },
  get length() { return storage.size; }
};

const elements = new Map();
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement(id));
    return elements.get(id);
  },
  querySelector() { return createElement(); },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement: () => createElement()
};

const sandbox = {
  console,
  localStorage,
  document,
  window: {},
  navigator: { serviceWorker: null },
  caches: { keys: async () => [], delete: async () => true },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  setTimeout,
  clearTimeout,
  addEventListener() {},
  removeEventListener() {},
  Date,
  Math,
  JSON,
  Number,
  String,
  Boolean,
  Array,
  Object,
  RegExp,
  Map,
  Set,
  Intl
};
sandbox.window = sandbox;
Object.defineProperty(sandbox, "location", { value: { origin: "http://localhost:8788", pathname: "/" } });

const appSource = fs.readFileSync("app.js", "utf8");
const testSource = `
currentUser = "v209p3";
userData = {
  username: "v209p3",
  currentHeight: 170,
  currentWeight: 68,
  targetCalories: 1800,
  selectedTone: "slim",
  consumedCalories: 0,
  totalProtein: 0,
  totalFiber: 0,
  waterMl: 900,
  currentSteps: 3200,
  dietRecords: [],
  streakDays: 0
};

function seedMeal(daysAgo, meal) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const key = todayKeyDate(date);
  const current = safeJsonArray(localStorage.getItem('paipachi:v209p3:meals:' + key));
  current.push({
    id: meal.id || ('meal_' + daysAgo + '_' + current.length),
    time: meal.time || "12:10",
    mealSlot: meal.mealSlot || "午餐",
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs || 70,
    fat: meal.fat || 18,
    fiber: meal.fiber || 6,
    sugar: meal.sugar || 0,
    sodium: meal.sodium || 900,
    placeName: meal.placeName || "",
    createdAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 10).toISOString()
  });
  localStorage.setItem('paipachi:v209p3:meals:' + key, JSON.stringify(current));
}

for (let i = 0; i < 7; i++) {
  seedMeal(i, { name: i === 1 ? "牛肉麵" : "外食便當", calories: 620 + i * 10, protein: i < 4 ? 32 : 54, fiber: 8, placeName: "測試店" + i });
}
localStorage.setItem(mealHistoryKey(), JSON.stringify([
  { id: "bad_1", dateKey: todayKeyDate(), name: "餐點", calories: 0, food: "餐點" },
  normalizeMealHistoryEntry({ id: "good_1", name: "雞腿便當", calories: 650, protein: 36, fiber: 7, createdAt: new Date().toISOString() }, todayKeyDate())
]));
const cleaned = cleanMealHistoryStore();
rebuildMealHistoryFromDailyStores();
loadDailyStores();
const status = getNutritionStatus();
const historyLine = getP3HistoryContextLine(status);
const morning = new Date(); morning.setHours(8, 30, 0, 0);
const noon = new Date(); noon.setHours(12, 0, 0, 0);
const evening = new Date(); evening.setHours(18, 30, 0, 0);
const morningGreeting = getP3ProactiveGreeting(morning, status);
const noonGreeting = getP3ProactiveGreeting(noon, status);
const eveningGreeting = getP3ProactiveGreeting(evening, status);
const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
const yesterdayKey = todayKeyDate(yesterday);
localStorage.setItem('paipachi:v209p3:meals:' + yesterdayKey, JSON.stringify([{ id: "bad_lunch", mealSlot: "午餐", name: "餐點", calories: 300, protein: 10, createdAt: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 12, 0).toISOString() }]));
const noonFallbackGreeting = getP3ProactiveGreeting(noon, status);
renderNutritionSummary();
renderP3WeeklyReportCard();
globalThis.__v209Result = {
  cleanedCount: cleaned.length,
  cleanedHasBad: cleaned.some(item => item.name === "餐點" || item.calories === 0),
  proteinNow: status.proteinNow,
  fiberNow: status.fiberNow,
  historyLine,
  morningGreeting,
  noonGreeting,
  eveningGreeting,
  noonFallbackGreeting,
  nutritionAdvice: document.getElementById("dailyNutritionAdvice").innerText,
  weeklyHtml: document.getElementById("p3WeeklyReportCard").innerHTML
};
`;

vm.runInNewContext(`${appSource}\n${testSource}`, sandbox, { filename: "app.js" });
const result = sandbox.__v209Result;

assert.ok(result.cleanedCount >= 1, "valid mealHistory entries should remain");
assert.strictEqual(result.cleanedHasBad, false, "invalid mealHistory entries should be removed");
assert.ok(result.proteinNow > 0, "nutrition status should read stored meals");
assert.ok(result.fiberNow > 0, "fiber status should read stored meals");
assert.ok(result.historyLine.length > 8, "history context should include time-aware wording");
assert.notStrictEqual(result.morningGreeting, result.noonGreeting, "morning and noon greetings should differ");
assert.notStrictEqual(result.noonGreeting, result.eveningGreeting, "noon and evening greetings should differ");
assert.ok(!result.noonFallbackGreeting.includes("昨天午餐吃了 餐點"), "noon fallback should not mention invalid meal name");
assert.ok(result.nutritionAdvice.length > 20 && String(result.nutritionAdvice).includes(String(result.proteinNow)), "nutrition advice should show synced intake");
assert.ok(result.weeklyHtml.length > 50, "weekly report should render after 7 active days");

console.log("v209 P3 coach smoke passed", result);
