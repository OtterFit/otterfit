export async function onRequestPost({ request, env }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("your-openai-api-key")) {
    return json({ error: "missing_api_key", message: "OPENAI_API_KEY is not configured." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Invalid JSON body." }, 400);
  }

  const { imageData, mealText = "", mealType = "", scenario = "", portionLabel = "" } = body;
  if (!imageData || !String(imageData).startsWith("data:image/")) {
    return json({ error: "missing_image", message: "imageData must be a base64 data URL." }, 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
                      confidence: { type: "number" },
                    },
                    required: ["name", "kcal", "confidence"],
                  },
                },
                advice: { type: "string" },
                action_hints: { type: "array", items: { type: "string" } },
              },
              required: ["total_kcal", "protein_g", "carbs_g", "fat_g", "confidence", "items", "advice", "action_hints"],
            },
          },
        },
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: [
                  "你是 OtterFit 的飲食熱量估算助理。",
                  "請用台灣日常飲食情境估算熱量與營養素，口吻要像務實的健康教練。",
                  "只能輸出符合 schema 的 JSON，不要輸出 Markdown。",
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
                  `餐別：${mealType || "未指定"}`,
                  `份量：${portionLabel || "一般份量"}`,
                  `情境：${scenario || "未提供"}`,
                  `補充文字：${mealText || "無"}`,
                  "請回傳 total_kcal, protein_g, carbs_g, fat_g, confidence, items, advice, action_hints。",
                ].join("\n"),
              },
              { type: "input_image", image_url: imageData, detail: "low" },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const status = error.name === "AbortError" ? 504 : 502;
    return json({ error: "openai_timeout", message: "AI 辨識時間過長，請先使用本機估算。" }, status);
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ error: "openai_error", message: payload.error?.message || "OpenAI request failed." }, response.status);
  }

  const text = extractOutputText(payload);
  const analysis = parseJsonFromText(text);
  if (!analysis) return json({ error: "invalid_ai_response", raw: text }, 502);

  return json(normalizeAnalysis(analysis));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
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
    const match = String(text || "").match(/\{[\s\S]*\}/);
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
    items: normalizedItems.length ? normalizedItems : [{ name: "估算餐點", kcal: Math.max(0, Math.round(total)), confidence: 0.55 }],
    advice: String(analysis.advice || "先記錄下來，下一餐再微調份量與蛋白質。"),
    action_hints: Array.isArray(analysis.action_hints) ? analysis.action_hints.slice(0, 4).map(String) : [],
  };
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
