const assert = require("assert");

const baseUrl = process.env.OTTERFIT_BASE_URL || "http://localhost:8788";
const today = new Date().toISOString().slice(0, 10);
const username = `Smoke${Date.now()}`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

async function postJson(path, payload) {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function expectMealText(mealText, expected) {
  const { response, body } = await postJson("/api/analyze-meal", { mealText });
  assert.strictEqual(response.status, 200, `${mealText} should return 200`);
  assert.strictEqual(body.calories, expected.calories, `${mealText} calories`);
  assert.strictEqual(body.total_calories, expected.calories, `${mealText} total_calories`);
  assert.strictEqual(body.provider, "local_text_fast", `${mealText} provider`);
  assert.ok(body.name && body.detectedFood, `${mealText} should include visible food names`);
  return body;
}

async function expectPhotoTextAssist(mealText, expected) {
  const { response, body } = await postJson("/api/analyze-meal", {
    mealText,
    imageData: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
    scenario: "餐前完整餐點估算",
  });
  assert.strictEqual(response.status, 200, `${mealText} photo text assist should return 200`);
  assert.strictEqual(body.calories, expected.calories, `${mealText} photo text assist calories`);
  assert.strictEqual(body.total_calories, expected.calories, `${mealText} photo text assist total_calories`);
  assert.strictEqual(body.provider, "local_text_fast", `${mealText} photo text assist provider`);
  assert.ok(body.detectedFood && !/照片餐點|餐點估算|食物名稱|unknown/i.test(body.detectedFood), `${mealText} should not use generic detected food`);
  return body;
}

async function expectPhotoAfterFallback(mealText, expected) {
  const { response, body } = await postJson("/api/analyze-meal", {
    mealText,
    imageData: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
    scenario: "\u9910\u5f8c\u5269\u9918\u91cf\u4f30\u7b97",
  });
  assert.strictEqual(response.status, 200, `${mealText} after photo fallback should return 200`);
  assert.strictEqual(body.calories, expected.calories, `${mealText} after photo fallback calories`);
  assert.notStrictEqual(body.provider, "local_text_fast", `${mealText} after photo must not use first-photo fast text provider`);
  assert.ok(/fallback|error|timeout|no_ai|invalid|gemini|openai|local/i.test(String(body.provider || "")), `${mealText} after photo should preserve provider/fallback source`);
  assert.ok(body.detectedFood && !/\u7167\u7247\u9910\u9ede|\u9910\u9ede\u4f30\u7b97|\u98df\u7269\u540d\u7a31|unknown/i.test(body.detectedFood), `${mealText} after photo fallback should keep visible food name`);
  return body;
}

async function main() {
  const home = await request("/");
  assert.strictEqual(home.response.status, 200, "home page should load");

  const profile = {
    heightCm: 166,
    weightKg: 58.5,
    calorieTarget: 1680,
    goal: "healthy",
    onboardingDone: true,
  };
  const savedProfile = await postJson("/api/user-profile", { username, profile });
  assert.strictEqual(savedProfile.response.status, 200, "profile save");
  const loadedProfile = await request(`/api/user-profile?username=${encodeURIComponent(username)}`);
  assert.strictEqual(loadedProfile.body.profile.weightKg, 58.5, "profile weight persists");
  assert.strictEqual(loadedProfile.body.profile.goal, "healthy", "healthy eating goal persists");
  assert.strictEqual(loadedProfile.body.profile.onboardingDone, true, "onboarding persists");

  await expectMealText("\u51ac\u74dc\u6e6f", { calories: 90 });
  await expectMealText("\u97d3\u5f0f\u6ce1\u83dc\u6e6f", { calories: 430 });
  await expectMealText("\u53ef\u6a02", { calories: 140 });
  await expectMealText("\u5473\u564c\u6e6f", { calories: 150 });
  await expectMealText("\u96de\u6e6f", { calories: 260 });
  await expectMealText("\u7092\u98ef", { calories: 720 });
  await expectPhotoTextAssist("\u7167\u7247\u88e1\u662f\u53ef\u6a02", { calories: 140 });
  await expectPhotoAfterFallback("\u53ef\u6a02", { calories: 140 });
  await expectMealText("\u96f6\u5361\u53ef\u6a02", { calories: 0 });
  await expectMealText("\u5564\u9152\u3001\u6ab8\u6aac\u7247", { calories: 150 });
  await expectMealText("\u53ef\u6a02\u7f50", { calories: 140 });
  await expectMealText("\u96de\u817f\u4fbf\u7576", { calories: 760 });
  await expectMealText("\u7092\u98ef", { calories: 720 });
  await expectPhotoTextAssist("\u53ef\u6a02\u7f50", { calories: 140 });
  await expectPhotoTextAssist("\u5564\u9152\u3001\u6ab8\u6aac\u7247", { calories: 150 });
  await expectPhotoTextAssist("\u97d3\u5f0f\u6ce1\u83dc\u6e6f", { calories: 430 });

  const meal = {
    id: `meal-${Date.now()}`,
    date: today,
    mealSlot: "\u665a\u9910",
    phase: "after",
    name: "\u6ce1\u83dc\u6e6f\u6821\u6b63\u9910",
    calories: 430,
    protein: 22,
    carbs: 28,
    fat: 24,
    fiber: 4,
    sugar: 7,
    sodium: 1500,
    photoBefore: "data:image/jpeg;base64,before",
    photoAfter: "data:image/jpeg;base64,after",
    beforeCalories: 520,
    afterCalories: 90,
    consumedCalories: 430,
    consumedRatio: 0.827,
    remainingRatio: 0.173,
    comparisonReliable: true,
    comparisonNote: "before/after smoke test",
    placeName: "\u5854\u5854\u5c0f\u98df\u5802",
    placeAddress: "\u53f0\u5317\u8eca\u7ad9\u9644\u8fd1",
    locationLatitude: 25.04776,
    locationLongitude: 121.51703,
    locationAccuracy: 42,
    locationCapturedAt: "2026-06-12T10:00:00.000Z",
    locationSource: "browser_geolocation",
    placeRating: 4,
    placeNote: "\u4e0b\u6b21\u6e6f\u5e95\u5c11\u559d",
    mealPlan: {
      id: `decision-${Date.now()}`,
      route: "tata_decision",
      routeLabel: "\u5854\u5854\u6700\u7a69",
      foodName: "\u96de\u80f8\u9b5a\u8c46\u8150\u534a\u98ef\u9752\u83dc",
      focus: "\u88dc\u86cb\u767d\u8cea",
      targetKcal: 520,
      mealSlot: "\u665a\u9910",
      time: "18:00-19:30",
      body: "\u4eca\u5929\u5148\u628a\u86cb\u767d\u8cea\u88dc\u8d77\u4f86\uff0c\u98ef\u524d\u62cd\u7167\u6821\u6b63\u4efd\u91cf\u3002",
      decisionDetail: {
        why: "\u6700\u7a69\u5148\u8655\u7406\uff1a\u88dc\u86cb\u767d\u8cea\u3002\u86cb\u767d\u8cea\u5dee 18g",
        photoCheck: "\u8089\u3001\u86cb\u3001\u8c46\u8150\u5927\u5c0f\u662f\u4e0d\u662f\u4e00\u638c\u5fc3",
        next: "\u76ee\u6a19\u7d04 520 kcal\uff0c\u5403\u524d\u62cd\u7167\u5f8c\u518d\u6821\u6b63\u3002",
      },
    },
    items: [{ name: "\u97d3\u5f0f\u6ce1\u83dc\u6e6f", portion: "\u7d04 1 \u4efd", calories: 430 }],
  };
  const savedMeal = await postJson("/api/user-meals", { username, date: today, meal });
  assert.strictEqual(savedMeal.response.status, 200, "meal save");
  const loadedMeals = await request(`/api/user-meals?username=${encodeURIComponent(username)}&date=${today}`);
  const storedMeal = loadedMeals.body.meals.find((entry) => entry.id === meal.id);
  assert.ok(storedMeal, "meal should be stored");
  assert.ok(storedMeal.photoBefore && storedMeal.photoAfter, "before/after photos should persist");
  assert.strictEqual(storedMeal.consumedCalories, 430, "consumed calories should persist");
  assert.strictEqual(storedMeal.comparisonReliable, true, "comparison reliability should persist");
  assert.strictEqual(storedMeal.placeName, "\u5854\u5854\u5c0f\u98df\u5802", "place name should persist");
  assert.strictEqual(storedMeal.placeAddress, "\u53f0\u5317\u8eca\u7ad9\u9644\u8fd1", "place address should persist");
  assert.strictEqual(storedMeal.locationLatitude, 25.04776, "location latitude should persist");
  assert.strictEqual(storedMeal.locationLongitude, 121.51703, "location longitude should persist");
  assert.strictEqual(storedMeal.locationSource, "browser_geolocation", "location source should persist");
  assert.strictEqual(storedMeal.placeRating, 4, "place rating should persist");
  assert.strictEqual(storedMeal.placeNote, "\u4e0b\u6b21\u6e6f\u5e95\u5c11\u559d", "place note should persist");
  assert.strictEqual(storedMeal.mealPlan.route, "tata_decision", "meal plan route should persist");
  assert.strictEqual(storedMeal.mealPlan.routeLabel, "\u5854\u5854\u6700\u7a69", "meal plan route label should persist");
  assert.strictEqual(storedMeal.mealPlan.foodName, "\u96de\u80f8\u9b5a\u8c46\u8150\u534a\u98ef\u9752\u83dc", "meal plan food name should persist");
  assert.strictEqual(storedMeal.mealPlan.targetKcal, 520, "meal plan target kcal should persist");
  assert.strictEqual(storedMeal.mealPlan.decisionDetail.why, "\u6700\u7a69\u5148\u8655\u7406\uff1a\u88dc\u86cb\u767d\u8cea\u3002\u86cb\u767d\u8cea\u5dee 18g", "decision reason should persist");
  assert.strictEqual(storedMeal.mealPlan.decisionDetail.photoCheck, "\u8089\u3001\u86cb\u3001\u8c46\u8150\u5927\u5c0f\u662f\u4e0d\u662f\u4e00\u638c\u5fc3", "decision photo check should persist");
  assert.strictEqual(storedMeal.mealPlan.decisionDetail.next, "\u76ee\u6a19\u7d04 520 kcal\uff0c\u5403\u524d\u62cd\u7167\u5f8c\u518d\u6821\u6b63\u3002", "decision next step should persist");
  const loadedMealDates = await request(`/api/user-meal-dates?username=${encodeURIComponent(username)}&limit=5`);
  assert.strictEqual(loadedMealDates.response.status, 200, "meal dates list");
  const dateSummary = loadedMealDates.body.dates.find((entry) => entry.date === today);
  assert.ok(dateSummary, "meal dates should include today");
  assert.strictEqual(dateSummary.mealCount, 1, "meal date count");
  assert.strictEqual(dateSummary.photoCount, 2, "meal date photo count");
  assert.strictEqual(dateSummary.calories, 430, "meal date calories");

  const dailyState = {
    waterMl: 1750,
    steps: 6543,
    weightKg: 58.5,
    sleepHours: 7.5,
    bowelState: "normal",
    energyState: "good",
    dailyScore: 76,
    otterStage: 3,
    totalScore: 120,
    streakDays: 4,
    lastActive: today,
  };
  const savedState = await postJson("/api/user-daily-state", { username, date: today, state: dailyState });
  assert.strictEqual(savedState.response.status, 200, "daily state save");
  const loadedState = await request(`/api/user-daily-state?username=${encodeURIComponent(username)}&date=${today}`);
  assert.strictEqual(loadedState.body.state.waterMl, 1750, "water persists");
  assert.strictEqual(loadedState.body.state.steps, 6543, "steps persist");
  assert.strictEqual(loadedState.body.state.sleepHours, 7.5, "sleep persists");
  assert.strictEqual(loadedState.body.state.bowelState, "normal", "bowel state persists");
  assert.strictEqual(loadedState.body.state.energyState, "good", "energy state persists");
  assert.strictEqual(loadedState.body.state.otterStage, 3, "otter stage persists");
  const stateWithDifferentDailyWeight = {
    ...dailyState,
    weightKg: 63.2,
  };
  const savedStateWithDifferentDailyWeight = await postJson("/api/user-daily-state", { username, date: today, state: stateWithDifferentDailyWeight });
  assert.strictEqual(savedStateWithDifferentDailyWeight.response.status, 200, "daily state with dated weight save");
  const profileAfterDailyWeight = await request(`/api/user-profile?username=${encodeURIComponent(username)}`);
  assert.strictEqual(profileAfterDailyWeight.body.profile.weightKg, 58.5, "dated daily weight must not overwrite account profile weight");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    username,
    checked: [
      "home",
      "profile persistence",
      "text calorie estimates",
      "before/after meal photo persistence",
      "meal plan decision detail persistence",
      "after-photo does not use first-photo fast text provider",
      "recent memory date summaries",
      "daily water/steps/TATA state persistence",
      "daily sleep/bowel/energy persistence",
      "daily weight does not reset account profile",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, baseUrl, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
