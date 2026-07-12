const assert = require("assert");
const { chromium } = require("playwright");

const baseUrl = process.env.OTTERFIT_BASE_URL || "http://localhost:8788";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource|ERR_NETWORK_ACCESS_DENIED|ERR_NAME_NOT_RESOLVED|favicon/i.test(text)) return;
    errors.push(text);
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.__photoPickerClicks = [];
    HTMLInputElement.prototype.click = function patchedPhotoInputClick() {
      window.__photoPickerClicks.push({
        id: this.id,
        accept: this.getAttribute("accept") || "",
        capture: this.getAttribute("capture") || ""
      });
    };
    currentUser = "ctatest";
    localStorage.setItem("otterfit:currentUser", currentUser);
    userData.onboardCompleted = true;
    userData.selectedTone = "healthy";
    userData.targetCalories = 1800;
    userData.waterMl = 500;
    userData.dietRecords = [];
    userData.consumedCalories = 0;
    userData.totalProtein = 0;
    userData.totalFiber = 0;
    document.getElementById("loginOverlay")?.style.setProperty("display", "none");
    document.getElementById("onboardOverlay")?.style.setProperty("display", "none");
    document.getElementById("mainAppContainer")?.style.setProperty("display", "block");
    document.getElementById("mainAppContainer")?.classList.add("home-mode");
    document.getElementById("bottomNav")?.style.setProperty("display", "grid");
    updateUI(false);
  });

  const checks = [];
  async function checkClick(label, selector, verify) {
    await page.click(selector);
    await page.waitForTimeout(80);
    const state = await page.evaluate(verify);
    checks.push({ label, state });
    return state;
  }

  await checkClick("quick eat opens source sheet", "#quickRecordStrip button:nth-child(1)", () => ({
    sheetOpen: document.getElementById("photoSourceSheet")?.classList.contains("active") || false,
    activePanel: document.querySelector(".tab-panel.active")?.id || "",
    homeMode: document.getElementById("mainAppContainer")?.classList.contains("home-mode") || false
  }));
  assert.strictEqual(checks.at(-1).state.sheetOpen, true, "quick eat should open photo source sheet");
  assert.strictEqual(checks.at(-1).state.homeMode, true, "quick eat should not leave the simplified home before a photo is selected");
  await page.evaluate(() => closePhotoSourceSheet());

  await checkClick("quick water", "#quickRecordStrip button:nth-child(2)", () => ({
    water: userData.waterMl || 0,
    toast: document.getElementById("achievementToast")?.classList.contains("active") || false
  }));
  assert.ok(checks.at(-1).state.water >= 250, "quick water should add water");

  await checkClick("bottom eat opens detail", '#bottomNav button[data-panel="tab-photo"]', () => ({
    activePanel: document.querySelector(".tab-panel.active")?.id || "",
    homeMode: document.getElementById("mainAppContainer")?.classList.contains("home-mode") || false
  }));
  assert.strictEqual(checks.at(-1).state.activePanel, "tab-photo", "bottom eat should open meal detail panel");
  assert.strictEqual(checks.at(-1).state.homeMode, false, "bottom eat should leave simplified home mode");

  await page.click("#bottomPhotoAction");
  const bottomState = await page.evaluate(() => ({
    sheetOpen: document.getElementById("photoSourceSheet")?.classList.contains("active") || false,
    activePanel: document.querySelector(".tab-panel.active")?.id || ""
  }));
  checks.push({ label: "bottom photo", state: bottomState });
  assert.strictEqual(bottomState.activePanel, "tab-photo", "bottom photo should keep user on meal tab");
  assert.strictEqual(bottomState.sheetOpen, true, "bottom photo should open source sheet");
  await page.evaluate(() => closePhotoSourceSheet());

  await page.click('#bottomNav button[data-panel="tab-diet"]');
  const memoryState = await page.evaluate(() => document.querySelector(".tab-panel.active")?.id || "");
  checks.push({ label: "bottom memory", state: memoryState });
  assert.strictEqual(memoryState, "tab-diet", "memory tab should switch to album");

  await page.click('#bottomNav button[data-panel="tab-trend"]');
  const trendState = await page.evaluate(() => ({
    activePanel: document.querySelector(".tab-panel.active")?.id || "",
    shortcut: document.querySelector(".bottom-tab-btn.active")?.dataset?.panel || ""
  }));
  checks.push({ label: "bottom trend", state: trendState });
  assert.strictEqual(trendState.activePanel, "tab-trend", "trend shortcut should open dedicated trend panel");
  assert.strictEqual(trendState.shortcut, "tab-trend", "trend shortcut should stay active");

  assert.deepStrictEqual(errors, [], `CTA smoke should have no page errors: ${errors.join("; ")}`);
  await browser.close();
  console.log(JSON.stringify({ ok: true, baseUrl, checks }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
