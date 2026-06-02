const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8788);

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
  console.log(`Toma 番茄日日 is running at http://localhost:${PORT}`);
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("貼上") || apiKey.includes("your-openai-api-key")) {
    sendJson(res, 401, { error: "missing_api_key", message: "OPENAI_API_KEY is not configured." });
    return;
  }

  const body = await readJson(req, 8 * 1024 * 1024);
  const { imageData, mealText = "", mealType = "", scenario = "", portionLabel = "" } = body;
  if (!imageData || !String(imageData).startsWith("data:image/")) {
    sendJson(res, 400, { error: "missing_image", message: "imageData must be a base64 data URL." });
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
      max_output_tokens: 550,
      text: {
        format: {
          type: "json_schema",
          name: "meal_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              total_kcal: { type: "integer" },
              protein_g: { type: "integer" },
              carbs_g: { type: "integer" },
              fat_g: { type: "integer" },
              confidence: { type: "number" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    kcal: { type: "integer" },
                    confidence: { type: "number" }
                  },
                  required: ["name", "kcal", "confidence"]
                }
              },
              advice: { type: "string" },
              action_hints: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["total_kcal", "protein_g", "carbs_g", "fat_g", "confidence", "items", "advice", "action_hints"]
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
                "你是番茄日日 Toma 的餐食熱量辨識助理。",
                "請根據照片估算餐點總熱量與食物明細。",
                "熱量是估算值，要保守合理，不要假裝精準。",
                "只回傳 JSON，不要 Markdown。",
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
                "請回傳：total_kcal, protein_g, carbs_g, fat_g, confidence, items, advice, action_hints。",
                "items 每個項目要有 name, kcal, confidence。",
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
    const status = error.name === "AbortError" ? 504 : 502;
    sendJson(res, status, { error: "openai_timeout", message: "AI 辨識時間過長，請先使用本機估算。" });
    return;
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json();
  if (!response.ok) {
    sendJson(res, response.status, { error: "openai_error", message: payload.error?.message || "OpenAI request failed." });
    return;
  }

  const text = extractOutputText(payload);
  const analysis = parseJsonFromText(text);
  if (!analysis) {
    sendJson(res, 502, { error: "invalid_ai_response", raw: text });
    return;
  }
  sendJson(res, 200, normalizeAnalysis(analysis));
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
    kcal: Math.max(0, Math.round(Number(item.kcal || 0))),
    confidence: clamp(Number(item.confidence || analysis.confidence || 0.65), 0, 1),
  }));
  const total = Number(analysis.total_kcal || normalizedItems.reduce((sum, item) => sum + item.kcal, 0) || 0);
  return {
    total_kcal: Math.max(0, Math.round(total)),
    protein_g: Math.max(0, Math.round(Number(analysis.protein_g || 0))),
    carbs_g: Math.max(0, Math.round(Number(analysis.carbs_g || 0))),
    fat_g: Math.max(0, Math.round(Number(analysis.fat_g || 0))),
    confidence: clamp(Number(analysis.confidence || 0.65), 0, 1),
    items: normalizedItems.length ? normalizedItems : [{ name: "照片餐點", kcal: Math.max(0, Math.round(total)), confidence: 0.55 }],
    advice: String(analysis.advice || "先確認食物明細，沒問題再儲存這餐。"),
    action_hints: Array.isArray(analysis.action_hints) ? analysis.action_hints.slice(0, 4).map(String) : [],
  };
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
