const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8788);
const DATA_DIR = path.join(ROOT, ".otterfit-data");
const USER_PROFILE_FILE = path.join(DATA_DIR, "user-profiles.json");
const USER_MEALS_DIR = path.join(DATA_DIR, "user-meals");
const USER_DAILY_STATE_DIR = path.join(DATA_DIR, "user-daily-state");

loadEnv(path.join(ROOT, ".env"));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/analyze-meal") {
      await handleAnalyzeMeal(req, res);
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/user-profile")) {
      await handleGetUserProfile(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/user-profile") {
      await handleSaveUserProfile(req, res);
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/user-meals")) {
      await handleGetUserMeals(req, res);
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/user-meal-dates")) {
      await handleGetUserMealDates(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/user-meals") {
      await handleSaveUserMeals(req, res);
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/user-daily-state")) {
      await handleGetUserDailyState(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/user-daily-state") {
      await handleSaveUserDailyState(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/gemini-layout-review") {
      await handleGeminiLayoutReview(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: "server_error", message: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`OtterFit 塔塔 is running at http://localhost:${PORT}`);
});

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
}

async function handleAnalyzeMeal(req, res) {
  const body = await readJson(req, 8 * 1024 * 1024);
  const { imageData, mealText = "", mealType = "", scenario = "", portionLabel = "" } = body;
  const fastTextEstimate = estimateMealTextServer(mealText);
  if (fastTextEstimate && shouldUseFastTextEstimate(mealText, scenario)) {
    sendJson(res, 200, { ...publicAnalysis(normalizeAnalysis(fastTextEstimate)), provider: "local_text_fast" });
    return;
  }
  if (!imageData || !String(imageData).startsWith("data:image/")) {
    if (String(mealText || "").trim()) {
      sendJson(res, 200, buildServerFallbackMeal(mealText, "local_text_fallback", "AI photo input was not provided, so OtterFit used local text rules."));
      return;
    }
    sendJson(res, 400, { error: "missing_image", message: "imageData must be a base64 data URL or mealText must be provided." });
    return;
  }

  const geminiAnalysis = await analyzeMealWithGemini({ imageData, mealText, mealType, scenario, portionLabel });
  if (geminiAnalysis) {
    sendJson(res, 200, publicAnalysis(ensureUsefulAnalysis(normalizeAnalysis(geminiAnalysis), mealText, "gemini", scenario)));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("貼上") || apiKey.includes("your-openai-api-key")) {
    sendJson(res, 200, buildServerFallbackMeal(mealText, "local_no_ai", "AI 服務尚未完成設定，已先用本機規則估算。"));
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          name: "meal_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              total_calories: { type: "integer" },
              total_protein: { type: "integer" },
              total_carbs: { type: "integer" },
              total_fat: { type: "integer" },
              total_fiber: { type: "integer" },
              total_sugar: { type: "integer" },
              total_sodium: { type: "integer" },
              meal_quality: { type: "string", enum: ["balanced", "light", "heavy", "sugary", "salty", "fried", "unknown"] },
              health_flags: { type: "array", items: { type: "string" } },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              notes: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    portion: { type: "string" },
                    calories: { type: "integer" },
                    protein: { type: "integer" },
                    carbs: { type: "integer" },
                    fat: { type: "integer" },
                    fiber: { type: "integer" },
                    sugar: { type: "integer" },
                    sodium: { type: "integer" }
                  },
                  required: ["name", "portion", "calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium"]
                }
              }
            },
            required: ["items", "total_calories", "total_protein", "total_carbs", "total_fat", "total_fiber", "total_sugar", "total_sodium", "meal_quality", "health_flags", "confidence", "notes"]
          }
        }
      },
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: [
                "你是一個食物熱量估算專家。",
                "請根據照片估算食物名稱、份量、總熱量 kcal、蛋白質 g、碳水 g、脂肪 g。",
                "只回傳符合 schema 的 JSON，不要 Markdown，不要加其他文字。",
                "重要規則：",
                "1. 仔細觀察容器大小和食物份量。小碟子、小碗的食物熱量通常很低。",
                "2. 配菜和小菜的熱量通常在 20-80 kcal 之間，不要當成主餐估算。",
                "3. 如果是台灣/亞洲常見食物，用台灣食品營養成分資料庫的數據為參考。",
                "4. 湯類：清湯約 50-150 kcal/碗，濃湯約 200-400 kcal/碗。",
                "5. 如果照片中有多個品項（例如分格餐盤），要分開列出每個品項。",
                "6. 寧可估低一點也不要估太高，因為高估會讓用戶失去信任。",
                "7. 一碟泡菜約 30-50 kcal，一碟涼拌青菜約 40-80 kcal，一碗白飯約 250-280 kcal。",
                "8. 如果情境是餐後剩餘量估算，只估照片中剩下的食物與湯汁，不要回推原本整餐。",
                "9. items.name 必須是照片中實際看見或補充文字明確指出的食物，例如「可樂」、「韓式泡菜湯」、「白飯」、「炒飯」。不要使用「照片餐點」、「餐點估算」、「食物名稱」、「unknown」這類泛用名稱。",
                "10. 不要把所有不確定照片固定估成 520 kcal。只有火鍋、滷肉飯、份量明確的一份正餐等合理情境才可接近 520 kcal；飲料罐、可樂、啤酒、檸檬片、小菜、清湯必須用各自合理熱量。",
                "11. 如果照片像飲料罐：可樂約 140 kcal/330ml、零卡可樂 0 kcal、啤酒約 150 kcal/330ml，不要當正餐估算。",
                "12. notes 要用一句繁體中文說明估算依據，例如看見的品項、份量、湯汁/醬料或不確定處。"
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `餐別：${mealType || "自動判斷"}`,
                `份量：${portionLabel || "一般"}`,
                `情境：${scenario || "一般餐"}`,
                `補充文字：${mealText || "無"}`,
                "items 每個項目要有 name, portion, calories, protein, carbs, fat, fiber, sugar, sodium。",
                "總計欄位請使用 total_calories, total_protein, total_carbs, total_fat, total_fiber, total_sugar, total_sodium。",
                "confidence 只能是 high / medium / low；notes 說明不確定處。",
              ].join("\n"),
            },
            {
              type: "input_image",
              image_url: imageData,
              detail: "low",
            },
          ],
        },
      ],
    }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    sendJson(res, 200, buildServerFallbackMeal(mealText, "local_ai_timeout", "AI 辨識時間較長，已先用本機規則估算。"));
    return;
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json();
  if (!response.ok) {
    sendJson(res, 200, buildServerFallbackMeal(mealText, "local_ai_error", friendlyOpenAiError(payload.error?.message || "OpenAI request failed.")));
    return;
  }

  const text = extractOutputText(payload);
  const analysis = parseJsonFromText(text);
  if (!analysis) {
    sendJson(res, 200, buildServerFallbackMeal(mealText, "local_invalid_ai", "AI 回傳格式不穩，已先用本機規則估算。"));
    return;
  }
  sendJson(res, 200, publicAnalysis(ensureUsefulAnalysis(normalizeAnalysis(analysis), mealText, "openai", scenario)));
}

