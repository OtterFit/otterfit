const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const index = read("index.html");
const css = read("styles.css");
const app = read("app.js");
const sw = read("sw.js");
const manifest = read("manifest.webmanifest");
const vercel = JSON.parse(read("vercel.json"));

function includes(source, fragment, label) {
  assert.ok(source.includes(fragment), `${label}: missing ${fragment}`);
}

includes(app, 'const APP_VERSION = "paipachi-app-v216"', "app version");
includes(sw, 'const CACHE_NAME = "paipachi-pwa-v216"', "service worker cache");
includes(index, "./styles.css?v=216", "stylesheet cache buster");
includes(index, "./app.js?v=216", "script cache buster");
includes(index, 'theme-color" content="#FFFDF7"', "theme color");
includes(index, "<title>拍拍吃 | 你的照片營養師</title>", "branded page title");
includes(index, '<span class="sub-title">你的照片營養師</span>', "branded subtitle");
includes(index, '<h1 class="main-title">拍拍吃</h1>', "branded top title");
includes(manifest, '"name": "拍拍吃"', "manifest full name");
includes(manifest, '"short_name": "PaiPaiChi"', "manifest short name");
includes(manifest, '"description": "你的照片營養師', "manifest description");

[
  "--bg-primary: #FFFDF7",
  "--bg-card: #FFF8F0",
  "--text-primary: #4A4A4A",
  "--text-heading: #3D2B1F",
  "--color-cta: #E8A87C",
  "--color-success: #A8C5A0",
  "--color-warning: #E8A0A0",
  "--color-secondary: #F3D8A2",
  "--color-track: #F0EBE1",
  "--font-primary:",
  "--font-number:",
  "border-radius: 999px",
  "background: var(--color-cta)",
  ".gerd-mode-card",
  ".gerd-estimate-card"
].forEach((fragment) => includes(css, fragment, `P4 CSS token ${fragment}`));

[
  "GERD_SAFE_MEAL_PLAN",
  "function classifyGerdSafety",
  "function toggleGerdMode",
  "gerdSafe"
].forEach((fragment) => includes(app + index, fragment, `P4 GERD ${fragment}`));

includes(app, "manualFoodName", "manual meal name correction input");

assert.deepStrictEqual(vercel.rewrites[0], { source: "/api/(.*)", destination: "/api/$1" }, "api rewrite should be first");
assert.deepStrictEqual(vercel.rewrites[1], { source: "/(.*)", destination: "/index.html" }, "SPA rewrite should fall back to index");
assert.ok(vercel.headers.some((rule) => rule.source === "/sw.js"), "sw.js cache header exists");
assert.ok(vercel.headers.some((rule) => String(rule.source).includes("js|css")), "static asset cache header exists");

[
  "api/analyze-meal.js",
  "api/user-profile.js",
  "api/user-meals.js",
  "api/user-meal-dates.js",
  "api/user-daily-state.js",
  "api/gemini-layout-review.js"
].forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`));

console.log("P4 static smoke test passed.");
