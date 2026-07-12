function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = function handler(req, res) {
  if (req.method === "GET") return json(res, 200, { dates: [] });
  res.setHeader("Allow", "GET");
  return json(res, 405, { error: "method_not_allowed" });
};