async function analyzeMealWithGemini({ imageData, mealText = "", mealType = "", scenario = "", portionLabel = "" }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-gemini-api-key")) return null;

  const image = parseImageDataUrl(imageData);
  if (!image) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = [
    "你是一個食物熱量估算專家。請直接根據照片估算餐點熱量。",
    "請只回傳 JSON，不要 Markdown，不要解釋文字。",
    "JSON schema：",
    "{\"items\":[{\"name\":\"食物名稱\",\"portion\":\"份量描述\",\"calories\":0,\"protein\":0,\"carbs\":0,\"fat\":0}],\"total_calories\":0,\"total_protein\":0,\"total_carbs\":0,\"total_fat\":0,\"confidence\":\"high|medium|low\",\"notes\":\"估算依據與不確定處\"}",
    "估算規則：觀察食物品項、容器大小、盤中比例、湯汁/醬料、餐前或餐後剩餘量。",
    "湯類也必須估算：清湯 50-150 kcal/碗，濃湯 200-400 kcal/碗，料多肉湯或鍋物依內容提高。",
    "如果情境是餐後剩餘量估算，只估照片中剩下的食物，不要回推整餐。",
    "items.name 必須是照片中實際看見或補充文字明確指出的食物，不可回傳「照片餐點」、「餐點估算」、「食物名稱」、「unknown」。",
    "不要把不確定照片固定估成 520 kcal；飲料罐、可樂、啤酒、檸檬片、小菜、清湯都要用合理熱量。",
    "如果照片像飲料罐：可樂約 140 kcal/330ml、零卡可樂 0 kcal、啤酒約 150 kcal/330ml。",
    "notes 用一句繁體中文說明估算依據：看見的品項、份量、湯汁/醬料或不確定處。",
    "餐別：" + (mealType || "自動判斷"),
    "份量：" + (portionLabel || "一般"),
    "情境：" + (scenario || "一般餐"),
    "補充文字：" + (mealText || "無")
  ].join("\n");
  const responseSchema = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            portion: { type: "STRING" },
            calories: { type: "INTEGER" },
            protein: { type: "INTEGER" },
            carbs: { type: "INTEGER" },
            fat: { type: "INTEGER" },
            fiber: { type: "INTEGER" },
            sugar: { type: "INTEGER" },
            sodium: { type: "INTEGER" }
          },
          required: ["name", "portion", "calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium"]
        }
      },
      total_calories: { type: "INTEGER" },
      total_protein: { type: "INTEGER" },
      total_carbs: { type: "INTEGER" },
      total_fat: { type: "INTEGER" },
      total_fiber: { type: "INTEGER" },
      total_sugar: { type: "INTEGER" },
      total_sodium: { type: "INTEGER" },
      meal_quality: { type: "STRING" },
      health_flags: { type: "ARRAY", items: { type: "STRING" } },
      confidence: { type: "STRING" },
      notes: { type: "STRING" }
    },
    required: ["items", "total_calories", "total_protein", "total_carbs", "total_fat", "total_fiber", "total_sugar", "total_sodium", "meal_quality", "health_flags", "confidence", "notes"]
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2,
          maxOutputTokens: 700,
          thinkingConfig: { thinkingBudget: 0 }
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: image.mimeType, data: image.base64 } }
            ]
          }
        ]
      })
    });
    clearTimeout(timer);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    const text = (payload.candidates || [])
      .flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || "")
      .join("\n")
      .trim();
    return parseJsonFromText(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseImageDataUrl(imageData) {
  const match = String(imageData || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function handleGetUserProfile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const username = normalizeUsername(url.searchParams.get("username"));
  if (!username) {
    sendJson(res, 400, { error: "missing_username" });
    return;
  }
  const profiles = readUserProfiles();
  sendJson(res, 200, { profile: profiles[username] || null });
}

async function handleSaveUserProfile(req, res) {
  const body = await readJson(req, 256 * 1024);
  const username = normalizeUsername(body.username);
  if (!username) {
    sendJson(res, 400, { error: "missing_username" });
    return;
  }
  const profile = normalizeUserProfile(body.profile || {});
  const profiles = readUserProfiles();
  profiles[username] = { ...(profiles[username] || {}), ...profile, onboardingDone: true, updatedAt: new Date().toISOString() };
  writeUserProfiles(profiles);
  sendJson(res, 200, { profile: profiles[username] });
}

async function handleGetUserMeals(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const username = normalizeUsername(url.searchParams.get("username"));
  const date = normalizeDateKey(url.searchParams.get("date"));
  if (!username || !date) {
    sendJson(res, 400, { error: "missing_username_or_date" });
    return;
  }
  sendJson(res, 200, readUserMeals(username, date));
}

async function handleSaveUserMeals(req, res) {
  const body = await readJson(req, 12 * 1024 * 1024);
  const username = normalizeUsername(body.username);
  const date = normalizeDateKey(body.date);
  if (!username || !date) {
    sendJson(res, 400, { error: "missing_username_or_date" });
    return;
  }
  let meals;
  if (Array.isArray(body.meals)) {
    meals = body.meals.map(normalizeStoredMeal).slice(0, 80);
  } else if (body.meal && typeof body.meal === "object") {
    const existing = readUserMeals(username, date).meals;
    const incoming = normalizeStoredMeal(body.meal);
    const index = existing.findIndex((meal) => meal.id === incoming.id);
    if (index >= 0) existing[index] = { ...existing[index], ...incoming, updatedAt: new Date().toISOString() };
    else existing.push(incoming);
    meals = existing.slice(-80);
  } else {
    meals = [];
  }
  const payload = { date, meals, updatedAt: new Date().toISOString() };
  writeUserMeals(username, date, payload);
  sendJson(res, 200, payload);
}

async function handleGetUserMealDates(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const username = normalizeUsername(url.searchParams.get("username"));
  const limit = Math.round(clampNumber(url.searchParams.get("limit"), 1, 30, 10));
  if (!username) {
    sendJson(res, 400, { error: "missing_username" });
    return;
  }
  const dir = path.join(USER_MEALS_DIR, username);
  if (!fs.existsSync(dir)) {
    sendJson(res, 200, { dates: [] });
    return;
  }
  const dates = fs.readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ""))
    .sort()
    .reverse()
    .slice(0, limit)
    .map((date) => {
      const payload = readUserMeals(username, date);
      const meals = payload.meals || [];
      const calories = meals.reduce((sum, meal) => sum + Number(meal.calories || meal.kcal || 0), 0);
      const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore ? 1 : 0) + (meal.photoAfter ? 1 : (meal.photo && !meal.photoBefore ? 1 : 0)), 0);
      const cover = meals.map((meal) => meal.photoBefore || meal.photo || meal.photoAfter).find(Boolean) || "";
      return { date, mealCount: meals.length, photoCount, calories, cover };
    })
    .filter((entry) => entry.mealCount > 0 || entry.photoCount > 0);
  sendJson(res, 200, { dates });
}

async function handleGetUserDailyState(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const username = normalizeUsername(url.searchParams.get("username"));
  const date = normalizeDateKey(url.searchParams.get("date"));
  if (!username || !date) {
    sendJson(res, 400, { error: "missing_username_or_date" });
    return;
  }
  sendJson(res, 200, readUserDailyState(username, date));
}

async function handleSaveUserDailyState(req, res) {
  const body = await readJson(req, 512 * 1024);
  const username = normalizeUsername(body.username);
  const date = normalizeDateKey(body.date);
  if (!username || !date) {
    sendJson(res, 400, { error: "missing_username_or_date" });
    return;
  }
  const payload = { date, state: normalizeDailyState(body.state || {}), updatedAt: new Date().toISOString() };
  writeUserDailyState(username, date, payload);
  sendJson(res, 200, payload);
}

