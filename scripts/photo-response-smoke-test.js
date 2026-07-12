const assert = require("assert");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = process.env.OTTERFIT_BASE_URL || "http://localhost:8788";
const photoPath = path.resolve(__dirname, "..", "icon-192.png");

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource|ERR_NETWORK_ACCESS_DENIED|ERR_NAME_NOT_RESOLVED|favicon/i.test(text)) return;
    errors.push(text);
  });

  await page.route("**/api/analyze-meal", async route => {
    await new Promise(resolve => setTimeout(resolve, 9000));
    await route.fulfill({
      status: 504,
      contentType: "application/json",
      body: JSON.stringify({ error: "slow test response" })
    });
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    currentUser = "photoresponse";
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
    document.getElementById("mainAppContainer")?.style.setProperty("display", "block");
    document.getElementById("bottomNav")?.style.setProperty("display", "grid");
    updateUI(false);
  });

  await page.setInputFiles("#photoAlbumInput", photoPath);

  const received = await page.waitForFunction(() => {
    const state = {
      visible: document.getElementById("estimateResult")?.style.display === "block",
      trust: document.getElementById("estimateTrustLine")?.textContent || "",
      name: document.getElementById("mealName")?.textContent || ""
    };
    return state.visible && /照片已收到|照片讀取|分析/.test(state.trust + state.name) ? state : false;
  }, null, { timeout: 1200 }).then(handle => handle.jsonValue());
  assert.strictEqual(received.visible, true, "selecting a photo should show the estimate result immediately");
  assert.ok(/照片已收到|照片讀取|分析/.test(received.trust + received.name), "photo flow should show received/loading feedback");

  const fallback = await page.waitForFunction(() => {
    const state = {
      source: selectedMeal?.source || "",
      selectedName: selectedMeal?.name || "",
      databaseSize: typeof getTaiwanFoodDatabase === "function" ? getTaiwanFoodDatabase().length : 0,
      calories: Number(document.getElementById("estCalories")?.textContent || 0),
      protein: Number(document.getElementById("estProtein")?.textContent || 0),
      carbs: Number(document.getElementById("estCarbs")?.textContent || 0),
      fat: Number(document.getElementById("estFat")?.textContent || 0),
      photoVisible: document.getElementById("mealPhoto")?.style.display === "block",
      recognitionVisible: document.getElementById("foodRecognitionSummaryCard")?.classList.contains("active") || false,
      recognitionText: document.getElementById("foodRecognitionSummaryCard")?.textContent || "",
      advancedOpen: document.querySelector(".estimate-advanced-details")?.open || false,
      saveStatus: document.getElementById("estimateSaveStatusCard")?.classList.contains("active") || false,
      coach: document.getElementById("immediateNutritionCoachCard")?.classList.contains("active") || false,
      p2Summary: document.getElementById("p2ResultSummaryCard")?.classList.contains("active") || false,
      p2Progress: document.querySelectorAll("#p2MacroProgressCard .p2-macro-row").length,
      p2CoachText: document.getElementById("p2TataCoachCard")?.textContent || "",
      saveButton: document.getElementById("confirmMealBtn")?.textContent || ""
    };
    return state.source === "local_photo_quick_fallback" ? state : false;
  }, null, { timeout: 6500 }).then(async handle => {
    let state = await handle.jsonValue();
    if (state.source !== "local_photo_quick_fallback") {
      state = await page.waitForFunction(() => ({
        source: selectedMeal?.source || "",
        selectedName: selectedMeal?.name || "",
        databaseSize: typeof getTaiwanFoodDatabase === "function" ? getTaiwanFoodDatabase().length : 0,
        calories: Number(document.getElementById("estCalories")?.textContent || 0),
        protein: Number(document.getElementById("estProtein")?.textContent || 0),
        carbs: Number(document.getElementById("estCarbs")?.textContent || 0),
        fat: Number(document.getElementById("estFat")?.textContent || 0),
        photoVisible: document.getElementById("mealPhoto")?.style.display === "block",
        recognitionVisible: document.getElementById("foodRecognitionSummaryCard")?.classList.contains("active") || false,
        recognitionText: document.getElementById("foodRecognitionSummaryCard")?.textContent || "",
        advancedOpen: document.querySelector(".estimate-advanced-details")?.open || false,
        saveStatus: document.getElementById("estimateSaveStatusCard")?.classList.contains("active") || false,
        coach: document.getElementById("immediateNutritionCoachCard")?.classList.contains("active") || false,
        p2Summary: document.getElementById("p2ResultSummaryCard")?.classList.contains("active") || false,
        p2Progress: document.querySelectorAll("#p2MacroProgressCard .p2-macro-row").length,
        p2CoachText: document.getElementById("p2TataCoachCard")?.textContent || "",
        saveButton: document.getElementById("confirmMealBtn")?.textContent || ""
      }), null, { timeout: 6500 }).then(next => next.jsonValue());
    }
    return state;
  });

  assert.strictEqual(fallback.source, "local_photo_quick_fallback", "slow AI should produce quick local photo fallback");
  assert.ok(fallback.databaseSize >= 200, `local food database should include at least 200 foods, got ${fallback.databaseSize}`);
  assert.ok(!/\.(jpg|jpeg|png|webp|heic)|test_food|icon-192/i.test(fallback.selectedName), `fallback should not expose file names, got ${fallback.selectedName}`);
  assert.ok(fallback.calories > 0, "quick fallback should show calories");
  assert.ok(fallback.protein > 0 && fallback.carbs > 0 && fallback.fat > 0, "quick fallback should show non-zero macro nutrients");
  assert.strictEqual(fallback.photoVisible, true, "selected photo should stay visible");
  assert.strictEqual(fallback.recognitionVisible, true, "food recognition summary should be visible without opening advanced details");
  assert.strictEqual(fallback.advancedOpen, false, "advanced details should remain collapsed by default");
  assert.ok(/食物名稱|份量|主要食材/.test(fallback.recognitionText), "recognition summary should show food name, portion, and ingredients");
  assert.strictEqual(fallback.saveStatus, true, "quick fallback should show save status");
  assert.strictEqual(fallback.coach, true, "quick fallback should show nutrition coach");
  assert.strictEqual(fallback.p2Summary, true, "P2 result summary should be visible");
  assert.strictEqual(fallback.p2Progress, 5, "P2 macro progress should include calories, protein, carbs, fat, and fiber");
  assert.ok(/優點：|不足：|下一餐：|本機估算/.test(fallback.p2CoachText), "P2 coach card should show nutritionist advice and estimate source");
  assert.strictEqual(fallback.saveButton, "儲存這餐", "P2 result card should expose one-tap meal save");
  const autoDraft = await page.evaluate(() => {
    const draft = getAutoMealRecordDraft();
    return {
      exists: Boolean(draft),
      status: draft?.status || "",
      score: Number(draft?.nutritionCoach?.score || 0),
      good: draft?.nutritionCoach?.good || "",
      gap: draft?.nutritionCoach?.gap || "",
      nextAdvice: draft?.nextAdvice || "",
      recognition: draft?.recognitionSummary || null,
      formal: Boolean(draft?.isFormalRecord)
    };
  });
  assert.strictEqual(autoDraft.exists, true, "photo estimate should auto-save a meal record draft");
  assert.ok(autoDraft.score > 0, "auto meal draft should keep nutritionist score");
  assert.ok(autoDraft.good, "auto meal draft should keep meal strength");
  assert.ok(autoDraft.gap, "auto meal draft should keep meal gap");
  assert.ok(autoDraft.nextAdvice, "auto meal draft should keep next-meal advice");
  assert.ok(autoDraft.recognition?.mainFood, "auto meal draft should keep recognized food name");
  assert.ok(autoDraft.recognition?.portion, "auto meal draft should keep recognized portion");
  assert.ok(autoDraft.recognition?.ingredients, "auto meal draft should keep recognized ingredients");
  assert.strictEqual(autoDraft.formal, false, "auto meal draft should not duplicate formal records");

  await page.click("#confirmMealBtn");
  await page.waitForTimeout(250);
  const saved = await page.evaluate(() => ({
    resultVisible: document.getElementById("estimateResult")?.style.display === "block",
    meals: Array.isArray(userData.dietRecords) ? userData.dietRecords.length : 0,
    calories: Number(userData.consumedCalories || 0),
    storedMeals: JSON.parse(localStorage.getItem(dailyKey("meals")) || "[]").length,
    ledgerText: document.getElementById("todayMealLedger")?.textContent || "",
    summaryText: document.getElementById("homeTodaySummaryCard")?.textContent || ""
  }));
  assert.strictEqual(saved.resultVisible, false, "saving should collapse the result card");
  assert.ok(saved.meals >= 1, "saving should add the meal to today's records");
  assert.ok(saved.storedMeals >= 1, "saving should persist the meal to localStorage");
  assert.ok(saved.calories > 0, "saving should update today's calories");
  assert.ok(saved.summaryText.includes(String(saved.meals)) && saved.summaryText.includes(String(saved.calories)), "home summary should update after saving");
  assert.ok(/今天吃了什麼|蛋白質|纖維|kcal/.test(saved.ledgerText), "today meal ledger should show saved meal details");

  await page.evaluate(() => {
    const firstMeal = userData.dietRecords[0];
    if (firstMeal?.id) deleteTodayMeal(firstMeal.id);
  });
  await page.waitForTimeout(250);
  const deleted = await page.evaluate(() => ({
    meals: Array.isArray(userData.dietRecords) ? userData.dietRecords.length : 0,
    storedMeals: JSON.parse(localStorage.getItem(dailyKey("meals")) || "[]").length,
    summaryText: document.getElementById("homeTodaySummaryCard")?.textContent || ""
  }));
  assert.strictEqual(deleted.meals, 0, "deleting from ledger should update in-memory meal records");
  assert.strictEqual(deleted.storedMeals, 0, "deleting from ledger should update localStorage");
  assert.deepStrictEqual(errors, [], `photo response smoke should have no page errors: ${errors.join("; ")}`);

  await browser.close();
  console.log(JSON.stringify({ ok: true, baseUrl, received, fallback, autoDraft, saved, deleted }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, baseUrl, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
