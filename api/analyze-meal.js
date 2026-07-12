function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function normalizeHint(value = "") {
  return String(value || "")
    .replace(/\.(jpg|jpeg|png|webp|heic|gif)$/ig, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateByText(text = "") {
  const raw = normalizeHint(text);
  const lower = raw.toLowerCase();
  const rules = [
    { keys: ["滷肉飯", "魯肉飯"], name: "滷肉飯便當", kcal: 665, protein: 33, carbs: 82, fat: 24, fiber: 6, sugar: 8, sodium: 980 },
    { keys: ["便當", "排骨便當", "雞腿便當"], name: raw || "便當", kcal: 760, protein: 32, carbs: 88, fat: 28, fiber: 5, sugar: 8, sodium: 1050 },
    { keys: ["炒飯"], name: raw || "炒飯", kcal: 720, protein: 24, carbs: 88, fat: 28, fiber: 4, sugar: 5, sodium: 980 },
    { keys: ["牛肉麵", "拉麵", "乾麵", "麵"], name: raw || "麵食", kcal: 650, protein: 26, carbs: 86, fat: 22, fiber: 4, sugar: 5, sodium: 1350 },
    { keys: ["雞胸", "舒肥雞", "雞肉"], name: raw || "雞胸餐", kcal: 360, protein: 38, carbs: 28, fat: 9, fiber: 4, sugar: 4, sodium: 620 },
    { keys: ["魚", "烤魚", "清蒸魚"], name: raw || "魚肉餐", kcal: 420, protein: 32, carbs: 38, fat: 14, fiber: 4, sugar: 4, sodium: 680 },
    { keys: ["豆腐", "豆干"], name: raw || "豆腐餐", kcal: 320, protein: 22, carbs: 24, fat: 14, fiber: 5, sugar: 4, sodium: 620 },
    { keys: ["沙拉"], name: raw || "沙拉", kcal: 320, protein: 18, carbs: 28, fat: 15, fiber: 7, sugar: 8, sodium: 520 },
    { keys: ["地瓜", "番薯"], name: raw || "地瓜", kcal: 180, protein: 3, carbs: 42, fat: 0, fiber: 5, sugar: 9, sodium: 80 },
    { keys: ["可樂", "汽水"], name: raw || "含糖汽水", kcal: 140, protein: 0, carbs: 35, fat: 0, fiber: 0, sugar: 35, sodium: 20 },
    { keys: ["湯", "清湯"], name: raw || "湯品", kcal: 150, protein: 8, carbs: 12, fat: 6, fiber: 2, sugar: 3, sodium: 650 }
  ];
  const matched = rules.find((rule) => rule.keys.some((key) => lower.includes(key.toLowerCase()) || raw.includes(key)));
  if (matched) return matched;
  const looksGeneric = !raw || /^(img|image|photo|picture|test|food|meal)\b/i.test(raw);
  return {
    name: looksGeneric ? "照片待確認餐點" : raw,
    kcal: 430,
    protein: 18,
    carbs: 48,
    fat: 15,
    fiber: 3,
    sugar: 6,
    sodium: 650
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "method_not_allowed" });
  }

  const body = await readBody(req);
  const hint = [body.mealText, body.fileName, body.name, body.mealName]
    .map(normalizeHint)
    .find(Boolean) || "";
  const estimate = estimateByText(hint);
  const lowTrust = estimate.name === "照片待確認餐點";

  return json(res, 200, {
    name: estimate.name,
    total_kcal: estimate.kcal,
    protein_g: estimate.protein,
    carbs_g: estimate.carbs,
    fat_g: estimate.fat,
    fiber_g: estimate.fiber,
    sugar_g: estimate.sugar,
    sodium_mg: estimate.sodium,
    confidence: lowTrust ? "low" : "medium",
    source: "vercel_local_fallback",
    notes: lowTrust
      ? "外網預覽暫時使用本機保守估算；可在結果卡輸入餐名並按「用餐名重估」。"
      : `已用「${estimate.name}」做本機資料庫估算，可再依實際份量微調。`,
    items: [
      {
        name: estimate.name,
        portion: "約 1 份",
        calories: estimate.kcal,
        protein: estimate.protein,
        carbs: estimate.carbs,
        fat: estimate.fat,
        fiber: estimate.fiber,
        sugar: estimate.sugar,
        sodium: estimate.sodium
      }
    ],
    action_hints: ["可補餐名", "可調整份量", "飯後照只作加分校正"]
  });
};