async function handleGeminiLayoutReview(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-gemini-api-key")) {
    sendJson(res, 401, { error: "missing_gemini_key", message: "GEMINI_API_KEY is not configured." });
    return;
  }

  const body = await readJson(req, 1024 * 1024);
  const note = String(body.note || "").slice(0, 2000);
  const html = safeReadText("index.html").slice(0, 14000);
  const css = safeReadText("styles.css").slice(0, 16000);
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = [
    "你是高級 mobile app UI/UX 顧問。請針對番茄日日 Toma 這個減重拍照熱量 App，給可以直接交給工程師修改的建議。",
    "目標：首頁要高級、直覺、拍照按鈕是主角，參考 iPhone app 截圖方向，但不要照抄競品。",
    "請用繁體中文，輸出：1. 首頁資訊層級 2. 配色建議 3. 間距/字級 4. 需要移除或弱化的元素 5. CSS/HTML 修改方向。",
    `使用者補充：${note || "請整體優化排版與配色。"}`,
    "目前 index.html：",
    html,
    "目前 styles.css：",
    css,
  ].join("\n\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 1400 },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    sendJson(res, response.status, { error: "gemini_error", message: payload.error?.message || "Gemini request failed." });
    return;
  }
  const advice = (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
  sendJson(res, 200, { advice });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = path.normalize(urlPath === "/" ? "/index.html" : urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (Buffer.byteLength(data) > limit) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function normalizeUsername(value) {
  const username = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(username)) return "";
  return username;
}

function normalizeDateKey(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function userMealsFile(username, date) {
  return path.join(USER_MEALS_DIR, username, `${date}.json`);
}

function readUserMeals(username, date) {
  const filePath = userMealsFile(username, date);
  try {
    if (!fs.existsSync(filePath)) return { date, meals: [], updatedAt: null };
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      date,
      meals: Array.isArray(parsed.meals) ? parsed.meals.map(normalizeStoredMeal) : [],
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { date, meals: [], updatedAt: null };
  }
}

function writeUserMeals(username, date, payload) {
  const dir = path.join(USER_MEALS_DIR, username);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(userMealsFile(username, date), JSON.stringify(payload, null, 2));
}

function userDailyStateFile(username, date) {
  return path.join(USER_DAILY_STATE_DIR, username, `${date}.json`);
}

function readUserDailyState(username, date) {
  const filePath = userDailyStateFile(username, date);
  try {
    if (!fs.existsSync(filePath)) return { date, state: null, updatedAt: null };
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      date,
      state: normalizeDailyState(parsed.state || {}),
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { date, state: null, updatedAt: null };
  }
}

function writeUserDailyState(username, date, payload) {
  const dir = path.join(USER_DAILY_STATE_DIR, username);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(userDailyStateFile(username, date), JSON.stringify(payload, null, 2));
}

function normalizeDailyState(state) {
  const value = state && typeof state === "object" ? state : {};
  const weight = Number(value.weightKg);
  const sleep = Number(value.sleepHours);
  const bowel = limitString(value.bowelState, 20);
  const energy = limitString(value.energyState, 20);
  const allowedBowel = ["normal", "none", "loose", "hard"];
  const allowedEnergy = ["good", "ok", "tired"];
  return {
    waterMl: Math.round(clampNumber(value.waterMl, 0, 6000, 0)),
    steps: Math.round(clampNumber(value.steps, 0, 100000, 0)),
    weightKg: Number.isFinite(weight) && weight > 0 ? Number(clampNumber(weight, 30, 250, 0).toFixed(1)) : 0,
    dailyScore: Math.round(clampNumber(value.dailyScore, 0, 100, 0)),
    otterStage: Math.round(clampNumber(value.otterStage, 0, 10, 0)),
    totalScore: Math.round(clampNumber(value.totalScore, 0, 1000000, 0)),
    streakDays: Math.round(clampNumber(value.streakDays, 0, 3650, 0)),
    sleepHours: Number.isFinite(sleep) && sleep > 0 ? Number(clampNumber(sleep, 0, 16, 0).toFixed(1)) : 0,
    bowelState: allowedBowel.includes(bowel) ? bowel : "",
    energyState: allowedEnergy.includes(energy) ? energy : "",
    lastActive: limitString(value.lastActive, 40),
  };
}

function normalizeStoredMeal(meal) {
  const value = meal && typeof meal === "object" ? meal : {};
  return {
    id: limitString(value.id || `meal_${Date.now()}`, 80),
    time: limitString(value.time, 20),
    name: limitString(value.name || value.finalName || "餐點", 80),
    calories: Math.max(0, Math.round(Number(value.calories || value.kcal || 0))),
    protein: Math.max(0, Math.round(Number(value.protein || 0))),
    carbs: Math.max(0, Math.round(Number(value.carbs || 0))),
    fat: Math.max(0, Math.round(Number(value.fat || 0))),
    fiber: Math.max(0, Math.round(Number(value.fiber || 0))),
    sugar: Math.max(0, Math.round(Number(value.sugar || 0))),
    sodium: Math.max(0, Math.round(Number(value.sodium || 0))),
    healthFlags: Array.isArray(value.healthFlags) ? value.healthFlags.map(flag => limitString(flag, 40)).slice(0, 12) : [],
    mealQuality: limitString(value.mealQuality || "unknown", 24),
    photo: limitString(value.photo, 2_500_000),
    photoBefore: limitString(value.photoBefore, 2_500_000),
    photoAfter: limitString(value.photoAfter, 2_500_000),
    beforeCalories: Math.max(0, Math.round(Number(value.beforeCalories || 0))),
    afterCalories: Math.max(0, Math.round(Number(value.afterCalories || 0))),
    consumedCalories: Math.max(0, Math.round(Number(value.consumedCalories || value.calories || value.kcal || 0))),
    consumedRatio: Number(clampNumber(value.consumedRatio, 0, 1, 0).toFixed(2)),
    remainingRatio: Number(clampNumber(value.remainingRatio, 0, 1, 0).toFixed(2)),
    comparisonNote: limitString(value.comparisonNote, 500),
    comparisonReliable: value.comparisonReliable !== false,
    mealSlot: limitString(value.mealSlot, 20),
    placeName: limitString(value.placeName || value.restaurantName, 120),
    restaurantName: limitString(value.restaurantName || value.placeName, 120),
    placeAddress: limitString(value.placeAddress || value.locationName, 200),
    locationName: limitString(value.locationName || value.placeAddress, 200),
    locationLatitude: Number.isFinite(Number(value.locationLatitude ?? value.locationSnapshot?.latitude)) ? Number(value.locationLatitude ?? value.locationSnapshot?.latitude) : null,
    locationLongitude: Number.isFinite(Number(value.locationLongitude ?? value.locationSnapshot?.longitude)) ? Number(value.locationLongitude ?? value.locationSnapshot?.longitude) : null,
    locationAccuracy: Number.isFinite(Number(value.locationAccuracy ?? value.locationSnapshot?.accuracy)) ? Math.max(0, Math.round(Number(value.locationAccuracy ?? value.locationSnapshot?.accuracy))) : null,
    locationCapturedAt: limitString(value.locationCapturedAt || value.locationSnapshot?.capturedAt, 40),
    locationSource: limitString(value.locationSource || value.locationSnapshot?.source, 40),
    placeRating: Math.round(clampNumber(value.placeRating, 0, 5, 0)),
    placeNote: limitString(value.placeNote || value.restaurantNote, 500),
    restaurantNote: limitString(value.restaurantNote || value.placeNote, 500),
    nextAdvice: limitString(value.nextAdvice, 700),
    mealPlan: normalizeStoredMealPlan(value.mealPlan),
    source: limitString(value.source || "manual", 40),
    corrected: Boolean(value.corrected),
    finalCalories: Math.max(0, Math.round(Number(value.finalCalories || value.calories || 0))),
    finalName: limitString(value.finalName || value.name || "餐點", 80),
    items: Array.isArray(value.items) ? value.items.map(normalizeStoredMealItem).slice(0, 12) : [],
    createdAt: limitString(value.createdAt, 40),
    updatedAt: limitString(value.updatedAt, 40),
  };
}

function normalizeStoredMealPlan(plan) {
  const value = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : null;
  if (!value) return null;
  return {
    id: limitString(value.id, 80),
    route: limitString(value.route, 60),
    routeLabel: limitString(value.routeLabel, 120),
    foodName: limitString(value.foodName, 120),
    focus: limitString(value.focus, 80),
    targetKcal: Math.max(0, Math.round(Number(value.targetKcal || 0))),
    mealSlot: limitString(value.mealSlot, 30),
    time: limitString(value.time, 40),
    body: limitString(value.body, 700),
    placeName: limitString(value.placeName, 120),
    placeAddress: limitString(value.placeAddress, 200),
    sourceMealId: limitString(value.sourceMealId, 80),
    sourceDate: limitString(value.sourceDate, 30),
    decisionDetail: normalizeStoredDecisionDetail(value.decisionDetail),
    createdAt: limitString(value.createdAt, 40)
  };
}

function normalizeStoredDecisionDetail(detail) {
  const value = detail && typeof detail === "object" && !Array.isArray(detail) ? detail : null;
  if (!value) return null;
  return {
    why: limitString(value.why, 500),
    photoCheck: limitString(value.photoCheck, 300),
    next: limitString(value.next, 300)
  };
}

function normalizeStoredMealItem(item) {
  const value = item && typeof item === "object" ? item : {};
  return {
    name: limitString(value.name || "品項", 80),
    portion: limitString(value.portion || "份量未明", 80),
    calories: Math.max(0, Math.round(Number(value.calories || 0))),
    protein: Math.max(0, Math.round(Number(value.protein || 0))),
    carbs: Math.max(0, Math.round(Number(value.carbs || 0))),
    fat: Math.max(0, Math.round(Number(value.fat || 0))),
    fiber: Math.max(0, Math.round(Number(value.fiber || 0))),
    sugar: Math.max(0, Math.round(Number(value.sugar || 0))),
    sodium: Math.max(0, Math.round(Number(value.sodium || 0))),
  };
}

function limitString(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeUserProfile(profile) {
  const goal = ["slim", "fitness", "maintain", "healthy", "gain"].includes(profile.goal) ? profile.goal : "slim";
  return {
    heightCm: clampNumber(profile.heightCm, 140, 220, 170),
    weightKg: clampNumber(profile.weightKg, 35, 180, 75),
    calorieTarget: Math.round(clampNumber(profile.calorieTarget, 1000, 4000, 1750)),
    goal,
  };
}

function readUserProfiles() {
  try {
    if (!fs.existsSync(USER_PROFILE_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(USER_PROFILE_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeUserProfiles(profiles) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USER_PROFILE_FILE, JSON.stringify(profiles, null, 2));
}

function safeReadText(fileName) {
  try {
    return fs.readFileSync(path.join(ROOT, fileName), "utf8");
  } catch {
    return "";
  }
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim();
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeAnalysis(analysis) {
  const items = Array.isArray(analysis.items) ? analysis.items : [];
  const normalizedItems = items.map((item) => ({
    name: String(item.name || "餐點"),
    portion: String(item.portion || "份量未明"),
    calories: Math.max(0, Math.round(Number(item.calories || item.kcal || 0))),
    protein: Math.max(0, Math.round(Number(item.protein || item.protein_g || 0))),
    carbs: Math.max(0, Math.round(Number(item.carbs || item.carbs_g || 0))),
    fat: Math.max(0, Math.round(Number(item.fat || item.fat_g || 0))),
    fiber: Math.max(0, Math.round(Number(item.fiber ?? item.fiber_g ?? estimateFiberByName(item.name)))),
    sugar: Math.max(0, Math.round(Number(item.sugar ?? item.sugar_g ?? estimateSugarByName(item.name)))),
    sodium: Math.max(0, Math.round(Number(item.sodium ?? item.sodium_mg ?? estimateSodiumByName(item.name)))),
  }));
  const total = Number(analysis.total_calories || analysis.total_kcal || normalizedItems.reduce((sum, item) => sum + item.calories, 0) || 0);
  const confidence = typeof analysis.confidence === "string"
    ? analysis.confidence
    : numericConfidenceLabel(Number(analysis.confidence || 0.65));
  const flags = normalizeHealthFlags(analysis.health_flags, normalizedItems, total);
  return {
    total_calories: Math.max(0, Math.round(total)),
    total_protein: Math.max(0, Math.round(Number(analysis.total_protein || analysis.protein_g || normalizedItems.reduce((sum, item) => sum + item.protein, 0)))),
    total_carbs: Math.max(0, Math.round(Number(analysis.total_carbs || analysis.carbs_g || normalizedItems.reduce((sum, item) => sum + item.carbs, 0)))),
    total_fat: Math.max(0, Math.round(Number(analysis.total_fat || analysis.fat_g || normalizedItems.reduce((sum, item) => sum + item.fat, 0)))),
    total_fiber: Math.max(0, Math.round(Number(analysis.total_fiber || analysis.fiber_g || normalizedItems.reduce((sum, item) => sum + item.fiber, 0)))),
    total_sugar: Math.max(0, Math.round(Number(analysis.total_sugar || analysis.sugar_g || normalizedItems.reduce((sum, item) => sum + item.sugar, 0)))),
    total_sodium: Math.max(0, Math.round(Number(analysis.total_sodium || analysis.sodium_mg || normalizedItems.reduce((sum, item) => sum + item.sodium, 0)))),
    meal_quality: normalizeMealQuality(analysis.meal_quality, flags, total),
    health_flags: flags,
    confidence,
    notes: String(analysis.notes || analysis.advice || "先確認食物明細，沒問題再儲存這餐。"),
    items: normalizedItems.length ? normalizedItems : [{ name: "照片餐點", portion: "份量未明", calories: Math.max(0, Math.round(total)), protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }],
  };
}

function estimateFiberByName(name) {
  const text = String(name || "");
  let fiber = 0;
  if (/[沙拉生菜青菜蔬菜菠菜花椰菜菇菇瓜海帶紫菜]/.test(text)) fiber += 5;
  if (/[地瓜番薯南瓜玉米燕麥糙米全穀雜糧豆腐豆干豆類紅豆綠豆]/.test(text)) fiber += 4;
  if (/[水果蘋果香蕉芭樂莓奇異果]/.test(text)) fiber += 3;
  return Math.min(12, fiber);
}

function estimateSugarByName(name) {
  const text = String(name || "").toLowerCase();
  if (/可樂|cola|coke|汽水|奶茶|手搖|果汁|甜點|蛋糕|冰淇淋/.test(text)) return 28;
  if (/水果|香蕉|蘋果|芭樂|莓|奇異果/.test(text)) return 10;
  return 0;
}

function estimateSodiumByName(name) {
  const text = String(name || "");
  if (/[泡麵拉麵牛肉麵鍋火鍋麻辣滷味鹹酥雞炸雞薯條泡菜]/.test(text)) return 900;
  if (/[湯羹醬滷]/.test(text)) return 500;
  return 250;
}

function normalizeHealthFlags(sourceFlags, items, totalCalories) {
  const flags = new Set();
  if (Array.isArray(sourceFlags)) {
    sourceFlags.map(String).forEach((flag) => {
      const normalized = flag.toLowerCase();
      if (normalized.includes("sugar")) flags.add("sugary");
      else if (normalized.includes("sodium") || normalized.includes("salt")) flags.add("high_sodium");
      else if (normalized.includes("fried") || normalized.includes("fat")) flags.add("fried_or_high_fat");
      else flags.add(flag);
    });
  }
  const text = items.map((item) => item.name).join(" ");
  const totalSugar = items.reduce((sum, item) => sum + item.sugar, 0);
  const totalSodium = items.reduce((sum, item) => sum + item.sodium, 0);
  const totalFat = items.reduce((sum, item) => sum + item.fat, 0);
  if (/[炸薯條鹹酥雞炸雞天婦羅]/.test(text) || totalFat >= 35) flags.add("fried_or_high_fat");
  if (/[可樂汽水奶茶手搖果汁甜點蛋糕]/.test(text) || totalSugar >= 25) flags.add("sugary");
  if (/[泡麵拉麵火鍋麻辣滷味泡菜]/.test(text) || totalSodium >= 900) flags.add("high_sodium");
  if (/[沙拉青菜蔬菜地瓜糙米全穀豆]/.test(text)) flags.add("fiber_source");
  if (totalCalories >= 850) flags.add("heavy_meal");
  return [...flags];
}

function inferMealQuality(flags, totalCalories) {
  if (flags.includes("sugary")) return "sugary";
  if (flags.includes("high_sodium")) return "salty";
  if (flags.includes("fried_or_high_fat")) return "fried";
  if (flags.includes("heavy_meal") || totalCalories >= 850) return "heavy";
  if (flags.includes("fiber_source")) return "balanced";
  return "unknown";
}

function normalizeMealQuality(value, flags, totalCalories) {
  const quality = String(value || "").toLowerCase();
  const allowed = ["balanced", "light", "heavy", "sugary", "salty", "fried", "unknown"];
  if (allowed.includes(quality)) return quality;
  return inferMealQuality(flags, totalCalories) || "unknown";
}

function publicAnalysis(analysis) {
  const value = analysis && typeof analysis === "object" ? analysis : {};
  const items = Array.isArray(value.items) ? value.items : [];
  const calories = Math.max(0, Math.round(Number(value.calories ?? value.total_calories ?? value.total_kcal ?? 0)));
  const protein = Math.max(0, Math.round(Number(value.protein ?? value.total_protein ?? value.protein_g ?? 0)));
  const carbs = Math.max(0, Math.round(Number(value.carbs ?? value.total_carbs ?? value.carbs_g ?? 0)));
  const fat = Math.max(0, Math.round(Number(value.fat ?? value.total_fat ?? value.fat_g ?? 0)));
  const fiber = Math.max(0, Math.round(Number(value.fiber ?? value.total_fiber ?? value.fiber_g ?? 0)));
  const sugar = Math.max(0, Math.round(Number(value.sugar ?? value.total_sugar ?? value.sugar_g ?? 0)));
  const sodium = Math.max(0, Math.round(Number(value.sodium ?? value.total_sodium ?? value.sodium_mg ?? 0)));
  const detectedFood = limitString(value.detectedFood || items.map((item) => item.name).filter(Boolean).join("、"), 200);
  return {
    ...value,
    name: limitString(value.name || value.meal_name || detectedFood || "餐點估算", 80),
    detectedFood,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    total_calories: calories,
    total_protein: protein,
    total_carbs: carbs,
    total_fat: fat,
    total_fiber: fiber,
    total_sugar: sugar,
    total_sodium: sodium,
  };
}

function ensureUsefulAnalysis(analysis, mealText, provider, scenario = "") {
  const textEstimate = estimateMealTextServer(mealText);
  const isAfterMeal = /after|\u9910\u5f8c|\u5269\u9918|\u5403\u5b8c|\u98ef\u5f8c/i.test(String(scenario || ""));
  if (!isAfterMeal && textEstimate && textEstimate.confidence !== "low") {
    return {
      ...normalizeAnalysis(textEstimate),
      provider: `${provider}_text_assist`,
      notes: textEstimate.notes || analysis.notes || "Text-assisted estimate was used."
    };
  }
  const usefulItems = (analysis.items || []).filter((item) => {
    const name = String(item.name || "");
    return name && name !== "食物名稱" && name !== "餐點";
  });
  if (analysis.total_calories > 0 && usefulItems.length) {
    return { ...analysis, provider };
  }
  if (!textEstimate) return { ...analysis, provider };
  return {
    ...normalizeAnalysis(textEstimate),
    provider: `${provider}_text_assist`,
    notes: `${analysis.notes || "AI 影像辨識不確定。"} 已依補充文字保守估算。`
  };
}

function estimateMealTextServer(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const explicitRules = [
    { pattern: /(\u7121\u7cd6|\u96f6\u5361|zero).*(\u53ef\u6a02|coca|cola|coke)|(\u53ef\u6a02|coca|cola|coke).*(\u7121\u7cd6|\u96f6\u5361|zero)/i, name: "無糖可樂", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 40, flags: [], quality: "light" },
    { pattern: /(\u53ef\u6a02|coca|cola|coke)/i, name: "可樂", calories: 140, protein: 0, carbs: 35, fat: 0, fiber: 0, sugar: 35, sodium: 45, flags: ["sugary"], quality: "sugary" },
    { pattern: /(\u6ce1\u83dc|\u97d3\u5f0f).*(\u6e6f|\u934b)|\u6ce1\u83dc\u6e6f/i, name: "泡菜湯", calories: 260, protein: 18, carbs: 16, fat: 12, fiber: 3, sugar: 5, sodium: 1200, flags: ["high_sodium"], quality: "salty" },
    { pattern: /\u5473\u564c\u6e6f/i, name: "味噌湯", calories: 90, protein: 6, carbs: 8, fat: 3, fiber: 2, sugar: 3, sodium: 850, flags: ["high_sodium"], quality: "salty" },
    { pattern: /(\u852c\u83dc|\u9752\u83dc).*\u6e6f/i, name: "蔬菜湯", calories: 120, protein: 5, carbs: 18, fat: 3, fiber: 5, sugar: 6, sodium: 550, flags: ["fiber_source"], quality: "balanced" },
    { pattern: /\u725b\u8089\u6e6f/i, name: "牛肉湯", calories: 320, protein: 28, carbs: 8, fat: 18, fiber: 1, sugar: 2, sodium: 900, flags: ["high_sodium"], quality: "salty" },
    { pattern: /\u96de\u6e6f/i, name: "雞湯", calories: 260, protein: 24, carbs: 6, fat: 14, fiber: 1, sugar: 2, sodium: 750, flags: [], quality: "balanced" },
    { pattern: /\u6e6f/i, name: raw, calories: 220, protein: 12, carbs: 14, fat: 10, fiber: 2, sugar: 3, sodium: 750, flags: [], quality: "balanced" }
  ];
  const explicit = explicitRules.find((rule) => rule.pattern.test(raw));
  if (explicit) {
    return {
      total_calories: explicit.calories,
      total_protein: explicit.protein,
      total_carbs: explicit.carbs,
      total_fat: explicit.fat,
      total_fiber: explicit.fiber,
      total_sugar: explicit.sugar,
      total_sodium: explicit.sodium,
      meal_quality: explicit.quality,
      health_flags: explicit.flags,
      confidence: "medium",
      notes: "已依補充文字快速估算，請依實際份量微調。",
      items: [{
        name: explicit.name,
        portion: "約 1 份",
        calories: explicit.calories,
        protein: explicit.protein,
        carbs: explicit.carbs,
        fat: explicit.fat,
        fiber: explicit.fiber,
        sugar: explicit.sugar,
        sodium: explicit.sodium
      }]
    };
  }
  const rules = [
    { keys: ["可樂", "coca", "cola", "coke", "汽水"], calories: 140, protein: 0, carbs: 35, fat: 0 },
    { keys: ["零卡", "zero", "無糖可樂"], calories: 0, protein: 0, carbs: 0, fat: 0 },
    { keys: ["炒飯"], calories: 650, protein: 18, carbs: 90, fat: 22 },
    { keys: ["白飯", "飯"], calories: 280, protein: 5, carbs: 62, fat: 1 },
    { keys: ["青菜", "蔬菜"], calories: 70, protein: 4, carbs: 12, fat: 1 },
    { keys: ["冬瓜湯", "清湯", "蔬菜湯"], calories: 90, protein: 4, carbs: 10, fat: 3 },
    { keys: ["牛肉湯", "排骨湯", "雞湯"], calories: 260, protein: 20, carbs: 8, fat: 16 },
    { keys: ["啤酒"], calories: 150, protein: 1, carbs: 13, fat: 0 }
  ];
  const matched = rules.filter((rule) => rule.keys.some((key) => lower.includes(key.toLowerCase()) || raw.includes(key)));
  if (!matched.length) {
    return {
      total_calories: 420,
      total_protein: 16,
      total_carbs: 48,
      total_fat: 16,
      confidence: "low",
      notes: "AI 影像辨識不確定，已依補充文字使用一般餐點保守估算；請依實際份量微調。",
      items: [{ name: raw, portion: "約 1 份", calories: 420, protein: 16, carbs: 48, fat: 16 }]
    };
  }
  const total = matched.reduce((sum, rule) => sum + rule.calories, 0);
  const protein = matched.reduce((sum, rule) => sum + rule.protein, 0);
  const carbs = matched.reduce((sum, rule) => sum + rule.carbs, 0);
  const fat = matched.reduce((sum, rule) => sum + rule.fat, 0);
  return {
    total_calories: total,
    total_protein: protein,
    total_carbs: carbs,
    total_fat: fat,
    confidence: "medium",
    notes: "依補充文字與常見份量保守估算；實際份量可再微調。",
    items: matched.map((rule) => ({
      name: rule.keys[0],
      portion: "約 1 份",
      calories: rule.calories,
      protein: rule.protein,
      carbs: rule.carbs,
      fat: rule.fat
    }))
  };
}

function numericConfidenceLabel(value) {
  const clamped = clamp(value, 0, 1);
  if (clamped >= 0.8) return "high";
  if (clamped >= 0.55) return "medium";
  return "low";
}

function friendlyOpenAiError(message) {
  const text = String(message || "");
  if (/quota|billing|exceeded|insufficient|plan/i.test(text)) {
    return "AI 額度暫時不足，已改用本機估算，請依實際份量微調。";
  }
  if (/timeout|abort/i.test(text)) {
    return "AI 辨識時間較長，已改用本機估算，請依實際份量微調。";
  }
  if (/api[_ -]?key|configured|unauthorized/i.test(text)) {
    return "AI 服務尚未設定，已改用本機估算，請依實際份量微調。";
  }
  return "AI 暫時無法估算，已改用本機估算，請依實際份量微調。";
}

function buildServerFallbackMeal(mealText, provider = "local_fallback", note = "AI 暫時不穩，已先用本機規則估算。") {
  const estimate = normalizeAnalysis(estimateMealTextServer(mealText) || estimateMealTextServer("一般餐點"));
  return publicAnalysis({
    ...estimate,
    provider,
    notes: `${note} ${estimate.notes || ""}`.trim()
  });
}

function shouldUseFastTextEstimate(mealText, scenario = "") {
  const text = String(mealText || "");
  if (!text.trim()) return false;
  if (/餐後|剩餘|after/i.test(String(scenario || ""))) return false;
  return /(zero|cola|coke|beer|soup|無糖|零卡|可樂|汽水|啤酒|湯|羹|鍋|飯|麵|便當|沙拉|水餃|餃子)/i.test(text);
}

function estimateMealTextServer(text) {
  const raw = String(text || "").trim();
  const label = raw || "照片待確認餐點";
  const lower = label.toLowerCase();
  const rules = [
    { pattern: /(zero|無糖|零卡).*(可樂|coca|cola|coke)|(可樂|coca|cola|coke).*(zero|無糖|零卡)/i, name: "零卡可樂", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 40, flags: [], quality: "light", portion: "約 1 罐" },
    { pattern: /(可樂|coca|cola|coke|汽水)/i, name: "可樂", calories: 140, protein: 0, carbs: 35, fat: 0, fiber: 0, sugar: 35, sodium: 45, flags: ["sugary"], quality: "sugary", portion: "約 1 罐 330ml" },
    { pattern: /(啤酒|beer)/i, name: "啤酒", calories: 150, protein: 1, carbs: 13, fat: 0, fiber: 0, sugar: 1, sodium: 15, flags: [], quality: "light", portion: "約 1 罐 330ml" },
    { pattern: /(冬瓜湯|蘿蔔湯|海帶湯|紫菜湯|清湯|青菜湯|蔬菜湯|菇湯|菇菇湯)/i, name: label, calories: 90, protein: 4, carbs: 10, fat: 3, fiber: 3, sugar: 4, sodium: 550, flags: ["fiber_source"], quality: "balanced", portion: "約 1 碗" },
    { pattern: /(味噌湯|豆腐湯|蛋花湯|貢丸湯|魚丸湯)/i, name: label, calories: 150, protein: 9, carbs: 10, fat: 7, fiber: 2, sugar: 3, sodium: 850, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗" },
    { pattern: /(雞湯|排骨湯|牛肉湯|羊肉湯|肉湯)/i, name: label, calories: 260, protein: 22, carbs: 8, fat: 16, fiber: 1, sugar: 2, sodium: 850, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗" },
    { pattern: /(酸辣湯|羹|勾芡)/i, name: label, calories: 230, protein: 10, carbs: 24, fat: 10, fiber: 2, sugar: 4, sodium: 900, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗" },
    { pattern: /(濃湯|玉米濃湯|南瓜濃湯|奶油|起司)/i, name: label, calories: 320, protein: 9, carbs: 28, fat: 18, fiber: 3, sugar: 8, sodium: 750, flags: ["fried_or_high_fat"], quality: "fried", portion: "約 1 碗" },
    { pattern: /(火鍋|麻辣鍋|麻辣湯|鍋)/i, name: label, calories: 520, protein: 24, carbs: 28, fat: 34, fiber: 4, sugar: 5, sodium: 1500, flags: ["high_sodium", "fried_or_high_fat"], quality: "salty", portion: "約 1 份" },
    { pattern: /(滷肉飯|魯肉飯)/i, name: label, calories: 520, protein: 16, carbs: 72, fat: 18, fiber: 2, sugar: 4, sodium: 850, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗" },
    { pattern: /(白飯|米飯)/i, name: label, calories: 280, protein: 5, carbs: 62, fat: 1, fiber: 1, sugar: 0, sodium: 0, flags: [], quality: "light", portion: "約 1 碗" },
    { pattern: /(炒飯)/i, name: label, calories: 720, protein: 24, carbs: 88, fat: 28, fiber: 4, sugar: 3, sodium: 1100, flags: ["high_sodium", "fried_or_high_fat"], quality: "fried", portion: "約 1 盤" },
    { pattern: /(便當|排骨便當|雞腿便當)/i, name: label, calories: 760, protein: 32, carbs: 88, fat: 28, fiber: 5, sugar: 8, sodium: 1200, flags: ["high_sodium"], quality: "heavy", portion: "約 1 份" },
    { pattern: /(牛肉麵|拉麵|乾麵|麵)/i, name: label, calories: 650, protein: 26, carbs: 86, fat: 22, fiber: 4, sugar: 4, sodium: 1400, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗" },
    { pattern: /(沙拉|生菜)/i, name: label, calories: 320, protein: 18, carbs: 28, fat: 15, fiber: 7, sugar: 8, sodium: 450, flags: ["fiber_source"], quality: "balanced", portion: "約 1 份" }
  ];
  const matched = rules.find((rule) => rule.pattern.test(label) || rule.pattern.test(lower));
  const rule = matched || { name: label, calories: 430, protein: 18, carbs: 48, fat: 15, fiber: 3, sugar: 6, sodium: 650, flags: [], quality: "unknown", portion: "約 1 份" };
  return {
    total_calories: rule.calories,
    total_protein: rule.protein,
    total_carbs: rule.carbs,
    total_fat: rule.fat,
    total_fiber: rule.fiber,
    total_sugar: rule.sugar,
    total_sodium: rule.sodium,
    meal_quality: rule.quality,
    health_flags: rule.flags,
    confidence: matched ? "medium" : "low",
    notes: matched ? "已依餐點名稱與常見份量先估；實際份量不同可再微調。" : "照片已讀取，但目前缺少明確餐名；先用一般一份餐點保守估算。",
    items: [{
      name: rule.name,
      portion: rule.portion,
      calories: rule.calories,
      protein: rule.protein,
      carbs: rule.carbs,
      fat: rule.fat,
      fiber: rule.fiber,
      sugar: rule.sugar,
      sodium: rule.sodium
    }]
  };
}

function friendlyOpenAiError(message) {
  const text = String(message || "");
  if (/quota|billing|exceeded|insufficient|plan/i.test(text)) return "AI 額度暫時不足，已先用本機規則估算。";
  if (/timeout|abort/i.test(text)) return "AI 辨識時間較長，已先用本機規則估算。";
  if (/api[_ -]?key|configured|unauthorized/i.test(text)) return "AI 服務尚未完成設定，已先用本機規則估算。";
  return "AI 暫時不穩，已先用本機規則估算。";
}

function shouldUseFastTextEstimate(mealText, scenario = "") {
  const text = String(mealText || "").trim();
  if (!text) return false;
  if (/after|餐後|飯後|剩餘/i.test(String(scenario || ""))) return false;
  return /(zero|cola|coke|beer|soup|可樂|零卡|無糖|啤酒|湯|鍋|冬瓜|泡菜|味噌|雞湯|牛肉湯|炒飯|白飯|便當|滷肉飯|沙拉|飲料)/i.test(text);
}

function estimateMealTextServer(text) {
  const raw = String(text || "").trim();
  const label = raw || "照片餐點估算";
  const rules = [
    { pattern: /(無糖|零卡|zero).*(可樂|coca|cola|coke)|(可樂|coca|cola|coke).*(無糖|零卡|zero)/i, name: "零卡可樂", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 40, flags: [], quality: "light", portion: "約 1 罐 330ml" },
    { pattern: /(可樂|coca|cola|coke)/i, name: "可樂", calories: 140, protein: 0, carbs: 35, fat: 0, fiber: 0, sugar: 35, sodium: 45, flags: ["sugary"], quality: "sugary", portion: "約 1 罐 330ml" },
    { pattern: /(啤酒|beer)/i, name: "啤酒", calories: 150, protein: 1, carbs: 13, fat: 0, fiber: 0, sugar: 1, sodium: 15, flags: [], quality: "light", portion: "約 1 罐 330ml" },
    { pattern: /(冬瓜湯|蔬菜湯|青菜湯|海帶湯|蘿蔔湯)/i, name: label, calories: 90, protein: 4, carbs: 10, fat: 3, fiber: 3, sugar: 4, sodium: 550, flags: ["fiber_source"], quality: "balanced", portion: "約 1 碗" },
    { pattern: /(泡菜湯|韓式泡菜湯|泡菜鍋|韓式鍋)/i, name: "韓式泡菜湯", calories: 430, protein: 22, carbs: 28, fat: 24, fiber: 4, sugar: 7, sodium: 1500, flags: ["high_sodium"], quality: "salty", portion: "約 1 份" },
    { pattern: /(味噌湯|豆腐湯|昆布湯|蛤蜊湯)/i, name: label, calories: 150, protein: 9, carbs: 10, fat: 7, fiber: 2, sugar: 3, sodium: 850, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗" },
    { pattern: /(雞湯|牛肉湯|排骨湯|魚湯)/i, name: label, calories: 260, protein: 22, carbs: 8, fat: 16, fiber: 1, sugar: 2, sodium: 850, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗" },
    { pattern: /(湯|鍋)/i, name: label, calories: 220, protein: 12, carbs: 14, fat: 10, fiber: 2, sugar: 3, sodium: 750, flags: [], quality: "balanced", portion: "約 1 碗" },
    { pattern: /(炒飯)/i, name: label, calories: 720, protein: 24, carbs: 88, fat: 28, fiber: 4, sugar: 3, sodium: 1100, flags: ["high_sodium", "fried_or_high_fat"], quality: "fried", portion: "約 1 盤" },
    { pattern: /(白飯|米飯)/i, name: label, calories: 280, protein: 5, carbs: 62, fat: 1, fiber: 1, sugar: 0, sodium: 0, flags: [], quality: "light", portion: "約 1 碗" },
    { pattern: /(便當|雞腿飯|排骨飯|燒肉飯)/i, name: label, calories: 760, protein: 32, carbs: 88, fat: 28, fiber: 5, sugar: 8, sodium: 1200, flags: ["high_sodium"], quality: "heavy", portion: "約 1 份" },
    { pattern: /(沙拉|蔬菜)/i, name: label, calories: 320, protein: 18, carbs: 28, fat: 15, fiber: 7, sugar: 8, sodium: 450, flags: ["fiber_source"], quality: "balanced", portion: "約 1 份" },
  ];
  const matched = rules.find((rule) => rule.pattern.test(label));
  const rule = matched || { name: label, calories: 430, protein: 18, carbs: 48, fat: 15, fiber: 3, sugar: 6, sodium: 650, flags: [], quality: "unknown", portion: "約 1 份" };
  return {
    total_calories: rule.calories,
    total_protein: rule.protein,
    total_carbs: rule.carbs,
    total_fat: rule.fat,
    total_fiber: rule.fiber,
    total_sugar: rule.sugar,
    total_sodium: rule.sodium,
    meal_quality: rule.quality,
    health_flags: rule.flags,
    confidence: matched ? "medium" : "low",
    notes: matched ? "已依餐點名稱與常見份量先估；實際份量不同可再微調。" : "未命中明確餐點規則，先以一般餐點保守估算；可再補充份量或改名。",
    items: [{
      name: rule.name,
      portion: rule.portion,
      calories: rule.calories,
      protein: rule.protein,
      carbs: rule.carbs,
      fat: rule.fat,
      fiber: rule.fiber,
      sugar: rule.sugar,
      sodium: rule.sodium
    }]
  };
}

function friendlyOpenAiError(message) {
  const text = String(message || "");
  if (/quota|billing|exceeded|insufficient|plan/i.test(text)) return "AI 額度暫時不足，已改用本機估算，請依實際份量微調。";
  if (/timeout|abort/i.test(text)) return "AI 辨識時間較長，已先用本機規則估算。";
  if (/api[_ -]?key|configured|unauthorized/i.test(text)) return "AI 服務尚未完成設定，已先用本機規則估算。";
  return "AI 暫時不穩，已先用本機規則估算。";
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function shouldUseFastTextEstimate(mealText, scenario = "") {
  const text = String(mealText || "").trim();
  if (!text) return false;
  if (/after|飯後|吃完|剩餘/i.test(String(scenario || ""))) return false;
  return /(zero|cola|coke|coca|beer|soup|可樂|汽水|零卡|無糖|啤酒|檸檬片|飲料|罐|湯|羹|鍋|冬瓜|泡菜|味噌|雞湯|牛肉湯|炒飯|白飯|便當|滷肉飯|沙拉)/i.test(text);
}

function estimateMealTextServer(text) {
  const raw = String(text || "").trim();
  const label = raw || "照片餐點估算";
  const rules = [
    { pattern: /(無糖|零卡|zero).*(可樂|coca|cola|coke)|(可樂|coca|cola|coke).*(無糖|零卡|zero)/i, name: "零卡可樂", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 40, flags: [], quality: "light", portion: "約 1 罐 330ml", notes: "偵測到零卡可樂關鍵字，飲料熱量以 0 kcal 估算。" },
    { pattern: /(可樂|coca|cola|coke|汽水)/i, name: "可樂", calories: 140, protein: 0, carbs: 35, fat: 0, fiber: 0, sugar: 35, sodium: 45, flags: ["sugary"], quality: "sugary", portion: "約 1 罐 330ml", notes: "偵測到可樂/汽水，避免落入固定 520 kcal，用常見 330ml 罐裝估算。" },
    { pattern: /(啤酒|beer|啤酒.*檸檬片|檸檬片.*啤酒)/i, name: "啤酒", calories: 150, protein: 1, carbs: 13, fat: 0, fiber: 0, sugar: 1, sodium: 15, flags: [], quality: "light", portion: "約 1 罐 330ml", notes: "偵測到啤酒/檸檬片時視為飲料，不套用一般餐點 520 kcal。" },
    { pattern: /(冬瓜湯|蘿蔔湯|海帶湯|紫菜湯|清湯|青菜湯|蔬菜湯|菇湯|菇菇湯)/i, name: label, calories: 90, protein: 4, carbs: 10, fat: 3, fiber: 3, sugar: 4, sodium: 550, flags: ["fiber_source"], quality: "balanced", portion: "約 1 碗", notes: "清湯/蔬菜湯以常見一碗 300-450ml 估算。" },
    { pattern: /(泡菜湯|韓式泡菜湯|泡菜鍋|韓式鍋)/i, name: "韓式泡菜湯", calories: 430, protein: 22, carbs: 28, fat: 24, fiber: 4, sugar: 7, sodium: 1500, flags: ["high_sodium"], quality: "salty", portion: "約 1 份", notes: "泡菜湯/韓式鍋鈉較高，料多時以一份熱食估算。" },
    { pattern: /(味噌湯|豆腐湯|蛋花湯|貢丸湯|魚丸湯|昆布湯|蛤蜊湯)/i, name: label, calories: 150, protein: 9, carbs: 10, fat: 7, fiber: 2, sugar: 3, sodium: 850, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗", notes: "一般含蛋白湯品以一碗估算，鈉偏高需提醒。" },
    { pattern: /(雞湯|排骨湯|牛肉湯|羊肉湯|肉湯|魚湯)/i, name: label, calories: 260, protein: 22, carbs: 8, fat: 16, fiber: 1, sugar: 2, sodium: 850, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗", notes: "肉湯類會估算湯料熱量，不再回傳 0 kcal。" },
    { pattern: /(酸辣湯|羹|勾芡)/i, name: label, calories: 230, protein: 10, carbs: 24, fat: 10, fiber: 2, sugar: 4, sodium: 900, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗", notes: "羹湯含勾芡，碳水與鈉較高。" },
    { pattern: /(濃湯|玉米濃湯|南瓜濃湯|奶油|起司)/i, name: label, calories: 320, protein: 9, carbs: 28, fat: 18, fiber: 3, sugar: 8, sodium: 750, flags: ["fried_or_high_fat"], quality: "fried", portion: "約 1 碗", notes: "濃湯以 200-400 kcal 範圍保守估算。" },
    { pattern: /(火鍋|麻辣鍋|麻辣湯|鍋)/i, name: label, calories: 520, protein: 24, carbs: 28, fat: 34, fiber: 4, sugar: 5, sodium: 1500, flags: ["high_sodium", "fried_or_high_fat"], quality: "salty", portion: "約 1 份", notes: "鍋物依料與湯底估算；湯底喝越多，鈉越高。" },
    { pattern: /(炒飯)/i, name: label, calories: 720, protein: 24, carbs: 88, fat: 28, fiber: 4, sugar: 3, sodium: 1100, flags: ["high_sodium", "fried_or_high_fat"], quality: "fried", portion: "約 1 盤", notes: "炒飯以一盤常見外食份量估算。" },
    { pattern: /(白飯|米飯)/i, name: label, calories: 280, protein: 5, carbs: 62, fat: 1, fiber: 1, sugar: 0, sodium: 0, flags: [], quality: "light", portion: "約 1 碗", notes: "白飯以一碗熟飯估算。" },
    { pattern: /(便當|雞腿便當|雞胸便當|排骨便當)/i, name: label, calories: 760, protein: 32, carbs: 88, fat: 28, fiber: 5, sugar: 8, sodium: 1200, flags: ["high_sodium"], quality: "heavy", portion: "約 1 份", notes: "便當以一份外食估算，仍建議拍照依菜量校正。" },
    { pattern: /(滷肉飯|魯肉飯)/i, name: label, calories: 520, protein: 16, carbs: 72, fat: 18, fiber: 2, sugar: 4, sodium: 850, flags: ["high_sodium"], quality: "salty", portion: "約 1 碗", notes: "滷肉飯以一碗估算。" },
    { pattern: /(沙拉|蔬菜)/i, name: label, calories: 320, protein: 18, carbs: 28, fat: 15, fiber: 7, sugar: 8, sodium: 450, flags: ["fiber_source"], quality: "balanced", portion: "約 1 份", notes: "沙拉熱量主要看蛋白質與醬料，這裡用中間值估算。" },
  ];
  const matched = rules.find((rule) => rule.pattern.test(label));
  const rule = matched || { name: label, calories: 430, protein: 18, carbs: 48, fat: 15, fiber: 3, sugar: 6, sodium: 650, flags: [], quality: "unknown", portion: "約 1 份", notes: "無明確品項時先用一般餐點保守估算，請輸入餐點名稱或份量修正。" };
  return {
    total_calories: rule.calories,
    total_protein: rule.protein,
    total_carbs: rule.carbs,
    total_fat: rule.fat,
    total_fiber: rule.fiber,
    total_sugar: rule.sugar,
    total_sodium: rule.sodium,
    meal_quality: rule.quality,
    health_flags: rule.flags,
    confidence: matched ? "medium" : "low",
    notes: rule.notes,
    items: [{
      name: rule.name,
      portion: rule.portion,
      calories: rule.calories,
      protein: rule.protein,
      carbs: rule.carbs,
      fat: rule.fat,
      fiber: rule.fiber,
      sugar: rule.sugar,
      sodium: rule.sodium
    }]
  };
}

function ensureUsefulAnalysis(analysis, mealText, provider, scenario = "") {
  const textEstimate = estimateMealTextServer(mealText);
  const isAfterMeal = /after|\u9910\u5f8c|\u5269\u9918|\u5403\u5b8c|\u98ef\u5f8c/i.test(String(scenario || ""));
  if (!isAfterMeal && textEstimate && textEstimate.confidence !== "low") {
    return {
      ...normalizeAnalysis(textEstimate),
      provider: `${provider}_text_assist`,
      notes: textEstimate.notes || analysis.notes || "文字輔助估算已覆蓋不穩定 AI 結果。"
    };
  }
  const normalized = normalizeAnalysis(analysis || {});
  const corrected = normalizeUnstableVisualEstimate(normalized, provider);
  if (corrected) return corrected;
  const usefulItems = (normalized.items || []).filter((item) => {
    const name = String(item.name || "");
    return name && !/照片餐點|食物名稱|餐點估算|unknown/i.test(name);
  });
  if (normalized.total_calories > 0 && usefulItems.length) return { ...normalized, provider };
  return {
    ...normalizeAnalysis(textEstimate || estimateMealTextServer("照片餐點估算")),
    provider: `${provider}_fallback`,
    notes: "AI 這次沒有給出可用食物名稱，已改用保守估算；請輸入餐點名稱可再估一次。"
  };
}

function normalizeUnstableVisualEstimate(analysis, provider) {
  const text = (analysis.items || []).map((item) => item.name).join(" ");
  const total = Number(analysis.total_calories || 0);
  const hasDrinkSignal = /(可樂|cola|coke|coca|汽水|啤酒|beer|飲料|檸檬片|lemon|lime)/i.test(text);
  if (hasDrinkSignal && total > 280) {
    const looksBeer = /(啤酒|beer)/i.test(text);
    const drink = normalizeAnalysis(estimateMealTextServer(looksBeer ? "啤酒" : "可樂"));
    return {
      ...drink,
      provider: `${provider}_drink_guard`,
      confidence: "medium",
      notes: "AI 看起來像飲料罐但熱量高到像正餐，已用飲料罐防呆估算，避免固定 520 kcal。"
    };
  }
  const genericPhotoOnly = /照片餐點|食物名稱|餐點估算|unknown/i.test(text) || !(analysis.items || []).length;
  if (genericPhotoOnly && (!total || total === 520)) {
    return {
      ...normalizeAnalysis(estimateMealTextServer("照片餐點估算")),
      provider: `${provider}_generic_guard`,
      confidence: "low",
      notes: "AI 沒有看出明確食物，先不使用固定 520 kcal；請補餐點名稱可重估。"
    };
  }
  return null;
}

// v76 stable final overrides. These clean rules intentionally live at the end of
// the file so older mojibake rules cannot override core calorie estimates.
function shouldUseFastTextEstimate(mealText, scenario = "") {
  const text = String(mealText || "").trim();
  if (!text) return false;
  if (/after|\u9910\u5f8c|\u5269\u9918|\u5403\u5b8c/i.test(String(scenario || ""))) return false;
  return /(zero|cola|coke|coca|beer|soup|latte|\u7121\u7cd6|\u96f6\u5361|\u53ef\u6a02|\u6c7d\u6c34|\u5564\u9152|\u62ff\u9435|\u624b\u6416|\u73cd\u5976|\u6e6f|\u6e6f|\u7fb9|\u934b|\u98ef|\u4fbf\u7576|\u7092\u98ef|\u9eb5|\u6c99\u62c9)/i.test(text);
}

function estimateMealTextServer(text) {
  const raw = String(text || "").trim();
  const label = raw || "\u7167\u7247\u9910\u9ede\u4f30\u7b97";
  const lower = label.toLowerCase();
  const has = (...keys) => keys.some((key) => lower.includes(String(key).toLowerCase()) || label.includes(key));
  const rule = (() => {
    if ((has("\u7121\u7cd6", "\u96f6\u5361", "zero") && has("\u53ef\u6a02", "cola", "coke", "coca")) || has("\u7121\u7cd6\u53ef\u6a02")) {
      return mealRule("\u7121\u7cd6\u53ef\u6a02", 0, 0, 0, 0, 0, 0, 40, "light", [], "\u7d04 1 \u7f50 330ml", "\u7121\u7cd6\u98f2\u6599\u4ee5 0 kcal \u8ffd\u8e64\uff0c\u9210\u4f9d\u6a19\u793a\u4fdd\u5b88\u4f30\u3002");
    }
    if (has("\u53ef\u6a02", "cola", "coke", "coca", "\u6c7d\u6c34")) return mealRule("\u53ef\u6a02", 140, 0, 35, 0, 0, 35, 45, "sugary", ["sugary"], "\u7d04 1 \u7f50 330ml", "\u98f2\u6599\u4e0d\u5957\u7528\u6b63\u9910 520 kcal\uff0c\u4ee5 330ml \u542b\u7cd6\u98f2\u6599\u4f30\u7b97\u3002");
    if (has("\u5564\u9152", "beer")) return mealRule("\u5564\u9152", 150, 1, 13, 0, 0, 1, 15, "light", [], "\u7d04 1 \u7f50 330ml", "\u4ee5\u5e38\u898b 330ml \u5564\u9152\u4f30\u7b97\uff0c\u4e0d\u7576\u6210\u6b63\u9910\u3002");
    if (has("\u62ff\u9435", "latte")) return mealRule("\u62ff\u9435", 180, 9, 16, 7, 0, 12, 120, "light", [], "\u7d04 1 \u676f 360ml", "\u4ee5\u9bae\u5976\u62ff\u9435\u4fdd\u5b88\u4f30\u7b97\uff0c\u52a0\u7cd6\u9700\u518d\u4e0a\u8abf\u3002");
    if (has("\u73cd\u5976", "\u5976\u8336", "\u624b\u6416")) return mealRule("\u624b\u6416\u98f2", 420, 5, 72, 12, 0, 55, 160, "sugary", ["sugary"], "\u7d04 1 \u676f", "\u624b\u6416\u98f2\u4ee5\u534a\u7cd6\u5230\u5168\u7cd6\u5340\u9593\u4f30\u7b97\uff0c\u53ef\u4f9d\u751c\u5ea6\u8abf\u6574\u3002");
    if (has("\u9ebb\u8fa3\u934b", "\u706b\u934b", "\u934b", "\u9ebb\u8fa3\u6e6f")) return mealRule(label, 520, 24, 28, 34, 4, 5, 1500, "salty", ["high_sodium", "fried_or_high_fat"], "\u7d04 1 \u7897/\u4efd", "\u934b\u985e\u542b\u6e6f\u5e95\u8207\u6cb9\u8102\uff0c\u5148\u4ee5\u4e00\u7897\u4efd\u91cf\u4f30\u7b97\uff0c\u82e5\u5403\u5b8c\u6574\u934b\u9700\u4e0a\u8abf\u3002");
    if (has("\u6ce1\u83dc\u6e6f", "\u97d3\u5f0f\u6ce1\u83dc\u6e6f", "\u6ce1\u83dc\u934b", "\u97d3\u5f0f\u934b")) return mealRule("\u97d3\u5f0f\u6ce1\u83dc\u6e6f", 430, 22, 28, 24, 4, 7, 1500, "salty", ["high_sodium"], "\u7d04 1 \u7897", "\u6ce1\u83dc\u6e6f\u71b1\u91cf\u4f86\u81ea\u8089\u3001\u8c46\u8150\u8207\u6e6f\u5e95\uff0c\u9210\u504f\u9ad8\uff0c\u5efa\u8b70\u6e6f\u5e95\u4e0d\u5168\u559d\u5b8c\u3002");
    if (has("\u5473\u564c\u6e6f", "\u8c46\u8150\u6e6f", "\u86cb\u82b1\u6e6f", "\u8ca2\u4e38\u6e6f", "\u9b5a\u4e38\u6e6f")) return mealRule(label, 150, 9, 10, 7, 2, 3, 850, "salty", ["high_sodium"], "\u7d04 1 \u7897", "\u6e6f\u54c1\u4ee5 300-450ml \u4f30\u7b97\uff0c\u4e38\u985e\u8207\u5473\u564c\u9210\u8f03\u9ad8\u3002");
    if (has("\u96de\u6e6f", "\u6392\u9aa8\u6e6f", "\u725b\u8089\u6e6f", "\u7f8a\u8089\u6e6f", "\u8089\u6e6f")) return mealRule(label, 260, 20, 8, 16, 1, 2, 850, "salty", ["high_sodium"], "\u7d04 1 \u7897", "\u8089\u6e6f\u5df2\u542b\u86cb\u767d\u8cea\u8207\u6cb9\u8102\uff0c\u4e0d\u6703\u4f30\u6210 0 kcal\u3002");
    if (has("\u9178\u8fa3\u6e6f", "\u7fb9", "\u52fe\u82a1")) return mealRule(label, 230, 10, 24, 10, 2, 4, 900, "salty", ["high_sodium"], "\u7d04 1 \u7897", "\u7fb9\u6e6f\u6709\u52fe\u82a1\uff0c\u78b3\u6c34\u548c\u9210\u6703\u6bd4\u6e05\u6e6f\u9ad8\u3002");
    if (has("\u6fc3\u6e6f", "\u7389\u7c73\u6fc3\u6e6f", "\u5357\u74dc\u6fc3\u6e6f", "\u5976\u6cb9", "\u8d77\u53f8")) return mealRule(label, 320, 9, 28, 18, 3, 8, 750, "fried", ["fried_or_high_fat"], "\u7d04 1 \u7897", "\u6fc3\u6e6f\u542b\u4e73\u8102\u6216\u6fb1\u7c89\uff0c\u71b1\u91cf\u9ad8\u65bc\u6e05\u6e6f\u3002");
    if (has("\u6e6f", "\u6c64", "\u7fb9", "soup")) return mealRule(label, has("\u9752\u83dc", "\u852c\u83dc", "\u51ac\u74dc", "\u8607\u8514", "\u6d77\u5e36", "\u7d2b\u83dc", "\u83c7") ? 90 : 180, has("\u9752\u83dc", "\u852c\u83dc", "\u51ac\u74dc", "\u8607\u8514", "\u6d77\u5e36", "\u7d2b\u83dc", "\u83c7") ? 4 : 8, has("\u9752\u83dc", "\u852c\u83dc", "\u51ac\u74dc", "\u8607\u8514", "\u6d77\u5e36", "\u7d2b\u83dc", "\u83c7") ? 10 : 14, has("\u9752\u83dc", "\u852c\u83dc", "\u51ac\u74dc", "\u8607\u8514", "\u6d77\u5e36", "\u7d2b\u83dc", "\u83c7") ? 3 : 9, has("\u9752\u83dc", "\u852c\u83dc", "\u51ac\u74dc", "\u8607\u8514", "\u6d77\u5e36", "\u7d2b\u83dc", "\u83c7") ? 3 : 2, 4, has("\u9752\u83dc", "\u852c\u83dc", "\u51ac\u74dc", "\u8607\u8514", "\u6d77\u5e36", "\u7d2b\u83dc", "\u83c7") ? 550 : 700, has("\u9752\u83dc", "\u852c\u83dc", "\u51ac\u74dc", "\u8607\u8514", "\u6d77\u5e36", "\u7d2b\u83dc", "\u83c7") ? "balanced" : "unknown", has("\u9752\u83dc", "\u852c\u83dc", "\u51ac\u74dc", "\u8607\u8514", "\u6d77\u5e36", "\u7d2b\u83dc", "\u83c7") ? ["fiber_source"] : [], "\u7d04 1 \u7897", "\u6c92\u6709\u660e\u78ba\u6599\u7684\u6e6f\u54c1\u4ee5\u4e00\u7897\u4fdd\u5b88\u4f30\u7b97\uff0c\u6709\u6599\u6216\u6fc3\u6e6f\u8acb\u4e0a\u8abf\u3002");
    if (has("\u7092\u98ef")) return mealRule("\u7092\u98ef", 720, 24, 88, 28, 4, 3, 1100, "fried", ["high_sodium", "fried_or_high_fat"], "\u7d04 1 \u76e4", "\u7092\u98ef\u4ee5\u5916\u98df\u4e00\u76e4\u4efd\u91cf\u4f30\u7b97\uff0c\u6cb9\u91cf\u504f\u9ad8\u3002");
    if (has("\u4fbf\u7576", "\u96de\u817f\u4fbf\u7576", "\u6392\u9aa8\u4fbf\u7576")) return mealRule("\u4fbf\u7576", 760, 32, 88, 28, 5, 8, 1200, "heavy", ["high_sodium"], "\u7d04 1 \u4efd", "\u4fbf\u7576\u4ee5\u98ef\u3001\u4e3b\u83dc\u8207\u914d\u83dc\u4e00\u4efd\u4f30\u7b97\u3002");
    if (has("\u6ef7\u8089\u98ef", "\u9b6f\u8089\u98ef")) return mealRule("\u6ef7\u8089\u98ef", 520, 16, 72, 18, 2, 4, 850, "salty", ["high_sodium"], "\u7d04 1 \u7897", "\u4ee5\u4e00\u7897\u6ef7\u8089\u98ef\u4f30\u7b97\uff0c\u80a5\u8089\u591a\u6642\u8acb\u4e0a\u8abf\u3002");
    if (has("\u767d\u98ef", "\u98ef")) return mealRule("\u767d\u98ef", 280, 5, 62, 1, 1, 0, 0, "light", [], "\u7d04 1 \u7897", "\u55ae\u7d14\u767d\u98ef\u4ee5\u4e00\u7897\u4f30\u7b97\uff0c\u4e0d\u542b\u914d\u83dc\u3002");
    if (has("\u6c99\u62c9", "\u751f\u83dc")) return mealRule("\u6c99\u62c9", 320, 18, 28, 15, 7, 8, 450, "balanced", ["fiber_source"], "\u7d04 1 \u4efd", "\u6c99\u62c9\u542b\u91ac\u6599\u6642\u8102\u80aa\u6703\u4e0a\u5347\uff0c\u53ef\u4f9d\u91ac\u91cf\u8abf\u6574\u3002");
    if (has("\u9eb5", "\u62c9\u9eb5", "\u725b\u8089\u9eb5", "\u4e7e\u9eb5")) return mealRule(label, 650, 26, 86, 22, 4, 5, 1300, "salty", ["high_sodium"], "\u7d04 1 \u7897", "\u9eb5\u98df\u4ee5\u4e00\u7897\u4f30\u7b97\uff0c\u6e6f\u5e95\u8207\u91ac\u6599\u9210\u504f\u9ad8\u3002");
    return null;
  })() || mealRule(label, 430, 18, 48, 15, 3, 6, 650, "unknown", [], "\u7d04 1 \u4efd", "\u672a\u547d\u4e2d\u660e\u78ba\u9910\u9ede\u898f\u5247\uff0c\u5148\u4ee5\u4e00\u822c\u9910\u9ede\u4fdd\u5b88\u4f30\u7b97\uff1b\u8f38\u5165\u9910\u540d\u6216\u4efd\u91cf\u6703\u66f4\u6e96\u3002");
  return rule;
}

function mealRule(name, calories, protein, carbs, fat, fiber, sugar, sodium, quality, flags, portion, notes) {
  return {
    total_calories: calories,
    total_protein: protein,
    total_carbs: carbs,
    total_fat: fat,
    total_fiber: fiber,
    total_sugar: sugar,
    total_sodium: sodium,
    meal_quality: quality,
    health_flags: flags,
    confidence: flags.length || quality !== "unknown" ? "medium" : "low",
    notes,
    items: [{ name, portion, calories, protein, carbs, fat, fiber, sugar, sodium }]
  };
}

function ensureUsefulAnalysis(analysis, mealText, provider, scenario = "") {
  const textEstimate = estimateMealTextServer(mealText);
  const isAfterMeal = /after|\u9910\u5f8c|\u5269\u9918|\u5403\u5b8c|\u98ef\u5f8c/i.test(String(scenario || ""));
  if (textEstimate && textEstimate.confidence !== "low") {
    return {
      ...normalizeAnalysis(textEstimate),
      provider: `${provider}_text_assist`,
      notes: textEstimate.notes || "\u5df2\u7528\u9910\u540d\u8f14\u52a9\u4f30\u7b97\uff0c\u907f\u514d\u8996\u89ba AI \u8aa4\u5224\u6210\u6cdb\u7528\u9910\u9ede\u3002"
    };
  }
  const normalized = normalizeAnalysis(analysis || {});
  const corrected = normalizeUnstableVisualEstimate(normalized, provider);
  if (corrected) return corrected;
  const usefulItems = (normalized.items || []).filter((item) => {
    const name = String(item.name || "");
    return name && !/photo|image|unknown|\u7167\u7247\u9910\u9ede|\u9910\u9ede\u4f30\u7b97|\u98df\u7269\u540d\u7a31/i.test(name);
  });
  if (normalized.total_calories > 0 && usefulItems.length) return { ...normalized, provider };
  return {
    ...normalizeAnalysis(isAfterMeal ? estimateMealTextServer("\u98ef\u5f8c\u5269\u9918\u91cf") : (textEstimate || estimateMealTextServer("\u7167\u7247\u9910\u9ede\u4f30\u7b97"))),
    provider: `${provider}_fallback`,
    notes: isAfterMeal
      ? "\u98ef\u5f8c\u7167\u5df2\u8b80\u53d6\uff1bAI \u6c92\u7a69\u5b9a\u770b\u51fa\u5269\u9918\u91cf\u6642\uff0c\u8acb\u524d\u7aef\u4fdd\u7559\u9910\u524d\u71b1\u91cf\u4e26\u53ea\u628a\u7167\u7247\u88dc\u9032\u56de\u61b6\u3002"
      : "\u8996\u89ba AI \u6c92\u6709\u7a69\u5b9a\u8b58\u5225\u5230\u54c1\u9805\uff0c\u5df2\u6539\u7528\u672c\u6a5f\u4fdd\u5b88\u4f30\u7b97\uff0c\u8acb\u7528\u5be6\u969b\u4efd\u91cf\u5fae\u8abf\u3002"
  };
}

function normalizeUnstableVisualEstimate(analysis, provider) {
  const itemText = (analysis.items || []).map((item) => item.name).filter(Boolean).join(" ");
  const total = Number(analysis.total_calories || 0);
  if (/cola|coke|coca|\u53ef\u6a02|\u6c7d\u6c34|\u5564\u9152|beer|\u6ab8\u6aac|\u98f2\u6599/i.test(itemText) && total > 280) {
    const drink = normalizeAnalysis(estimateMealTextServer(/beer|\u5564\u9152/i.test(itemText) ? "\u5564\u9152" : "\u53ef\u6a02"));
    return { ...drink, provider: `${provider}_drink_guard`, confidence: "medium", notes: "\u770b\u8d77\u4f86\u662f\u98f2\u6599\uff0c\u5df2\u9632\u6b62\u88ab\u8aa4\u5957\u6210\u6b63\u9910 520 kcal\u3002" };
  }
  if (/\u5564\u9152|beer|\u6ab8\u6aac/i.test(itemText) && /can|\u7f50|\u98f2\u6599/i.test(`${itemText} ${analysis.notes || ""}`)) {
    const drink = normalizeAnalysis(estimateMealTextServer("\u5564\u9152"));
    return {
      ...drink,
      provider: `${provider}_drink_review`,
      confidence: "low",
      notes: "\u8996\u89ba\u770b\u8d77\u4f86\u662f\u7f50\u88dd\u98f2\u6599\uff0cAI \u53ef\u80fd\u628a\u53ef\u6a02\u8aa4\u5224\u6210\u5564\u9152\uff1b\u8acb\u7528\u524d\u7aef\u98f2\u6599\u6821\u6b63\u9215\u78ba\u8a8d\u3002"
    };
  }
  const genericPhotoOnly = /photo|image|unknown|\u7167\u7247\u9910\u9ede|\u9910\u9ede\u4f30\u7b97|\u98df\u7269\u540d\u7a31/i.test(itemText) || !(analysis.items || []).length;
  if (genericPhotoOnly && (!total || total === 520)) {
    return { ...normalizeAnalysis(estimateMealTextServer("\u7167\u7247\u9910\u9ede\u4f30\u7b97")), provider: `${provider}_generic_guard`, confidence: "low", notes: "\u6c92\u6709\u8db3\u5920\u54c1\u9805\u8a0a\u865f\u6642\uff0c\u4e0d\u786c\u8aaa AI \u5df2\u7cbe\u6e96\u8b58\u5225\uff1b\u5148\u4fdd\u5b88\u4f30\u7b97\u4e26\u7b49\u4f60\u88dc\u9910\u540d\u3002" };
  }
  return null;
}
