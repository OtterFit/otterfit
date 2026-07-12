const assert = require("assert");
const { chromium } = require("playwright");

const baseUrl = process.env.OTTERFIT_BASE_URL || "http://localhost:8788";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    currentUser = "v207polish";
    localStorage.setItem("otterfit:currentUser", currentUser);
    userData.onboardCompleted = true;
    userData.selectedTone = "healthy";
    userData.targetCalories = 1800;
    userData.dietRecords = [];
    userData.consumedCalories = 0;
    userData.totalProtein = 0;
    userData.totalFiber = 0;
    document.getElementById("loginOverlay")?.style.setProperty("display", "none");
    document.getElementById("onboardOverlay")?.style.setProperty("display", "none");
    enterMainApplication();
  });

  const slots = await page.evaluate(() => ({
    breakfast: getMealSlot(new Date("2026-06-15T10:29:00")),
    lunchStart: getMealSlot(new Date("2026-06-15T10:30:00")),
    lunchEnd: getMealSlot(new Date("2026-06-15T14:30:00")),
    snack: getMealSlot(new Date("2026-06-15T14:31:00")),
    dinner: getMealSlot(new Date("2026-06-15T17:00:00")),
    late: getMealSlot(new Date("2026-06-15T22:00:00"))
  }));
  assert.deepStrictEqual(slots, {
    breakfast: "早餐",
    lunchStart: "午餐",
    lunchEnd: "午餐",
    snack: "點心",
    dinner: "晚餐",
    late: "宵夜"
  });

  const scoreState = await page.evaluate(() => {
    switchTabById("tab-photo");
    selectedMeal = {
      name: "滷肉飯",
      calories: 520,
      protein: 16,
      carbs: 72,
      fat: 18,
      fiber: 2,
      sugar: 6,
      sodium: 720,
      source: "local_food_database",
      confidence: "medium",
      phase: "before",
      items: [{ name: "滷肉飯", portion: "約 1 碗", calories: 520, protein: 16, carbs: 72, fat: 18, fiber: 2 }]
    };
    selectedPortion = 1;
    applySelectedMealToUI();
    const badgeScore = Number(document.querySelector(".p2-score-badge span")?.textContent || 0);
    const coachMatch = (document.getElementById("immediateNutritionCoachCard")?.textContent || "").match(/(\d+)\/100/);
    return {
      p2: getP2MealScore(),
      badgeScore,
      coachScore: coachMatch ? Number(coachMatch[1]) : 0
    };
  });
  assert.strictEqual(scoreState.badgeScore, scoreState.p2, "P2 badge should use unified score");
  assert.strictEqual(scoreState.coachScore, scoreState.p2, "nutrition coach should use unified score");

  const blocked = await page.evaluate(() => {
    selectedMeal = { name: "", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, source: "manual", phase: "before" };
    selectedMealName = "";
    selectedMealKcal = 0;
    const before = safeJsonArray(localStorage.getItem(dailyKey("meals"))).length;
    const result = confirmAndStoreMeal();
    const after = safeJsonArray(localStorage.getItem(dailyKey("meals"))).length;
    return {
      result,
      before,
      after,
      toast: document.getElementById("achievementToast")?.textContent || ""
    };
  });
  assert.strictEqual(blocked.before, blocked.after, "invalid 0 kcal meal should not be saved");
  assert.strictEqual(blocked.result, false, "invalid save should return false");
  assert.ok(/食物名稱|0 kcal|估算/.test(blocked.toast), "invalid save should show a helpful toast");

  await browser.close();
  console.log(JSON.stringify({ ok: true, baseUrl, slots, scoreState, blocked }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, baseUrl, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
