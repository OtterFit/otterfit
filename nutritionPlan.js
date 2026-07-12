(function () {
  const ACTIVITY_FACTORS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  const GOAL_CONFIG = {
    slim: { calorieDelta: -500, proteinPerKg: 1.8, fatPerKg: 0.8 },
    fitness: { calorieDelta: 0, proteinPerKg: 1.6, fatPerKg: 0.9 },
    gain: { calorieDelta: 300, proteinPerKg: 1.8, fatPerKg: 0.9 },
    cut: { calorieDelta: -500, proteinPerKg: 1.8, fatPerKg: 0.8 },
    maintain: { calorieDelta: 0, proteinPerKg: 1.6, fatPerKg: 0.9 },
    bulk: { calorieDelta: 300, proteinPerKg: 1.8, fatPerKg: 0.9 },
  };

  function toNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function calcBMR({ sex = "neutral", weightKg, heightCm, age = 30 }) {
    const weight = clamp(toNumber(weightKg, 75), 30, 250);
    const height = clamp(toNumber(heightCm, 170), 120, 230);
    const safeAge = clamp(toNumber(age, 30), 16, 90);
    const base = 10 * weight + 6.25 * height - 5 * safeAge;
    if (sex === "female") return base - 161;
    if (sex === "male") return base + 5;
    return base - 78;
  }

  function calcTDEE(input) {
    const activity = input?.activity || "light";
    const factor = ACTIVITY_FACTORS[activity] || ACTIVITY_FACTORS.light;
    return calcBMR(input || {}) * factor;
  }

  function bmiLabel(bmi) {
    if (bmi < 18.5) return "偏瘦";
    if (bmi < 24) return "標準";
    if (bmi < 27) return "過重";
    return "肥胖";
  }

  function calcNutritionPlan(input = {}) {
    const goal = GOAL_CONFIG[input.goal] ? input.goal : "fitness";
    const cfg = GOAL_CONFIG[goal];
    const weightKg = clamp(toNumber(input.weightKg, 75), 30, 250);
    const heightCm = clamp(toNumber(input.heightCm, 170), 120, 230);
    const notes = [];
    const bmr = calcBMR({ ...input, weightKg, heightCm });
    const tdee = calcTDEE({ ...input, weightKg, heightCm });
    let targetCalories = tdee + cfg.calorieDelta;

    if ((goal === "slim" || goal === "cut") && targetCalories < bmr) {
      targetCalories = bmr;
      notes.push("減脂目標已避免低於基礎代謝，先穩定執行比過度壓低熱量重要。");
    }

    targetCalories = clamp(targetCalories, 1100, 4200);
    const protein = weightKg * cfg.proteinPerKg;
    const fat = weightKg * cfg.fatPerKg;
    let carbs = (targetCalories - protein * 4 - fat * 9) / 4;
    if (carbs < 50) {
      carbs = 50;
      notes.push("碳水低於 50g 時容易影響飽足與活動感，已保留最低基準。");
    }

    const bmi = weightKg / Math.pow(heightCm / 100, 2);
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetCalories: Math.round(targetCalories),
      protein: Math.round(protein),
      fat: Math.round(fat),
      carbs: Math.round(carbs),
      bmi: Math.round(bmi * 10) / 10,
      bmiLabel: bmiLabel(bmi),
      notes,
      source: "Mifflin-St Jeor + activity factor",
    };
  }

  window.OtterFitNutrition = {
    ACTIVITY_FACTORS,
    calcBMR,
    calcTDEE,
    calcNutritionPlan,
    bmiLabel,
  };
})();
