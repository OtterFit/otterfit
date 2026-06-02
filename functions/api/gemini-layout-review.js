export async function onRequestPost({ request, env }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-gemini-api-key")) {
    return json({ error: "missing_gemini_key", message: "GEMINI_API_KEY is not configured." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const note = String(body.note || "").slice(0, 2000);
  const html = await readAsset(env, request, "/index.html", 14000);
  const css = await readAsset(env, request, "/styles.css", 16000);
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = [
    "你是高級 mobile app UI/UX 顧問。請針對 OtterFit 這個減重拍照熱量 App，給可以直接交給工程師修改的建議。",
    "目標：手機第一、像 iPhone app、資訊清楚、健康感、不幼稚。",
    "請用條列回覆：1. 視覺問題 2. 版型問題 3. 互動流程 4. 文案 5. CSS/HTML 修改建議。",
    `使用者補充：${note || "請檢查整體手機版。"}`,
    "index.html:",
    html,
    "styles.css:",
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
    return json({ error: "gemini_error", message: payload.error?.message || "Gemini request failed." }, response.status);
  }
  const advice = (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
  return json({ advice });
}

async function readAsset(env, request, path, maxLength) {
  if (!env.ASSETS) return "";
  const url = new URL(path, request.url);
  const response = await env.ASSETS.fetch(url);
  if (!response.ok) return "";
  return (await response.text()).slice(0, maxLength);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
