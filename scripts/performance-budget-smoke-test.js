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

  await page.goto(baseUrl, { waitUntil: "load" });
  await page.evaluate(() => {
    currentUser = "perfcheck";
    localStorage.setItem("otterfit:currentUser", currentUser);
    userData.onboardCompleted = true;
    userData.selectedTone = "healthy";
    userData.targetCalories = 1800;
    userData.dietRecords = [];
    userData.consumedCalories = 0;
    userData.totalProtein = 0;
    userData.totalFiber = 0;
    userData.waterMl = 0;
    document.getElementById("loginOverlay")?.style.setProperty("display", "none");
    document.getElementById("onboardOverlay")?.style.setProperty("display", "none");
    enterMainApplication();
  });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByType("paint").find(entry => entry.name === "first-contentful-paint");
    return {
      homeMode: document.getElementById("mainAppContainer")?.classList.contains("home-mode") || false,
      domAll: document.querySelectorAll("*").length,
      activeViewDom: [...document.querySelectorAll("#mainAppContainer *")].filter(visible).length,
      activePanelDom: document.querySelectorAll(".tab-panel.active *").length,
      visibleButtons: [...document.querySelectorAll("#mainAppContainer button")].filter(visible).length,
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadMs: Math.round(nav.loadEventEnd - nav.startTime),
      firstContentfulPaintMs: fcp ? Math.round(fcp.startTime) : null,
      htmlBytes: document.documentElement.outerHTML.length
    };
  });

  assert.deepStrictEqual(errors, [], `performance smoke should have no page errors: ${errors.join("; ")}`);
  assert.strictEqual(metrics.homeMode, true, "initial app view should stay on simplified home");
  assert.ok(metrics.domContentLoadedMs < 2000, `DOMContentLoaded should be < 2000ms, got ${metrics.domContentLoadedMs}`);
  assert.ok(metrics.firstContentfulPaintMs !== null && metrics.firstContentfulPaintMs < 1500, `FCP should be < 1500ms, got ${metrics.firstContentfulPaintMs}`);
  assert.ok(metrics.activeViewDom < 500, `active view DOM should be < 500, got ${metrics.activeViewDom}`);
  assert.ok(metrics.visibleButtons < 15, `home visible buttons should be < 15, got ${metrics.visibleButtons}`);

  await page.click('#bottomNav button[data-panel="tab-photo"]');
  await page.waitForTimeout(100);
  await page.click('#bottomNav button[data-panel="tab-body"]');
  await page.waitForTimeout(100);
  await page.click('#bottomNav button[data-panel="tab-trend"]');
  await page.waitForTimeout(100);
  await page.click('#bottomNav button[data-panel="tab-diet"]');
  await page.waitForTimeout(100);
  await page.click('#bottomNav button[data-panel="tab-photo"]');
  await page.waitForTimeout(250);
  const lifecycle = await page.evaluate(() => ({
    domAll: document.querySelectorAll("*").length,
    activePanel: document.querySelector(".tab-panel.active")?.id || "",
    lazyPanels: [...document.querySelectorAll(".tab-panel[data-lazy='true']")].map(panel => panel.id),
    activePanelDom: document.querySelectorAll(".tab-panel.active *").length
  }));
  assert.strictEqual(lifecycle.activePanel, "tab-photo", "tab lifecycle should return to meal panel");
  assert.ok(lifecycle.lazyPanels.includes("tab-body"), "body panel should unmount after leaving");
  assert.ok(lifecycle.lazyPanels.includes("tab-trend"), "trend panel should unmount after leaving");
  assert.ok(lifecycle.lazyPanels.includes("tab-diet"), "memory panel should unmount after leaving");
  assert.ok(!lifecycle.lazyPanels.includes("tab-photo"), "active meal panel should stay mounted");
  assert.ok(lifecycle.activePanelDom < 320, `active meal panel DOM should stay focused, got ${lifecycle.activePanelDom}`);

  await page.click('#bottomNav button[data-panel="tab-body"]');
  await page.waitForTimeout(100);
  await page.click('#bottomNav button[data-panel="tab-trend"]');
  await page.waitForTimeout(100);
  await page.click('#bottomNav button[data-panel="tab-diet"]');
  await page.waitForTimeout(100);
  await page.click('#bottomNav button[data-panel="tab-photo"]');
  await page.waitForTimeout(250);
  const secondLifecycle = await page.evaluate(() => ({
    domAll: document.querySelectorAll("*").length,
    activePanel: document.querySelector(".tab-panel.active")?.id || "",
    lazyPanels: [...document.querySelectorAll(".tab-panel[data-lazy='true']")].map(panel => panel.id),
    activePanelDom: document.querySelectorAll(".tab-panel.active *").length
  }));
  assert.strictEqual(secondLifecycle.activePanel, "tab-photo", "second lifecycle should return to meal panel");
  assert.ok(secondLifecycle.lazyPanels.includes("tab-body"), "body panel should still unmount after second cycle");
  assert.ok(secondLifecycle.lazyPanels.includes("tab-trend"), "trend panel should still unmount after second cycle");
  assert.ok(secondLifecycle.lazyPanels.includes("tab-diet"), "memory panel should still unmount after second cycle");
  assert.ok(secondLifecycle.domAll <= lifecycle.domAll + 30, `DOM should not grow across repeated tab cycles, got ${secondLifecycle.domAll} after ${lifecycle.domAll}`);

  await browser.close();
  console.log(JSON.stringify({ ok: true, baseUrl, metrics, lifecycle, secondLifecycle }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, baseUrl, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
