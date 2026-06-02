const todayKey = new Date().toISOString().slice(0, 10);

const testerAccounts = {
  lynn: { label: "Lynn", password: "Toma2026!" },
  leia: { label: "Leia", password: "Toma2026!" },
  andrew: { label: "Andrew", password: "Toma2026!" },
  sally: { label: "Sally", password: "Toma2026!" },
};

const defaultSettings = {
  profileName: "",
  purpose: "瘦身",
  allergies: [],
  onboarded: true,
  dailyTarget: 1800,
  proteinTarget: 90,
  startWeight: 80,
  targetWeight: 72,
  heightCm: 170,
  age: 40,
  sex: "male",
  activity: 1.375,
  stepTarget: 8000,
  deadline: nextDate(90),
};

const foodProfiles = [
  { keys: ["雞", "便當", "排骨", "炸"], label: "便當/炸物", calories: 760, protein: 36, carbs: 88, fat: 28 },
  { keys: ["拉麵", "麵", "ramen"], label: "麵食/拉麵", calories: 760, protein: 32, carbs: 92, fat: 26 },
  { keys: ["沙拉", "雞胸", "舒肥"], label: "高蛋白輕食", calories: 430, protein: 34, carbs: 28, fat: 18 },
  { keys: ["拿鐵", "奶茶", "飲料", "咖啡"], label: "飲料", calories: 240, protein: 7, carbs: 32, fat: 8 },
  { keys: ["飯", "丼", "咖哩", "炒飯"], label: "飯類/丼飯", calories: 720, protein: 28, carbs: 98, fat: 24 },
  { keys: ["蛋糕", "甜點", "麵包"], label: "甜點", calories: 380, protein: 7, carbs: 50, fat: 17 },
  { keys: ["火鍋", "鍋"], label: "火鍋", calories: 820, protein: 42, carbs: 44, fat: 48 },
  { keys: ["壽司", "生魚片", "sushi"], label: "壽司/生魚片", calories: 520, protein: 30, carbs: 72, fat: 12 },
  { keys: ["唐揚"], label: "唐揚雞", calories: 520, protein: 30, carbs: 28, fat: 32 },
  { keys: ["飯糰"], label: "便利商店飯糰", calories: 210, protein: 6, carbs: 38, fat: 4 },
  { keys: ["天婦羅", "tempura"], label: "天婦羅", calories: 620, protein: 24, carbs: 58, fat: 32 },
  { keys: ["章魚燒"], label: "章魚燒", calories: 430, protein: 16, carbs: 52, fat: 18 },
  { keys: ["蝦", "蟹", "海鮮"], label: "海鮮", calories: 360, protein: 32, carbs: 16, fat: 16 },
];

const adjustmentRules = [
  { keys: ["半碗飯", "飯半碗", "少飯"], calories: -140, carbs: -32, note: "少飯" },
  { keys: ["不喝湯", "湯不喝"], calories: -80, fat: -5, note: "不喝湯" },
  { keys: ["去皮", "少油"], calories: -90, fat: -8, note: "少油/去皮" },
  { keys: ["無糖"], calories: -120, carbs: -28, note: "無糖" },
  { keys: ["加飯", "大碗", "加麵"], calories: 220, carbs: 48, note: "澱粉加量" },
  { keys: ["起司", "奶油", "美乃滋"], calories: 140, fat: 12, note: "高脂醬料" },
];

const courseTemplates = [
  { name: "前菜沙拉", icon: "🥗", calories: 180, protein: 6, carbs: 14, fat: 10 },
  { name: "暖胃湯品", icon: "🥣", calories: 160, protein: 8, carbs: 18, fat: 6 },
  { name: "美味主餐", icon: "🥩", calories: 420, protein: 32, carbs: 28, fat: 22 },
  { name: "精緻甜點", icon: "🍰", calories: 320, protein: 6, carbs: 42, fat: 14 },
  { name: "餐後飲品", icon: "☕", calories: 120, protein: 4, carbs: 16, fat: 4 },
];

function activeTesterId() {
  return localStorage.getItem("tomaActiveTester") || "";
}

function scopedKey(key) {
  const testerId = activeTesterId();
  return testerId ? `${testerId}:${key}` : key;
}

function testerStorageKey(accountId = activeTesterId()) {
  const account = testerAccounts[accountId];
  return `otterfit_user_${account?.label || accountId || "guest"}`;
}

function readTesterProfile(accountId = activeTesterId()) {
  try {
    return JSON.parse(localStorage.getItem(testerStorageKey(accountId))) || {};
  } catch {
    return {};
  }
}

function writeTesterProfile(accountId = activeTesterId(), patch = {}) {
  if (!accountId) return;
  const current = readTesterProfile(accountId);
  localStorage.setItem(testerStorageKey(accountId), JSON.stringify({ ...current, ...patch }));
}

function needsOnboarding() {
  const testerId = activeTesterId();
  return Boolean(testerId) && readTesterProfile(testerId).onboardCompleted !== true;
}

const tomaTapLines = [
  "嗯，我有在聽。今天不用猛烈，只要穩穩變強。",
  "看起來在耍廢，其實是在蓄力。再記一餐就很好。",
  "你先呼吸一下，我幫你把節奏顧著。",
  "水獺主張：舒服地前進，也算很認真。",
  "今天的你不用完美，只要不要消失就很厲害。",
];

const state = {
  meals: read("biteBeamMeals", read("calLensMeals", [])),
  weights: read("biteBeamWeights", read("calLensWeights", [])),
  steps: read("biteBeamSteps", []),
  settings: { ...defaultSettings, ...read("biteBeamSettings", read("calLensSettings", {})) },
  currentEstimate: null,
  currentPhotoData: "",
  currentAfterPhotoData: "",
  isEstimating: false,
  lastApiStatus: "",
  courseSession: read("tomaCourseSession", { courses: [], snapped: false }),
  chartRange: 7,
  selectedDate: todayKey,
  undoClearMeals: null,
  undoClearTimer: null,
  achievementTimer: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const els = {
  testerLogin: $("#testerLogin"),
  testerLoginForm: $("#testerLoginForm"),
  testerAccount: $("#testerAccount"),
  testerPassword: $("#testerPassword"),
  testerLoginStatus: $("#testerLoginStatus"),
  onboarding: $("#onboarding"),
  onboardingForm: $("#onboardingForm"),
  quickStart: $("#quickStart"),
  profileName: $("#profileName"),
  profilePurpose: $("#profilePurpose"),
  onboardHeight: $("#onboardHeight"),
  onboardWeight: $("#onboardWeight"),
  onboardAge: $("#onboardAge"),
  onboardSex: $("#onboardSex"),
  onboardTargetWeight: $("#onboardTargetWeight"),
  onboardDeadline: $("#onboardDeadline"),
  allergies: $("#allergies"),
  dailyCheckin: $("#dailyCheckin"),
  dailyCheckinForm: $("#dailyCheckinForm"),
  quickWeight: $("#quickWeight"),
  dailyGreeting: $("#dailyGreeting"),
  skipCheckin: $("#skipCheckin"),
  encourageBox: $("#encourageBox"),
  editProfile: $("#editProfile"),
  switchTester: $("#switchTester"),
  userGreeting: $("#userGreeting"),
  mealImage: $("#mealImage"),
  previewImage: $("#previewImage"),
  uploadZone: $(".upload-zone"),
  afterMealImage: $("#afterMealImage"),
  afterPreviewImage: $("#afterPreviewImage"),
  afterZone: $(".after-zone"),
  mealText: $("#mealText"),
  portion: $("#portion"),
  mealType: $("#mealType"),
  mealScenario: $("#mealScenario"),
  estimateButton: $("#estimateButton"),
  aiResult: $("#aiResult"),
  estimatedCalories: $("#estimatedCalories"),
  foodLabel: $("#foodLabel"),
  proteinResult: $("#proteinResult"),
  carbResult: $("#carbResult"),
  fatResult: $("#fatResult"),
  detectedList: $("#detectedList"),
  allergyAlert: $("#allergyAlert"),
  estimateNote: $("#estimateNote"),
  nextMealResult: $("#nextMealResult"),
  actualCard: $("#actualCard"),
  actualNote: $("#actualNote"),
  photoCalorieBadge: $("#photoCalorieBadge"),
  photoCalories: $("#photoCalories"),
  actualCalorieBadge: $("#actualCalorieBadge"),
  actualCalories: $("#actualCalories"),
  resultPop: $("#resultPop"),
  popPhotoFrame: $("#popPhotoFrame"),
  popMealPhoto: $("#popMealPhoto"),
  popCalories: $("#popCalories"),
  popFoodLabel: $("#popFoodLabel"),
  popApiStatus: $("#popApiStatus"),
  popFoodItems: $("#popFoodItems"),
  popNextMeal: $("#popNextMeal"),
  actionHints: $("#actionHints"),
  saveMealFromPop: $("#saveMealFromPop"),
  closeResultPop: $("#closeResultPop"),
  mealForm: $("#mealForm"),
  mealList: $("#mealList"),
  clearToday: $("#clearToday"),
  todayMeals: $("#todayMeals"),
  dailyTarget: $("#dailyTarget"),
  proteinTarget: $("#proteinTarget"),
  heightCm: $("#heightCm"),
  startWeight: $("#startWeight"),
  age: $("#age"),
  sex: $("#sex"),
  activity: $("#activity"),
  targetWeight: $("#targetWeight"),
  deadline: $("#deadline"),
  recommendedCalories: $("#recommendedCalories"),
  bmiExplain: $("#bmiExplain"),
  applySuggestedCalories: $("#applySuggestedCalories"),
  settingsForm: $("#settingsForm"),
  remainingCalories: $("#remainingCalories"),
  todayCalories: $("#todayCalories"),
  todayProtein: $("#todayProtein"),
  bmiText: $("#bmiText"),
  weightProgress: $("#weightProgress"),
  coachAdvice: $("#coachAdvice"),
  riskBadge: $("#riskBadge"),
  ringProgress: $(".ring-progress"),
  calorieChart: $("#calorieChart"),
  avgCalories: $("#avgCalories"),
  bestDay: $("#bestDay"),
  loggedDays: $("#loggedDays"),
  proteinGoalText: $("#proteinGoalText"),
  calorieGoalText: $("#calorieGoalText"),
  weightForm: $("#weightForm"),
  todayWeight: $("#todayWeight"),
  stepsForm: $("#stepsForm"),
  todaySteps: $("#todaySteps"),
  stepTarget: $("#stepTarget"),
  stepsStatus: $("#stepsStatus"),
  weightList: $("#weightList"),
  currentWeightText: $("#currentWeightText"),
  targetWeightText: $("#targetWeightText"),
  goalProgressBar: $("#goalProgressBar"),
  goalAdvice: $("#goalAdvice"),
  planCard: $("#planCard"),
  planContent: $("#planContent"),
  autoMealType: $("#autoMealType"),
  autoPortion: $("#autoPortion"),
  autoTime: $("#autoTime"),
  scanLayout: $(".scan-layout"),
  photoPrompt: $("#photoPrompt"),
  scanRemainingCalories: $("#scanRemainingCalories"),
  scanEatenCalories: $("#scanEatenCalories"),
  scanBurnedCalories: $("#scanBurnedCalories"),
  scanSteps: $("#scanSteps"),
  scanStepTarget: $("#scanStepTarget"),
  scanStepBar: $("#scanStepBar"),
  dateStrip: $("#dateStrip"),
  activeDateLabel: $("#activeDateLabel"),
  geminiForm: $("#geminiForm"),
  geminiPrompt: $("#geminiPrompt"),
  geminiOutput: $("#geminiOutput"),
  tomaBubble: $("#tomaBubble"),
  tomaCoach: $("#tomaCoach"),
  sparklineChart: $("#sparklineChart"),
  cameraCoachCTA: $("#cameraCoachCTA"),
  mobileEstimateCTA: $("#mobileEstimateCTA"),
  finalComboCTA: $("#finalComboCTA"),
  courseTimeline: $("#courseTimeline"),
  courseCount: $("#courseCount"),
  cameraModal: $("#cameraModal"),
  cameraModalText: $("#cameraModalText"),
  closeCameraModal: $("#closeCameraModal"),
  simulateMealScan: $("#simulateMealScan"),
  scanProgress: $("#scanProgress"),
  scanProgressBar: $("#scanProgressBar"),
  scanLine: $("#scanLine"),
  realUploadFromModal: $("#realUploadFromModal"),
  achievementPop: $("#achievementPop"),
  achievementTitle: $("#achievementTitle"),
  achievementBadge: $("#achievementBadge"),
  achievementText: $("#achievementText"),
  closeAchievement: $("#closeAchievement"),
};

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(key))) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(scopedKey(key), JSON.stringify(value));
  } catch {
    alert("手機儲存空間可能不足，照片可改成只保留文字紀錄。");
  }
}

function nextDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseList(value) {
  return value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);
}

function guessMealType() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "早餐";
  if (hour >= 10 && hour < 14) return "午餐";
  if (hour >= 14 && hour < 17) return "點心";
  if (hour >= 17 && hour < 21) return "晚餐";
  return "點心";
}

function updateAutoDetectUI() {
  const portionLabel = els.portion.options[els.portion.selectedIndex]?.textContent || "一般";
  els.mealType.value = guessMealType();
  els.autoMealType.textContent = `餐別：${guessMealType()}`;
  els.autoPortion.textContent = `份量：${portionLabel}`;
  els.autoTime.textContent = `時間：${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
  $$(".portion-buttons button").forEach((button) => button.classList.toggle("active", button.dataset.portion === els.portion.value));
}

async function estimateMeal() {
  if (state.isEstimating) return;
  state.isEstimating = true;
  updateAutoDetectUI();
  setEstimateLoading(true);
  try {
    const text = els.mealText.value.trim();
    const hasPhoto = !els.previewImage.hidden;
    const sourceText = text || (hasPhoto ? "照片餐點" : "一般餐點");
    state.lastApiStatus = state.currentPhotoData
      ? "先顯示估算，獺獺正在背景辨識照片。"
      : "尚未拍照，先用一般餐點估算。";
    state.currentEstimate = buildLocalEstimate(sourceText, hasPhoto);
    renderEstimate();

    if (state.currentPhotoData) {
      const aiAnalysis = await analyzeMealWithApi({
        imageData: state.currentPhotoData,
        mealText: text,
        mealType: guessMealType(),
        scenario: els.mealScenario.value,
        portionLabel: els.portion.options[els.portion.selectedIndex]?.textContent || "一般",
      });
      if (aiAnalysis) {
        state.lastApiStatus = `AI 已辨識 ${aiAnalysis.items?.length || 1} 項食物，請確認明細後儲存。`;
        state.currentEstimate = buildEstimateFromAi(aiAnalysis, sourceText);
        renderEstimate();
      } else {
        renderEstimate();
      }
    }
  } finally {
    state.isEstimating = false;
    setEstimateLoading(false);
  }
}

window.estimateMealNow = estimateMeal;

function buildLocalEstimate(sourceText, hasPhoto) {
  const matched = foodProfiles.filter((item) => item.keys.some((key) => sourceText.includes(key)));
  const baseItems = matched.length ? matched : [{ label: hasPhoto ? "照片餐點" : "通用餐點", calories: hasPhoto ? 580 : 520, protein: hasPhoto ? 26 : 22, carbs: hasPhoto ? 66 : 58, fat: hasPhoto ? 22 : 20 }];
  const base = baseItems.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    protein: sum.protein + item.protein,
    carbs: sum.carbs + item.carbs,
    fat: sum.fat + item.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const adjustments = adjustmentRules.filter((rule) => rule.keys.some((key) => sourceText.includes(key)));
  adjustments.forEach((rule) => {
    base.calories += rule.calories || 0;
    base.protein += rule.protein || 0;
    base.carbs += rule.carbs || 0;
    base.fat += rule.fat || 0;
  });
  const divisor = matched.length > 1 ? 1.35 : 1;
  const portion = Number(els.portion.value);
  const detected = [...baseItems.map((item) => item.label), ...adjustments.map((item) => item.note)];
  const meal = {
    id: crypto.randomUUID(),
    date: activeDateKey(),
    time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
    type: guessMealType(),
    scenario: els.mealScenario.value,
    name: sourceText.slice(0, 34),
    description: sourceText,
    calories: Math.max(80, Math.round((base.calories / divisor) * portion)),
    protein: Math.max(0, Math.round((base.protein / divisor) * portion)),
    carbs: Math.max(0, Math.round((base.carbs / divisor) * portion)),
    fat: Math.max(0, Math.round((base.fat / divisor) * portion)),
    detected,
    allergyHits: findAllergyHits(sourceText, detected),
    photoData: state.currentPhotoData,
    afterPhotoData: state.currentAfterPhotoData,
  };
  meal.baseProtein = meal.protein;
  meal.baseCarbs = meal.carbs;
  meal.baseFat = meal.fat;
  return meal;
}

function setEstimateLoading(isLoading) {
  if (!els.estimateButton) return;
  els.estimateButton.disabled = isLoading;
  els.estimateButton.textContent = isLoading ? "獺獺正在辨識..." : "看這餐熱量";
}

async function analyzeMealWithApi(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("/api/analyze-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      state.lastApiStatus = friendlyApiError(body, response.status);
      return null;
    }
    state.lastApiStatus = "AI 辨識完成。";
    return body;
  } catch (error) {
    state.lastApiStatus = error?.name === "AbortError"
      ? "AI 辨識超過 10 秒，先用本機估算。你仍可儲存，之後再重拍。"
      : "AI 連線暫時失敗，先用本機估算。";
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function friendlyApiError(body, status) {
  if (body?.error === "missing_api_key") return "OpenAI API Key 還沒設定，現在先用本機估算。";
  if (body?.error === "missing_image") return "照片沒有成功送出，先用本機估算。";
  if (status === 401) return "API Key 無法使用，請重新確認 .env 裡的 OPENAI_API_KEY。";
  if (status === 429) return "OpenAI 額度或速率受限，先用本機估算。";
  if (status >= 500) return "AI 服務暫時不穩，先用本機估算。";
  return body?.message ? `AI 回傳錯誤：${body.message}` : "AI 暫時無法辨識，先用本機估算。";
}

function buildEstimateFromAi(analysis, sourceText) {
  const total = Math.max(0, Math.round(Number(analysis.total_kcal || 0)));
  const items = Array.isArray(analysis.items) && analysis.items.length
    ? analysis.items
    : [{ name: "照片餐點", kcal: total, confidence: analysis.confidence || 0.55 }];
  const detected = items.map((item) => String(item.name || "餐點"));
  const meal = {
    id: crypto.randomUUID(),
    date: activeDateKey(),
    time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
    type: guessMealType(),
    scenario: els.mealScenario.value,
    name: detected.join("、").slice(0, 34) || sourceText.slice(0, 34),
    description: sourceText,
    calories: total,
    protein: Math.max(0, Math.round(Number(analysis.protein_g || 0))),
    carbs: Math.max(0, Math.round(Number(analysis.carbs_g || 0))),
    fat: Math.max(0, Math.round(Number(analysis.fat_g || 0))),
    detected,
    allergyHits: findAllergyHits(sourceText, detected),
    photoData: state.currentPhotoData,
    afterPhotoData: state.currentAfterPhotoData,
    aiAdvice: analysis.advice || "",
    aiActionHints: Array.isArray(analysis.action_hints) ? analysis.action_hints : [],
    itemChoices: items.map((item) => ({
      label: String(item.name || "餐點"),
      calories: Math.max(0, Math.round(Number(item.kcal || 0))),
      selected: true,
      confidence: Number(item.confidence || analysis.confidence || 0.65),
    })),
  };
  meal.baseProtein = meal.protein;
  meal.baseCarbs = meal.carbs;
  meal.baseFat = meal.fat;
  return meal;
}

function findAllergyHits(text, detected) {
  const source = `${text} ${detected.join(" ")}`;
  return (state.settings.allergies || []).filter((item) => source.includes(item));
}

function renderEstimate() {
  const meal = state.currentEstimate;
  if (!meal) return;
  const futureTotals = addMealToTotals(todayTotals(), meal);
  const foodLabel = `辨識：${meal.detected.join("、")}`;
  els.aiResult.hidden = false;
  els.estimatedCalories.textContent = meal.calories;
  els.foodLabel.textContent = foodLabel;
  els.photoCalories.textContent = meal.calories;
  els.photoCalorieBadge.hidden = false;
  els.popPhotoFrame.hidden = !meal.photoData;
  if (meal.photoData) els.popMealPhoto.src = meal.photoData;
  els.popCalories.textContent = meal.calories;
  els.popFoodLabel.textContent = foodLabel;
  if (els.popApiStatus) {
    els.popApiStatus.hidden = !state.lastApiStatus;
    els.popApiStatus.textContent = state.lastApiStatus;
  }
  els.popFoodItems.innerHTML = buildFoodItemCards(meal);
  els.popNextMeal.textContent = meal.aiAdvice || buildMealActionAdvice(meal, futureTotals);
  const hints = meal.aiActionHints?.length ? meal.aiActionHints : buildActionHints(meal, futureTotals);
  els.actionHints.innerHTML = hints.map((hint) => `<span>${escapeHtml(hint)}</span>`).join("");
  els.resultPop.hidden = false;
  els.proteinResult.textContent = `${meal.protein}g`;
  els.carbResult.textContent = `${meal.carbs}g`;
  els.fatResult.textContent = `${meal.fat}g`;
  els.detectedList.innerHTML = meal.detected.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  els.allergyAlert.hidden = !meal.allergyHits.length;
  els.allergyAlert.textContent = meal.allergyHits.length ? `過敏提醒：這餐可能包含 ${meal.allergyHits.join("、")}，請先確認再吃。` : "";
  els.estimateNote.textContent = buildEstimateNote(meal, futureTotals);
  els.nextMealResult.textContent = meal.aiAdvice || buildMealActionAdvice(meal, futureTotals);
  renderActualIntake();
}

function buildFoodItemCards(meal) {
  const items = meal.detected.length ? meal.detected : ["照片餐點"];
  if (!meal.itemChoices || meal.itemChoices.length !== items.length) {
    const itemCalories = splitCalories(meal.calories, items.length);
    meal.itemChoices = items.map((item, index) => ({ label: item, calories: itemCalories[index], selected: true }));
  }
  return meal.itemChoices.map((item, index) => `
    <label class="pop-food-item">
      <input type="checkbox" data-food-index="${index}" ${item.selected ? "checked" : ""}>
      <span>${escapeHtml(item.label)}</span>
      <b>${item.calories} kcal</b>
    </label>
  `).join("");
}

function splitCalories(total, count) {
  if (count <= 1) return [total];
  const base = Math.floor(total / count);
  const values = Array.from({ length: count }, () => base);
  values[0] += total - base * count;
  return values;
}

function updateMealSelection() {
  const meal = state.currentEstimate;
  if (!meal?.itemChoices) return;
  let selectedCalories = 0;
  els.popFoodItems.querySelectorAll("input[data-food-index]").forEach((input) => {
    const item = meal.itemChoices[Number(input.dataset.foodIndex)];
    if (!item) return;
    item.selected = input.checked;
    if (item.selected) selectedCalories += item.calories;
  });
  const totalCalories = meal.itemChoices.reduce((sum, item) => sum + item.calories, 0) || meal.calories;
  const ratio = totalCalories ? selectedCalories / totalCalories : 1;
  meal.calories = Math.max(0, selectedCalories);
  meal.protein = Math.max(0, Math.round((meal.baseProtein ?? meal.protein) * ratio));
  meal.carbs = Math.max(0, Math.round((meal.baseCarbs ?? meal.carbs) * ratio));
  meal.fat = Math.max(0, Math.round((meal.baseFat ?? meal.fat) * ratio));
  meal.detected = meal.itemChoices.filter((item) => item.selected).map((item) => item.label);
  updateEstimateDisplays();
}

function updateEstimateDisplays() {
  const meal = state.currentEstimate;
  if (!meal) return;
  const futureTotals = addMealToTotals(todayTotals(), meal);
  const foodLabel = meal.detected.length ? `辨識：${meal.detected.join("、")}` : "辨識：未選擇餐食";
  els.estimatedCalories.textContent = meal.calories;
  els.foodLabel.textContent = foodLabel;
  els.photoCalories.textContent = meal.calories;
  els.popCalories.textContent = meal.calories;
  els.popFoodLabel.textContent = foodLabel;
  if (els.popApiStatus) {
    els.popApiStatus.hidden = !state.lastApiStatus;
    els.popApiStatus.textContent = state.lastApiStatus;
  }
  els.popNextMeal.textContent = meal.aiAdvice || buildMealActionAdvice(meal, futureTotals);
  els.proteinResult.textContent = `${meal.protein}g`;
  els.carbResult.textContent = `${meal.carbs}g`;
  els.fatResult.textContent = `${meal.fat}g`;
  els.detectedList.innerHTML = meal.detected.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  els.nextMealResult.textContent = meal.aiAdvice || buildMealActionAdvice(meal, futureTotals);
}

function renderActualIntake() {
  if (!state.currentEstimate || els.afterPreviewImage.hidden) {
    els.actualCard.hidden = true;
    els.actualCalorieBadge.hidden = true;
    return;
  }
  const leftoverRatio = estimateLeftoverRatio();
  const actual = Math.max(0, Math.round(state.currentEstimate.calories * (1 - leftoverRatio)));
  state.currentEstimate.actualCalories = actual;
  state.currentEstimate.afterPhotoData = state.currentAfterPhotoData;
  els.actualCalories.textContent = actual;
  els.actualCalorieBadge.hidden = false;
  els.actualCard.hidden = false;
  els.actualNote.textContent = `吃後照片估計約剩 ${Math.round(leftoverRatio * 100)}%，實際吃掉約 ${actual} kcal。加入紀錄時會用實吃熱量。`;
}

function estimateLeftoverRatio() {
  const text = els.mealText.value;
  if (text.includes("吃一半") || text.includes("剩一半")) return 0.5;
  if (text.includes("剩三分之一")) return 0.33;
  if (text.includes("剩很多")) return 0.65;
  if (text.includes("吃完") || text.includes("全吃")) return 0.05;
  return 0.25;
}

function buildEstimateNote(meal, futureTotals) {
  const range = buildCalorieRange(meal.calories);
  if (Number(state.settings.dailyTarget) - futureTotals.calories < 0) return `估算範圍約 ${range} kcal。這餐加入後會超過今日目標，不是不能吃，但下一餐要明顯清淡。`;
  if (meal.protein < 20 && meal.type !== "飲料") return `估算範圍約 ${range} kcal。這餐蛋白質偏低，減重期可能比較容易餓。`;
  if (meal.carbs > 85) return `估算範圍約 ${range} kcal。這餐碳水偏高，下一餐可以把飯麵減半。`;
  return `估算範圍約 ${range} kcal。份量、醬汁、油量會影響準度，確認後再加入紀錄。`;
}

function buildCalorieRange(calories) {
  const spread = Math.max(60, Math.round(calories * 0.15));
  const low = Math.max(0, calories - spread);
  const high = calories + spread;
  return `${low}-${high}`;
}

function buildMealActionAdvice(meal, futureTotals) {
  if (meal.scenario === "treat") return "這餐當放縱餐沒關係。今天不要再補甜飲，下一餐高蛋白 + 蔬菜，明天早餐清淡拉回節奏。";
  if (meal.scenario === "set") return "套餐可以吃，但主食半份、甜點二選一、飲料無糖。吃後再拍一次會更準。";
  if (meal.scenario === "counter") return "板前/無菜單建議每 2 到 3 道拍一次。少喝酒、醬汁適量，明天早餐清淡高蛋白。";
  if (meal.calories >= 900) return "這餐偏高。建議先減半，飯麵少一半、炸物留一半，調整後再拍一次。";
  if (meal.calories >= 700) return "這餐中高熱量。建議飯麵減半、醬汁另外放，飲料改無糖。";
  if (Number(state.settings.dailyTarget) - futureTotals.calories < 250) return "今天剩餘熱量不多。這餐可以吃，但下一餐要改清淡高蛋白。";
  if (meal.protein < 20 && meal.type !== "飲料") return "蛋白質偏少。可以加蛋、豆腐、魚或雞胸，會比較有飽足感。";
  return "這餐可以。照這個份量吃，下一餐維持蛋白質和蔬菜就好。";
}

function buildActionHints(meal, futureTotals) {
  if (meal.scenario === "treat") return ["不用補償性挨餓", "下一餐高蛋白 + 蔬菜", "明天早餐清淡", "今天多走 15 分鐘"];
  if (meal.scenario === "set") return ["主食半份", "甜點或飲料二選一", "吃後再拍校正實吃"];
  if (meal.scenario === "counter") return ["每 2 到 3 道拍一次", "酒精少量", "醬汁不要全沾", "明天早餐清淡高蛋白"];
  if (meal.calories >= 900) return ["先吃半份，剩下打包", "飯麵減半", "炸物或濃醬少一半", "調整後重新拍照"];
  if (meal.calories >= 700) return ["主食減半", "不要喝湯或醬汁", "飲料改無糖", "晚餐選魚/豆腐/沙拉"];
  if (Number(state.settings.dailyTarget) - futureTotals.calories < 250) return ["下一餐 300 kcal 內", "選雞胸/豆腐/茶碗蒸", "不加甜點和手搖"];
  return ["維持這份量", "先吃蛋白質和蔬菜", "醬汁另外放"];
}

async function saveCurrentMeal() {
  if (!state.currentEstimate) await estimateMeal();
  if (state.currentEstimate.actualCalories) {
    const ratio = state.currentEstimate.actualCalories / state.currentEstimate.calories;
    state.currentEstimate.calories = state.currentEstimate.actualCalories;
    state.currentEstimate.protein = Math.round(state.currentEstimate.protein * ratio);
    state.currentEstimate.carbs = Math.round(state.currentEstimate.carbs * ratio);
    state.currentEstimate.fat = Math.round(state.currentEstimate.fat * ratio);
  }
  state.meals.unshift(state.currentEstimate);
  write("biteBeamMeals", state.meals);
  resetMealCapture();
  render();
  activateTab("log");
}

async function addMeal(event) {
  event?.preventDefault();
  await saveCurrentMeal();
}

function resetMealCapture() {
  state.currentEstimate = null;
  state.currentPhotoData = "";
  state.currentAfterPhotoData = "";
  els.mealForm.reset();
  els.aiResult.hidden = true;
  els.previewImage.hidden = true;
  els.afterPreviewImage.hidden = true;
  els.photoCalorieBadge.hidden = true;
  els.actualCalorieBadge.hidden = true;
  els.resultPop.hidden = true;
  els.previewImage.removeAttribute("src");
  els.afterPreviewImage.removeAttribute("src");
  els.uploadZone.classList.remove("has-image");
  els.afterZone.classList.remove("has-image");
  els.scanLayout.classList.remove("show-preview", "show-after-preview");
  updateAutoDetectUI();
}

function todayMeals() {
  return state.meals.filter((meal) => meal.date === activeDateKey());
}

function todayTotals() {
  return todayMeals().reduce(addMealToTotals, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function getTodaySteps() {
  return state.steps.find((item) => item.date === activeDateKey())?.steps || 0;
}

function estimateStepCalories(steps = getTodaySteps()) {
  const weight = Number(getLatestWeight()?.weight || state.settings.startWeight || 70);
  return Math.round(steps * weight * 0.00048);
}

function addMealToTotals(sum, meal) {
  return {
    calories: sum.calories + meal.calories,
    protein: sum.protein + meal.protein,
    carbs: sum.carbs + meal.carbs,
    fat: sum.fat + meal.fat,
  };
}

function render() {
  renderDateStrip();
  renderDashboard();
  renderMeals();
  renderWeight();
  renderChart();
  renderSparkline();
  renderCourseSession();
  renderSettings();
  renderOnboarding();
  ensureOnboardingEnhancements();
  updateOnboardingLiveStats();
  renderDailyCheckin();
}

function activeDateKey() {
  return state.selectedDate || todayKey;
}

function renderDateStrip() {
  const base = new Date(`${todayKey}T00:00:00`);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + mondayOffset + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      weekday: weekdays[date.getDay()],
      day: date.getDate(),
      isToday: key === todayKey,
      isActive: key === activeDateKey(),
    };
  });
  els.dateStrip.innerHTML = days.map((item) => `
    <button class="date-pill ${item.isActive ? "active" : ""} ${item.isToday ? "today" : ""}" data-date="${item.key}" type="button">
      <small>${item.weekday}</small>
      <strong>${item.day}</strong>
    </button>
  `).join("");
  const selected = new Date(`${activeDateKey()}T00:00:00`);
  els.activeDateLabel.textContent = activeDateKey() === todayKey
    ? "今天"
    : selected.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });
}

function renderDashboard() {
  const totals = todayTotals();
  const target = Number(state.settings.dailyTarget);
  const burned = estimateStepCalories();
  const adjustedTarget = target + burned;
  const remaining = Math.max(adjustedTarget - totals.calories, 0);
  els.remainingCalories.textContent = remaining;
  updateStepBurnNote(burned);
  els.todayCalories.textContent = totals.calories;
  els.todayProtein.textContent = `${totals.protein}g`;
  els.bmiText.textContent = calculateBmiText();
  els.todayMeals.textContent = todayMeals().length;
  els.weightProgress.textContent = `${Math.round(calculateWeightProgress())}%`;
  els.ringProgress.style.strokeDashoffset = String(427 * (1 - Math.min(totals.calories / adjustedTarget, 1)));
  els.proteinGoalText.textContent = `${state.settings.proteinTarget}g`;
  els.calorieGoalText.textContent = state.settings.dailyTarget;
  renderScanBalance(totals, remaining, burned);
  els.userGreeting.textContent = state.settings.profileName ? `${state.settings.profileName} 的獺獺 OtterFit` : "獺獺 OtterFit";
  const advice = buildCoachAdvice(totals, target);
  els.coachAdvice.textContent = advice.text;
  els.riskBadge.textContent = advice.badge;
  els.riskBadge.style.background = advice.bg;
  els.riskBadge.style.color = advice.color;
  if (els.tomaBubble) els.tomaBubble.textContent = buildTomaBubble(totals, remaining);
  renderTomaEvolution();
}

function updateStepBurnNote(burned) {
  if (!els.remainingCalories) return;
  const ringCopy = els.remainingCalories.closest(".ring-copy");
  if (!ringCopy) return;
  let note = document.getElementById("stepBurnNote");
  if (!note) {
    note = document.createElement("small");
    note.id = "stepBurnNote";
    note.className = "step-burn-note";
    ringCopy.appendChild(note);
  }
  note.textContent = `已含今日步行消耗 +${burned} kcal`;
  note.classList.toggle("active", burned > 0);
}

function buildTomaBubble(totals, remaining) {
  const steps = getTodaySteps();
  if (remaining <= 0 && totals.calories > 0) return "看起來在耍廢？沒關係，補記散步步數，我帶你一起默默變強。";
  if (todayMeals().length === 0 && steps === 0) return "今天我們慢慢來就好。有記一餐，就已經很棒了。";
  if (todayMeals().length > 0 && steps === 0) return "我們已經建立初步記錄囉，獺獺覺得自己也變輕快了。";
  if (todayMeals().length > 0 && steps < 6000) return "今天的目標完成得不錯，下一步是讓身體動一下。";
  if (todayMeals().length > 0 && steps < 10000) return "我們最近的節奏很穩，今天只要守住關鍵目標就很好。";
  if (totals.protein < state.settings.proteinTarget * 0.5) return "蛋白質還差一點，下一餐補個魚、蛋或豆腐。";
  return "你真的把自己照顧得很好。你變好，獺獺也跟著變好。";
}

function renderTomaEvolution() {
  if (!els.tomaCoach) return;
  const totals = todayTotals();
  const steps = getTodaySteps();
  let stage = { level: 0, face: "🦦", name: "圓滾滾初心獺" };
  if (totals.calories > 0 && steps === 0) {
    stage = { level: 30, face: "🌅🦦", name: "微結實晨光獺" };
  } else if (totals.calories > 0 && steps > 0 && steps < 6000) {
    stage = { level: 60, face: "💪🦦", name: "結實活力獺" };
  } else if (totals.calories > 0 && steps >= 6000 && steps < 10000) {
    stage = { level: 80, face: "⚡🦦", name: "精實流線獺" };
  } else if (totals.calories > 0 && steps >= 10000) {
    stage = { level: 100, face: "👑🦦", name: "超精實水獺" };
  }
  const target = Number(state.settings.dailyTarget || defaultSettings.dailyTarget) + estimateStepCalories();
  if (totals.calories >= target && totals.calories > 0) {
    stage = { level: Math.max(stage.level, 30), face: "💦🦦", name: "補償散步獺" };
  }
  const face = els.tomaCoach.querySelector(".toma-face");
  const stageBadge = $("#otterStage");
  if (face) face.textContent = stage.face;
  if (stageBadge) stageBadge.textContent = stage.name;
  const progress = Math.max(Math.round(calculateWeightProgress()), stage.level);
  els.tomaCoach.classList.toggle("level-30", progress >= 30);
  els.tomaCoach.classList.toggle("level-60", progress >= 60);
  els.tomaCoach.classList.toggle("level-100", progress >= 100);
  const unlocked = read("tomaUnlockedAchievements", []);
  const milestone = [100, 60, 30].find((value) => progress >= value && !unlocked.includes(value));
  if (milestone) {
    unlocked.push(milestone);
    write("tomaUnlockedAchievements", unlocked);
    showAchievement(milestone);
  }
}

function showAchievement(milestone) {
  const copy = {
    30: { title: "獺獺戴上運動頭帶", badge: "🏅", text: "進度 30%。你已經開始形成自己的節奏，可以截圖紀念一下。" },
    60: { title: "獺獺換上高級運動服", badge: "✨", text: "進度 60%。你不是靠忍，是靠每天穩穩記錄。" },
    100: { title: "獺獺完成體態任務", badge: "🏆", text: "目標達成。這張狀態很值得分享給未來的自己。" },
  }[milestone];
  if (!copy || !els.achievementPop) return;
  els.achievementTitle.textContent = copy.title;
  els.achievementBadge.textContent = copy.badge;
  els.achievementText.textContent = copy.text;
  els.achievementPop.hidden = false;
  window.clearTimeout(state.achievementTimer);
  state.achievementTimer = window.setTimeout(() => {
    if (els.achievementPop) els.achievementPop.hidden = true;
  }, 2600);
}

function renderScanBalance(totals, remaining, burned) {
  const steps = getTodaySteps();
  const stepTarget = Number(state.settings.stepTarget || defaultSettings.stepTarget);
  els.scanRemainingCalories.textContent = remaining;
  els.scanEatenCalories.textContent = totals.calories;
  els.scanBurnedCalories.textContent = burned;
  els.scanSteps.textContent = steps.toLocaleString("zh-TW");
  els.scanStepTarget.textContent = stepTarget.toLocaleString("zh-TW");
  els.scanStepBar.style.width = `${Math.min(100, Math.round((steps / stepTarget) * 100))}%`;
  if (window.matchMedia?.("(max-width: 680px)").matches) {
    els.weightProgress.textContent = steps.toLocaleString("zh-TW");
  }
}

function buildCoachAdvice(totals, target) {
  if (todayMeals().length === 0) return { badge: "待記錄", bg: "#edf7f1", color: "#2e6f4d", text: `先拍第一餐。你的目標是${state.settings.purpose}，建議每日約 ${state.settings.dailyTarget} kcal。` };
  if (totals.calories > target) return { badge: "超標", bg: "#fde7e2", color: "#a83a2d", text: `下一餐：${buildNextMealSuggestion(totals)}` };
  if (totals.protein < state.settings.proteinTarget * 0.55 && todayMeals().length >= 2) return { badge: "蛋白不足", bg: "#fff3d2", color: "#8a5a00", text: `下一餐：${buildNextMealSuggestion(totals)}` };
  return { badge: "穩定", bg: "#edf7f1", color: "#2e6f4d", text: `下一餐：${buildNextMealSuggestion(totals)}` };
}

function buildNextMealSuggestion(totals) {
  const remaining = Number(state.settings.dailyTarget) + estimateStepCalories() - totals.calories;
  const proteinGap = Number(state.settings.proteinTarget) - totals.protein;
  if (remaining <= 0) return "喝水或無糖茶。真的餓就選茶碗蒸、豆腐、沙拉、便利商店雞胸。";
  if (remaining < 350) return "控制在 300 kcal 內：生魚片 + 沙拉、雞胸 + 無糖豆漿、茶碗蒸。";
  if (proteinGap > 35) return "補蛋白質：烤魚/雞胸/豆腐 + 一份蔬菜 + 半碗飯，飲料無糖。";
  if (totals.carbs > 150) return "今天澱粉偏多，下一餐用蛋白質 + 蔬菜收尾。";
  return "均衡吃：蛋白質一掌心、蔬菜兩拳頭、飯麵半碗到一碗，醬汁另外放。";
}

function renderMeals() {
  const meals = todayMeals();
  if (!meals.length) {
    els.mealList.innerHTML = `<div class="empty-state"><strong>今天還沒有美食紀錄唷～快拍一餐吧！</strong><span>獺獺會陪你把今天慢慢記好。</span></div>`;
    return;
  }
  els.mealList.innerHTML = meals.map((meal) => `
    <article class="meal-item">
      ${meal.photoData ? `<img class="meal-photo" src="${meal.photoData}" alt="${escapeHtml(meal.name)}">` : `<div class="meal-photo placeholder">食</div>`}
      <div>
        <h3>${escapeHtml(meal.name)}</h3>
        <p>${meal.time} · ${meal.type} · 蛋白 ${meal.protein}g · 碳水 ${meal.carbs}g · 脂肪 ${meal.fat}g</p>
      </div>
      <span class="meal-kcal">${meal.calories}</span>
    </article>
  `).join("");
}

function renderWeight() {
  const latest = getLatestWeight();
  els.currentWeightText.textContent = latest?.weight ?? state.settings.startWeight;
  els.targetWeightText.textContent = state.settings.targetWeight;
  els.goalProgressBar.style.width = `${calculateWeightProgress()}%`;
  els.goalAdvice.textContent = latest ? `距離目標還有 ${Math.max(0, latest.weight - state.settings.targetWeight).toFixed(1)} kg。今天先吃對下一餐。` : `目前 BMI ${calculateBmiText()}，建議每日 ${calculateSuggestedCalories()} kcal。`;
  if (!state.weights.length) {
    els.weightList.innerHTML = `<div class="empty-state"><strong>還沒有體重紀錄</strong><span>每天打開時可以順手記錄。</span></div>`;
    return;
  }
  els.weightList.innerHTML = [...state.weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((item) => `
    <article class="meal-item">
      <div class="meal-photo placeholder">kg</div>
      <div><h3>${dayLabel(item.date)}</h3><p>體重紀錄</p></div>
      <span class="meal-kcal">${item.weight} kg</span>
    </article>
  `).join("");
}

function getLatestWeight() {
  return [...state.weights].sort((a, b) => b.date.localeCompare(a.date))[0];
}

function dayLabel(key) {
  return new Date(`${key}T00:00:00`).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
}

function calculateWeightProgress() {
  const latest = getLatestWeight();
  const start = Number(state.settings.startWeight);
  const target = Number(state.settings.targetWeight);
  const current = Number(latest?.weight ?? start);
  if (start === target) return 0;
  return Math.max(0, Math.min(100, ((start - current) / (start - target)) * 100));
}

function calculateBmi() {
  const latest = getLatestWeight();
  const weight = Number(latest?.weight || state.settings.startWeight);
  const heightM = Number(state.settings.heightCm) / 100;
  return weight && heightM ? weight / (heightM * heightM) : null;
}

function calculateBmiText() {
  const bmi = calculateBmi();
  return bmi ? bmi.toFixed(1) : "-";
}

function getBmiCategory(bmi) {
  if (!bmi) return "尚未計算";
  if (bmi < 18.5) return "過輕";
  if (bmi < 24) return "正常";
  if (bmi < 27) return "過重";
  if (bmi < 30) return "輕度肥胖";
  if (bmi < 35) return "中度肥胖";
  return "重度肥胖";
}

function calculateSuggestedCalories(settings = state.settings) {
  const weight = Number(getLatestWeight()?.weight || settings.startWeight);
  const height = Number(settings.heightCm);
  const age = Number(settings.age);
  const sexOffset = settings.sex === "female" ? -161 : 5;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  const tdee = bmr * Number(settings.activity || 1.375);
  const purpose = settings.purpose || "瘦身";
  const floor = settings.sex === "female" ? 1200 : 1500;
  if (purpose === "增重") return Math.round((tdee + 250) / 50) * 50;
  if (purpose === "維持肌肉") return Math.round(Math.max(floor, tdee - 100) / 50) * 50;
  const days = Math.max(1, Math.ceil((new Date(`${settings.deadline}T00:00:00`) - new Date(`${todayKey}T00:00:00`)) / 86400000));
  const kgToLose = Math.max(0, weight - Number(settings.targetWeight));
  const deficit = Math.min(750, Math.max(250, kgToLose ? Math.round((kgToLose * 7700) / days) : 350));
  return Math.round(Math.max(floor, tdee - deficit) / 50) * 50;
}

function renderChart() {
  const days = [...Array(state.chartRange)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (state.chartRange - 1 - index));
    const key = date.toISOString().slice(0, 10);
    const calories = state.meals.filter((meal) => meal.date === key).reduce((sum, meal) => sum + meal.calories, 0);
    return { key, label: state.chartRange === 7 ? new Date(`${key}T00:00:00`).toLocaleDateString("zh-TW", { weekday: "short" }) : String(new Date(`${key}T00:00:00`).getDate()), calories };
  });
  const target = Number(state.settings.dailyTarget);
  const max = Math.max(target, ...days.map((day) => day.calories), 1);
  els.calorieChart.innerHTML = days.map((day) => `<div class="bar-wrap"><div class="bar ${day.calories > 0 && Math.abs(day.calories - target) <= target * 0.12 ? "on-target" : ""}" style="height:${Math.max((day.calories / max) * 100, day.calories ? 7 : 2)}%"></div><span>${day.label}<br>${day.calories}</span></div>`).join("");
  const activeDays = days.filter((day) => day.calories > 0);
  els.avgCalories.textContent = activeDays.length ? Math.round(activeDays.reduce((sum, day) => sum + day.calories, 0) / activeDays.length) : 0;
  els.bestDay.textContent = activeDays[0]?.label || "-";
  els.loggedDays.textContent = activeDays.length;
}

function renderSparkline() {
  if (!els.sparklineChart) return;
  const days = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const calories = state.meals.filter((meal) => meal.date === key).reduce((sum, meal) => sum + meal.calories, 0);
    return { key, calories };
  });
  const target = Number(state.settings.dailyTarget || defaultSettings.dailyTarget);
  const max = Math.max(target, ...days.map((day) => day.calories), 1);
  const points = days.map((day, index) => {
    const x = 18 + index * 47;
    const y = 70 - (day.calories / max) * 52;
    return `${x},${Math.max(14, Math.min(72, y))}`;
  });
  const targetY = Math.max(14, Math.min(72, 70 - (target / max) * 52));
  els.sparklineChart.innerHTML = `
    <defs>
      <linearGradient id="sparklineGradient" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#E2583E"></stop>
        <stop offset="100%" stop-color="#F4A261"></stop>
      </linearGradient>
    </defs>
    <line x1="18" x2="302" y1="${targetY}" y2="${targetY}" class="spark-target"></line>
    <polyline points="${points.join(" ")}" class="spark-line"></polyline>
    ${points.map((point, index) => {
      const [x, y] = point.split(",");
      return `<circle cx="${x}" cy="${y}" r="${days[index].calories ? 4 : 3}" class="${days[index].calories ? "spark-dot active" : "spark-dot"}"></circle>`;
    }).join("")}
  `;
}

function renderCourseSession() {
  if (!els.courseTimeline || !els.courseCount) return;
  const courses = state.courseSession?.courses || [];
  const snapped = Boolean(state.courseSession?.snapped);
  if (!courses.length) {
    els.courseTimeline.innerHTML = `<span class="course-badge">等待上菜...</span>`;
    els.courseCount.textContent = "尚未開始";
  } else {
    els.courseTimeline.innerHTML = courses.map((course, index) => `
      <span class="course-badge filled">第 ${index + 1} 道：${escapeHtml(course.icon)} ${escapeHtml(course.name)}</span>
    `).join("");
    els.courseCount.textContent = snapped ? `已校正 ${courses.length} 道佳餚` : `已品嚐 ${courses.length} 道佳餚`;
  }
  if (els.finalComboCTA) els.finalComboCTA.disabled = !courses.length || snapped;
  if (els.cameraCoachCTA) els.cameraCoachCTA.disabled = snapped || courses.length >= courseTemplates.length;
  const totals = todayTotals();
  const overTarget = totals.calories > Number(state.settings.dailyTarget || defaultSettings.dailyTarget);
  if (els.planCard) {
    els.planCard.hidden = !overTarget && !snapped;
    if (els.planContent) {
      els.planContent.textContent = overTarget
        ? "這一餐享用得很滿足。下一餐建議高纖蔬菜 + 豆腐/魚/雞胸，主食半份，晚上安排 20 分鐘輕鬆伸展。"
        : "完食校正後，獺獺會依照實吃熱量安排下一餐與活動，讓享受和體態都不失控。";
    }
  }
}

function addManualSteps(steps) {
  const current = getTodaySteps();
  const target = Number(state.settings.stepTarget || defaultSettings.stepTarget);
  state.steps = state.steps.filter((item) => item.date !== activeDateKey());
  state.steps.push({ date: activeDateKey(), steps: current + steps });
  state.settings.stepTarget = target;
  write("biteBeamSteps", state.steps);
  write("biteBeamSettings", state.settings);
  if (els.tomaBubble) els.tomaBubble.textContent = `成功補記 ${steps.toLocaleString("zh-TW")} 步，獺獺幫你把節奏拉回來。`;
  render();
}

function saveCourseSession() {
  write("tomaCourseSession", state.courseSession);
}

function addCourseMeal() {
  const session = state.courseSession || { courses: [], snapped: false };
  if (session.snapped || session.courses.length >= courseTemplates.length) {
    if (els.tomaBubble) els.tomaBubble.textContent = "這套餐已經結束囉，拍大合照校正後就等下一餐。";
    renderCourseSession();
    return;
  }
  const template = courseTemplates[session.courses.length];
  const meal = {
    id: crypto.randomUUID(),
    date: activeDateKey(),
    time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
    type: guessMealType(),
    scenario: "set",
    name: template.name,
    description: `套餐逐道紀錄：${template.name}`,
    calories: template.calories,
    protein: template.protein,
    carbs: template.carbs,
    fat: template.fat,
    detected: [template.name],
    allergyHits: findAllergyHits(template.name, [template.name]),
    aiAdvice: "逐道記錄完成。吃完再拍大合照，獺獺會幫你把醬汁與剩食校正得更準。",
    aiActionHints: ["慢慢吃", "記得拍完食照片", "下一道上菜再記"],
  };
  meal.baseProtein = meal.protein;
  meal.baseCarbs = meal.carbs;
  meal.baseFat = meal.fat;
  state.meals.unshift(meal);
  session.courses.push(template);
  state.courseSession = session;
  saveCourseSession();
  write("biteBeamMeals", state.meals);
  if (els.tomaBubble) els.tomaBubble.textContent = `第 ${session.courses.length} 道 ${template.name} 已記錄。`;
  render();
}

function snapFinalCombo() {
  const session = state.courseSession || { courses: [], snapped: false };
  if (!session.courses.length || session.snapped) {
    renderCourseSession();
    return;
  }
  const correction = {
    id: crypto.randomUUID(),
    date: activeDateKey(),
    time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
    type: guessMealType(),
    scenario: "set",
    name: "完食大合照校正",
    description: "套餐完食照片校正：醬汁、飲品與隱藏熱量",
    calories: 200,
    protein: 0,
    carbs: 10,
    fat: 12,
    detected: ["醬汁與隱藏熱量校正"],
    allergyHits: [],
    aiAdvice: "完食合照校正成功。下一餐請選高纖蔬菜 + 高蛋白，主食半份就好。",
    aiActionHints: ["大合照已校正", "下一餐高纖高蛋白", "今天多走 15 分鐘"],
  };
  correction.baseProtein = correction.protein;
  correction.baseCarbs = correction.carbs;
  correction.baseFat = correction.fat;
  state.meals.unshift(correction);
  session.snapped = true;
  state.courseSession = session;
  saveCourseSession();
  write("biteBeamMeals", state.meals);
  if (els.tomaBubble) els.tomaBubble.textContent = "完食合照校正成功！下一餐與活動交給獺獺幫你拉回節奏。";
  render();
}

function resetCourseSession() {
  state.courseSession = { courses: [], snapped: false };
  saveCourseSession();
  if (els.tomaBubble) els.tomaBubble.textContent = "本餐逐道紀錄已重置，可以重新開始。";
  render();
}

function handleTomaTap() {
  if (!els.tomaCoach || !els.tomaBubble) return;
  const line = tomaTapLines[Math.floor(Math.random() * tomaTapLines.length)];
  els.tomaBubble.textContent = line;
  els.tomaCoach.classList.remove("is-bouncing");
  void els.tomaCoach.offsetWidth;
  els.tomaCoach.classList.add("is-bouncing");
}

function renderSettings() {
  els.heightCm.value = state.settings.heightCm;
  els.startWeight.value = state.settings.startWeight;
  els.age.value = state.settings.age;
  els.sex.value = state.settings.sex;
  els.activity.value = String(state.settings.activity);
  els.targetWeight.value = state.settings.targetWeight;
  els.deadline.value = state.settings.deadline;
  els.dailyTarget.value = state.settings.dailyTarget;
  els.proteinTarget.value = state.settings.proteinTarget;
  els.stepTarget.value = state.settings.stepTarget || defaultSettings.stepTarget;
  els.todaySteps.value = getTodaySteps() || "";
  const bmi = calculateBmi();
  els.recommendedCalories.textContent = calculateSuggestedCalories();
  els.bmiExplain.textContent = `目前 BMI ${bmi ? bmi.toFixed(1) : "-"}（${getBmiCategory(bmi)}），依目標體重與期限估算。`;
}

function renderOnboarding() {
  els.onboarding.classList.toggle("active", needsOnboarding());
  els.profileName.value = state.settings.profileName || "";
  els.profilePurpose.value = state.settings.purpose || "瘦身";
  els.onboardHeight.value = state.settings.heightCm;
  els.onboardWeight.value = state.settings.startWeight;
  els.onboardAge.value = state.settings.age;
  els.onboardSex.value = state.settings.sex;
  els.onboardTargetWeight.value = state.settings.targetWeight;
  els.onboardDeadline.value = state.settings.deadline;
  els.allergies.value = (state.settings.allergies || []).join("、");
}

function ensureOnboardingEnhancements() {
  if (!els.onboardingForm || document.getElementById("onboardCompanionStyle")) return;
  const companionRow = document.createElement("div");
  companionRow.className = "form-row";
  companionRow.innerHTML = `
    <label for="onboardCompanionStyle">陪伴偏好</label>
    <select id="onboardCompanionStyle">
      <option value="quiet">安靜提醒</option>
      <option value="warm">溫柔鼓勵</option>
      <option value="direct">直接精準</option>
    </select>
  `;
  els.allergies.closest(".form-row")?.after(companionRow);

  const liveCard = document.createElement("div");
  liveCard.className = "recommend-card onboarding-live-card";
  liveCard.innerHTML = `
    <div>
      <p class="panel-label">30 秒極速換算</p>
      <strong><span id="onboardLiveBmi">-</span> BMI · <span id="onboardLiveCalories">-</span> kcal</strong>
      <small id="onboardLiveCopy">調整身高與體重，獺獺會即時換算基礎額度。</small>
    </div>
  `;
  companionRow.after(liveCard);

  [els.onboardHeight, els.onboardWeight, els.onboardAge, els.onboardSex, els.onboardTargetWeight, els.onboardDeadline]
    .forEach((input) => input?.addEventListener("input", updateOnboardingLiveStats));
}

function updateOnboardingLiveStats() {
  const bmiEl = document.getElementById("onboardLiveBmi");
  const caloriesEl = document.getElementById("onboardLiveCalories");
  if (!bmiEl || !caloriesEl) return;
  const draft = {
    ...state.settings,
    heightCm: Number(els.onboardHeight.value || defaultSettings.heightCm),
    startWeight: Number(els.onboardWeight.value || defaultSettings.startWeight),
    age: Number(els.onboardAge.value || defaultSettings.age),
    sex: els.onboardSex.value || defaultSettings.sex,
    targetWeight: Number(els.onboardTargetWeight.value || defaultSettings.targetWeight),
    deadline: els.onboardDeadline.value || defaultSettings.deadline,
  };
  const heightM = draft.heightCm / 100;
  const bmi = heightM ? draft.startWeight / (heightM * heightM) : 0;
  bmiEl.textContent = bmi ? bmi.toFixed(1) : "-";
  caloriesEl.textContent = calculateSuggestedCalories(draft);
}

function renderDailyCheckin() {
  const hasTodayWeight = state.weights.some((item) => item.date === todayKey);
  const shouldShow = !needsOnboarding() && state.settings.profileName && !hasTodayWeight && !sessionStorage.getItem("biteBeamSkipCheckin");
  els.dailyCheckin.classList.toggle("active", Boolean(shouldShow));
  els.dailyGreeting.textContent = buildMorningGreeting();
  els.encourageBox.hidden = true;
}

function buildMorningGreeting() {
  const name = state.settings.profileName || "你";
  const lines = [
    `${name}，今天先不用完美，只要誠實記錄就已經贏一半。`,
    `${name}，體重只是儀表板，不是成績單。量一下，我們今天繼續微調。`,
    `${name}，今天的任務很簡單：知道狀態，吃得更聰明。`,
  ];
  return lines[new Date().getDate() % lines.length];
}

function activateTab(id) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === id));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === id));
  const panel = document.getElementById(id);
  if (panel && window.matchMedia("(max-width: 680px)").matches) {
    window.setTimeout(() => panel.scrollIntoView({ block: "start", behavior: "smooth" }), 30);
  }
}

function saveSettings(event) {
  event.preventDefault();
  state.settings = {
    ...state.settings,
    heightCm: Number(els.heightCm.value || defaultSettings.heightCm),
    startWeight: Number(els.startWeight.value || defaultSettings.startWeight),
    age: Number(els.age.value || defaultSettings.age),
    sex: els.sex.value,
    activity: Number(els.activity.value || defaultSettings.activity),
    targetWeight: Number(els.targetWeight.value || defaultSettings.targetWeight),
    deadline: els.deadline.value || defaultSettings.deadline,
    dailyTarget: Number(els.dailyTarget.value || defaultSettings.dailyTarget),
    proteinTarget: Number(els.proteinTarget.value || defaultSettings.proteinTarget),
  };
  write("biteBeamSettings", state.settings);
  render();
}

function saveOnboarding(event) {
  event.preventDefault();
  const next = {
    ...state.settings,
    profileName: els.profileName.value.trim() || "使用者",
    purpose: els.profilePurpose.value,
    heightCm: Number(els.onboardHeight.value || defaultSettings.heightCm),
    startWeight: Number(els.onboardWeight.value || defaultSettings.startWeight),
    age: Number(els.onboardAge.value || defaultSettings.age),
    sex: els.onboardSex.value,
    targetWeight: Number(els.onboardTargetWeight.value || defaultSettings.targetWeight),
    deadline: els.onboardDeadline.value || defaultSettings.deadline,
    allergies: parseList(els.allergies.value),
    onboarded: true,
  };
  state.settings = { ...next, dailyTarget: calculateSuggestedCalories(next), proteinTarget: Math.round(next.targetWeight * 1.2 / 5) * 5 };
  state.settings.companionStyle = document.getElementById("onboardCompanionStyle")?.value || "quiet";
  write("biteBeamSettings", state.settings);
  writeTesterProfile(activeTesterId(), {
    onboardCompleted: true,
    settingsUpdatedAt: new Date().toISOString(),
    displayName: state.settings.profileName,
  });
  renderTesterLogin();
  render();
}

function quickStart() {
  state.settings = { ...state.settings, profileName: "", purpose: "瘦身", onboarded: true, dailyTarget: calculateSuggestedCalories(state.settings) };
  sessionStorage.setItem("biteBeamSkipCheckin", "1");
  write("biteBeamSettings", state.settings);
  writeTesterProfile(activeTesterId(), {
    onboardCompleted: true,
    settingsUpdatedAt: new Date().toISOString(),
    displayName: state.settings.profileName || "OtterFit Tester",
  });
  renderTesterLogin();
  render();
}

function parseList(value) {
  return value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);
}

function applySuggestedCalories() {
  const draft = { ...state.settings, heightCm: Number(els.heightCm.value || state.settings.heightCm), startWeight: Number(els.startWeight.value || state.settings.startWeight), age: Number(els.age.value || state.settings.age), sex: els.sex.value, activity: Number(els.activity.value || state.settings.activity), targetWeight: Number(els.targetWeight.value || state.settings.targetWeight), deadline: els.deadline.value || state.settings.deadline };
  els.dailyTarget.value = calculateSuggestedCalories(draft);
}

function renderPreservingBodyDrafts() {
  const drafts = {
    todaySteps: els.todaySteps?.value ?? "",
    stepTarget: els.stepTarget?.value ?? "",
  };
  render();
  if (els.todaySteps && drafts.todaySteps !== "") els.todaySteps.value = drafts.todaySteps;
  if (els.stepTarget && drafts.stepTarget !== "") els.stepTarget.value = drafts.stepTarget;
}

function saveWeight(event) {
  event.preventDefault();
  const weight = Number(els.todayWeight.value);
  if (!weight) return;
  saveTodayWeight(weight);
  renderPreservingBodyDrafts();
}

function saveSteps(event) {
  event.preventDefault();
  const steps = Math.max(0, Number(els.todaySteps.value || 0));
  const target = Number(els.stepTarget.value || state.settings.stepTarget || defaultSettings.stepTarget);
  state.steps = state.steps.filter((item) => item.date !== activeDateKey());
  state.steps.push({ date: activeDateKey(), steps });
  state.settings.stepTarget = target;
  write("biteBeamSteps", state.steps);
  write("biteBeamSettings", state.settings);
  render();
  if (els.stepsStatus) {
    const label = activeDateKey() === todayKey ? "今天" : dayLabel(activeDateKey());
    els.stepsStatus.hidden = false;
    els.stepsStatus.textContent = `已儲存 ${label} ${steps.toLocaleString("zh-TW")} 步，約消耗 ${estimateStepCalories(steps)} kcal。`;
  }
}

function selectQuickMeal(button) {
  const meal = button.dataset.meal || "";
  const portion = button.dataset.portion || "1";
  const confidence = Number(button.dataset.confidence || 78);
  $$(".meal-chip").forEach((item) => item.classList.toggle("selected", item === button));
  els.mealText.value = meal;
  els.portion.value = portion;
  state.lastApiStatus = `快速選餐估算，信心指數約 ${confidence}%。`;
  updateAutoDetectUI();
  if (state.currentEstimate) estimateMeal();
}

function adjustTodayWeight(delta) {
  const latest = Number(els.todayWeight.value || getLatestWeight()?.weight || state.settings.startWeight || 80);
  const next = Math.max(30, Math.min(250, Math.round((latest + delta) * 10) / 10));
  els.todayWeight.value = next.toFixed(1);
  saveTodayWeight(next);
  renderPreservingBodyDrafts();
}

function savePresetSteps(button) {
  const steps = Math.max(0, Number(button.dataset.steps || 0));
  if (!steps) return;
  els.todaySteps.value = steps;
  $$(".steps-preset-row button").forEach((item) => item.classList.toggle("active", item === button));
  state.steps = state.steps.filter((item) => item.date !== activeDateKey());
  state.steps.push({ date: activeDateKey(), steps });
  write("biteBeamSteps", state.steps);
  write("biteBeamSettings", state.settings);
  render();
  if (els.stepsStatus) {
    els.stepsStatus.hidden = false;
    els.stepsStatus.textContent = `已快速儲存 ${steps.toLocaleString("zh-TW")} 步，約消耗 ${estimateStepCalories(steps)} kcal。`;
  }
}

function openCameraCoach() {
  if (!els.cameraModal) return;
  els.cameraModal.hidden = false;
  els.cameraModalText.textContent = "把餐點放在畫面中央，獺獺會先幫你估算。";
  els.scanProgress.hidden = true;
  els.scanProgressBar.style.width = "0%";
  els.scanLine.classList.remove("active");
}

function closeCameraCoach() {
  if (els.cameraModal) els.cameraModal.hidden = true;
}

function simulateMealScanAction() {
  els.scanProgress.hidden = false;
  els.scanProgressBar.style.width = "0%";
  els.scanLine.classList.add("active");
  els.cameraModalText.textContent = "AI 正在掃描餐盤...";
  requestAnimationFrame(() => {
    els.scanProgressBar.style.width = "100%";
  });
  window.setTimeout(() => {
    const meal = {
      id: crypto.randomUUID(),
      date: activeDateKey(),
      time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
      type: guessMealType(),
      scenario: "normal",
      name: "鮭魚沙拉",
      description: "Gemini 互動模擬餐點",
      calories: 420,
      protein: 25,
      carbs: 18,
      fat: 24,
      detected: ["鮭魚沙拉", "生菜", "橄欖油醬"],
      allergyHits: findAllergyHits("鮭魚沙拉 生菜 橄欖油醬", ["鮭魚沙拉", "生菜", "橄欖油醬"]),
      aiAdvice: "哇！這盤鮭魚沙拉看起來太棒了，幫你估算蛋白質增加 25g。下一餐主食半份就很漂亮。",
      aiActionHints: ["蛋白質表現很好", "醬汁適量", "下一餐主食半份"],
      itemChoices: [
        { label: "鮭魚沙拉", calories: 320, selected: true, confidence: 0.82 },
        { label: "橄欖油醬", calories: 100, selected: true, confidence: 0.72 },
      ],
    };
    meal.baseProtein = meal.protein;
    meal.baseCarbs = meal.carbs;
    meal.baseFat = meal.fat;
    state.currentEstimate = meal;
    state.lastApiStatus = "互動模擬完成：獺獺已把鮭魚沙拉寫入待確認餐點。";
    els.cameraModalText.textContent = meal.aiAdvice;
    renderEstimate();
    render();
    window.setTimeout(closeCameraCoach, 650);
  }, 1100);
}

async function askGeminiLayout(event) {
  event.preventDefault();
  const note = els.geminiPrompt.value.trim();
  els.geminiOutput.hidden = false;
  els.geminiOutput.textContent = "Gemini 正在看目前版面...";
  try {
    const response = await fetch("/api/gemini-layout-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      els.geminiOutput.textContent = friendlyGeminiError(body, response.status);
      return;
    }
    els.geminiOutput.textContent = body.advice || "Gemini 沒有回傳建議。";
  } catch {
    els.geminiOutput.textContent = "Gemini 連線失敗。請確認目前網址是 Node 後端，例如 8789，而不是靜態伺服器。";
  }
}

function friendlyGeminiError(body, status) {
  if (body?.error === "missing_gemini_key") return "還沒設定 GEMINI_API_KEY。把 Gemini API Key 放進 .env 後重啟 server.js。";
  if (status === 429) return "Gemini 額度或速率受限，晚點再試。";
  return body?.message ? `Gemini 回傳錯誤：${body.message}` : "Gemini 暫時無法分析。";
}

function saveQuickWeight(event) {
  event.preventDefault();
  const weight = Number(els.quickWeight.value);
  if (!weight) return;
  saveTodayWeight(weight);
  els.encourageBox.hidden = false;
  els.encourageBox.textContent = buildEncouragement(weight);
  setTimeout(() => {
    els.dailyCheckin.classList.remove("active");
    render();
  }, 1000);
}

function saveTodayWeight(weight) {
  state.weights = state.weights.filter((item) => item.date !== todayKey);
  state.weights.push({ date: todayKey, weight });
  state.settings.startWeight = weight;
  write("biteBeamWeights", state.weights);
  write("biteBeamSettings", state.settings);
}

function buildEncouragement(weight) {
  const diff = Math.max(0, weight - Number(state.settings.targetWeight)).toFixed(1);
  return diff === "0.0" ? "很好，已經在目標附近。今天重點是穩住。" : `完成今天第一步，很棒。距離目標還有 ${diff} kg，我們今天只專心把下一餐吃對。`;
}

function clearToday() {
  if (state.undoClearMeals) {
    window.clearTimeout(state.undoClearTimer);
    state.meals = state.undoClearMeals;
    state.undoClearMeals = null;
    write("biteBeamMeals", state.meals);
    if (els.clearToday) els.clearToday.textContent = "清空今日";
    render();
    return;
  }
  const todayItems = state.meals.filter((meal) => meal.date === activeDateKey());
  if (!todayItems.length) return;
  state.undoClearMeals = [...state.meals];
  state.meals = state.meals.filter((meal) => meal.date !== activeDateKey());
  write("biteBeamMeals", state.meals);
  if (els.clearToday) els.clearToday.textContent = "撤銷清空";
  render();
  state.undoClearTimer = window.setTimeout(() => {
    state.undoClearMeals = null;
    if (els.clearToday) els.clearToday.textContent = "清空今日";
  }, 3000);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function fileToSmallDataUrl(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.65));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$$(".tab").forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));
els.dateStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  state.selectedDate = button.dataset.date;
  render();
});
$$(".range-btn").forEach((button) => button.addEventListener("click", () => {
  state.chartRange = Number(button.dataset.range);
  $$(".range-btn").forEach((item) => item.classList.toggle("active", item === button));
  renderChart();
}));
$$(".portion-buttons button").forEach((button) => button.addEventListener("click", () => {
  els.portion.value = button.dataset.portion;
  updateAutoDetectUI();
  if (state.currentEstimate) estimateMeal();
}));
$$(".meal-chip").forEach((button) => button.addEventListener("click", () => selectQuickMeal(button)));
$$("[data-weight-delta]").forEach((button) => button.addEventListener("click", () => adjustTodayWeight(Number(button.dataset.weightDelta || 0))));
$$(".steps-preset-row button").forEach((button) => button.addEventListener("click", () => savePresetSteps(button)));
$$(".mode-btn").forEach((button) => button.addEventListener("click", () => {
  $$(".mode-btn").forEach((item) => item.classList.toggle("active", item === button));
  els.scanLayout.classList.toggle("after-mode", button.dataset.mode === "after");
  els.photoPrompt.textContent = button.dataset.mode === "after" ? "先拍餐點上桌的照片" : "餐點上桌後，先拍一下";
}));
els.mealScenario.addEventListener("change", () => { if (state.currentEstimate) estimateMeal(); });
els.estimateButton.addEventListener("click", estimateMeal);
els.mealForm.addEventListener("submit", addMeal);
els.saveMealFromPop.addEventListener("click", saveCurrentMeal);
els.popFoodItems.addEventListener("change", updateMealSelection);
els.settingsForm.addEventListener("submit", saveSettings);
els.onboardingForm.addEventListener("submit", saveOnboarding);
els.quickStart.addEventListener("click", quickStart);
els.dailyCheckinForm.addEventListener("submit", saveQuickWeight);
els.skipCheckin.addEventListener("click", () => {
  sessionStorage.setItem("biteBeamSkipCheckin", "1");
  els.dailyCheckin.classList.remove("active");
});
els.applySuggestedCalories.addEventListener("click", applySuggestedCalories);
els.weightForm.addEventListener("submit", saveWeight);
els.stepsForm.addEventListener("submit", saveSteps);
els.geminiForm.addEventListener("submit", askGeminiLayout);
els.mobileEstimateCTA.addEventListener("click", openCameraCoach);
els.cameraCoachCTA.addEventListener("click", addCourseMeal);
els.finalComboCTA.addEventListener("click", snapFinalCombo);
els.tomaCoach.addEventListener("click", handleTomaTap);
els.planCard.addEventListener("click", () => addManualSteps(2500));
els.closeCameraModal.addEventListener("click", closeCameraCoach);
els.realUploadFromModal.addEventListener("click", closeCameraCoach);
els.simulateMealScan.addEventListener("click", simulateMealScanAction);
els.closeAchievement.addEventListener("click", () => {
  window.clearTimeout(state.achievementTimer);
  els.achievementPop.hidden = true;
});
els.clearToday.addEventListener("click", clearToday);
els.closeResultPop.addEventListener("click", () => { els.resultPop.hidden = true; });
$("#retakePhoto").addEventListener("click", () => {
  els.resultPop.hidden = true;
  els.mealImage.value = "";
});
els.editProfile.addEventListener("click", () => {
  els.onboarding.classList.add("active");
});
els.mealImage.addEventListener("change", () => {
  const file = els.mealImage.files?.[0];
  if (!file) return;
  els.previewImage.src = URL.createObjectURL(file);
  els.previewImage.hidden = false;
  els.uploadZone.classList.add("has-image");
  els.scanLayout.classList.add("show-preview");
  fileToSmallDataUrl(file).then((dataUrl) => {
    state.currentPhotoData = dataUrl;
    estimateMeal();
  });
});
els.afterMealImage.addEventListener("change", () => {
  const file = els.afterMealImage.files?.[0];
  if (!file) return;
  els.afterPreviewImage.src = URL.createObjectURL(file);
  els.afterPreviewImage.hidden = false;
  els.afterZone.classList.add("has-image");
  els.scanLayout.classList.add("show-after-preview");
  fileToSmallDataUrl(file).then((dataUrl) => {
    state.currentAfterPhotoData = dataUrl;
    if (!state.currentEstimate) estimateMeal();
    renderActualIntake();
  });
});

function renderTesterLogin() {
  const testerId = activeTesterId();
  if (!els.testerLogin) return;
  els.testerLogin.classList.toggle("active", !testerId);
  document.body.classList.toggle("locked", !testerId || needsOnboarding());
}

function handleTesterLogin(event) {
  event.preventDefault();
  const accountId = els.testerAccount.value;
  const password = els.testerPassword.value.trim();
  const account = testerAccounts[accountId];
  if (!account || password !== account.password) {
    els.testerLoginStatus.hidden = false;
    els.testerLoginStatus.textContent = "密碼錯誤，請重新輸入 Toma2026!。";
    return;
    els.testerLoginStatus.hidden = false;
    els.testerLoginStatus.textContent = "帳號或密碼不對，請再確認一次。";
    return;
  }

  if (!localStorage.getItem(testerStorageKey(accountId))) {
    writeTesterProfile(accountId, {
      onboardCompleted: false,
      createdAt: new Date().toISOString(),
      displayName: account.label,
    });
  }
  localStorage.setItem("tomaActiveTester", accountId);
  localStorage.setItem("tomaActiveTesterName", account.label);
  sessionStorage.removeItem("biteBeamSkipCheckin");
  els.testerLoginStatus.hidden = false;
  els.testerLoginStatus.textContent = readTesterProfile(accountId).onboardCompleted === true
    ? "登入成功，正在載入你的 OtterFit 沙盒資料..."
    : "登入成功，先完成 30 秒極速引導。";
  location.reload();
}

function quickTesterLogin(accountId) {
  const account = testerAccounts[accountId];
  if (!account) return;
  els.testerAccount.value = accountId;
  els.testerPassword.value = "";
  els.testerPassword.focus();
  els.testerLoginStatus.hidden = false;
  els.testerLoginStatus.textContent = `請輸入 ${account.label} 的測試密碼。`;
}

function switchTester() {
  localStorage.removeItem("tomaActiveTester");
  localStorage.removeItem("tomaActiveTesterName");
  sessionStorage.removeItem("biteBeamSkipCheckin");
  location.reload();
}

els.testerLoginForm?.addEventListener("submit", handleTesterLogin);
$$("[data-quick-login]").forEach((button) => button.addEventListener("click", () => quickTesterLogin(button.dataset.quickLogin)));
els.switchTester?.addEventListener("click", switchTester);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});
}

updateAutoDetectUI();
renderTesterLogin();
render();
