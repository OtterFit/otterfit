function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "method_not_allowed" });
  }
  return json(res, 200, {
    ok: true,
    source: "vercel_local_fallback",
    summary: "外網預覽目前使用本機版面檢查 fallback。",
    suggestions: []
  });
};
