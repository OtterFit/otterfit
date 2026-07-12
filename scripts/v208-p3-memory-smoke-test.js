const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function createElement(id = "") {
  return {
    id,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
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
  setItem(key, value) {
    storage.set(key, String(value));
    this[key] = String(value);
  },
  removeItem(key) {
    storage.delete(key);
    delete this[key];
  },
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
currentUser = "v208p3";
userData = {
  username: "v208p3",
  currentHeight: 170,
  currentWeight: 68,
  targetCalories: 1800,
  selectedTone: "slim",
  consumedCalories: 0,
  totalProtein: 0,
  totalFiber: 0,
  waterMl: 800,
  currentSteps: 3200,
  dietRecords: [],
  streakDays: 0
};
const saved = saveMeal({
  name: "雞腿便當",
  calories: 720,
  protein: 38,
  carbs: 82,
  fat: 24,
  fiber: 6,
  sodium: 1150,
  photoBefore: "data:image/jpeg;base64,thumb",
  mealSlot: "午餐",
  source: "test"
});
const firstHistory = getMealHistory();
const updated = updateSavedMeal(saved.id, {
  ...saved,
  photoAfter: "data:image/jpeg;base64,after",
  calories: 690,
  protein: 40,
  consumedCalories: 690,
  source: "ai_before_after"
});
const secondHistory = getMealHistory();
localStorage.removeItem(mealHistoryKey());
const rebuilt = getMealHistory();
const summaries = buildLocalMemoryDateSummaries(3);
const weekly = getP3WeeklyMealInsight(getNutritionStatus());
renderTataProactiveCoachCard(getNutritionStatus());
globalThis.__v208Result = {
  savedId: saved.id,
  historyCount: firstHistory.length,
  firstName: firstHistory[0]?.name,
  firstCalories: firstHistory[0]?.calories,
  thumbnail: firstHistory[0]?.thumbnail,
  updatedCalories: secondHistory.find(item => item.id === saved.id)?.calories,
  updatedAfter: secondHistory.find(item => item.id === saved.id)?.hasAfterPhoto,
  rebuiltCount: rebuilt.length,
  summaryCount: summaries.length,
  weeklyTitle: weekly.title,
  coachText: document.getElementById("tataProactiveCoachCard").innerHTML
};
`;

vm.runInNewContext(`${appSource}\n${testSource}`, sandbox, { filename: "app.js" });
const result = sandbox.__v208Result;

assert.strictEqual(result.historyCount, 1, "mealHistory should receive saved meal");
assert.strictEqual(result.firstName, "雞腿便當", "history should keep food name");
assert.strictEqual(result.firstCalories, 720, "history should keep calories");
assert.ok(result.thumbnail.includes("thumb"), "history should keep lightweight thumbnail");
assert.strictEqual(result.updatedCalories, 690, "history should update corrected calories");
assert.strictEqual(result.updatedAfter, true, "history should mark after photo");
assert.ok(result.rebuiltCount >= 1, "history should rebuild from daily stores");
assert.ok(result.summaryCount >= 1, "date summaries should use mealHistory");
assert.ok(result.weeklyTitle, "weekly insight should have title");
assert.ok(result.coachText.includes("主動教練提醒"), "coach card should render clean Chinese title");
assert.ok(result.coachText.includes("下一步"), "coach card should include proactive next step");

console.log("v208 P3 memory smoke passed", result);
