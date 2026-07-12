const assert = require("assert");
const path = require("path");
const { chromium } = require("playwright");

async function main() {
  const fileUrl = `file:///${path.join(__dirname, "..", "index.html").replace(/\\/g, "/")}`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await page.goto(fileUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.getElementById("loginOverlay")?.style.setProperty("display", "none");
    document.getElementById("onboardOverlay")?.style.setProperty("display", "none");
    document.getElementById("mainAppContainer")?.style.setProperty("display", "block");
    document.getElementById("bottomNav")?.style.setProperty("display", "grid");
  });

  const results = await page.evaluate(() => {
    const expected = [
      { label: "吃飯", panel: "tab-photo" },
      { label: "身體", panel: "tab-body" },
      { label: "開飯拍", id: "bottomPhotoAction" },
      { label: "相簿", panel: "tab-diet" },
      { label: "趨勢", panel: "tab-trend" }
    ];
    return expected.map((item) => {
      const button = item.id
        ? document.getElementById(item.id)
        : document.querySelector(`#bottomNav button[data-panel="${item.panel}"]`);
      if (!button) return { ...item, found: false };
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        ...item,
        found: true,
        hitId: hit?.id || "",
        hitPanel: hit?.dataset?.panel || "",
        hitText: hit?.innerText?.trim() || "",
        hitClass: hit?.className || ""
      };
    });
  });

  for (const result of results) {
    assert.ok(result.found, `${result.label} button should exist`);
    if (result.id) {
      assert.strictEqual(result.hitId, result.id, `${result.label} center should hit the photo CTA`);
    } else {
      assert.strictEqual(result.hitPanel, result.panel, `${result.label} center should hit its own tab`);
    }
  }

  const clickResults = [];
  for (const item of [
    { label: "eat", selector: '#bottomNav button[data-panel="tab-photo"]', expectedPanel: "tab-photo" },
    { label: "body", selector: '#bottomNav button[data-panel="tab-body"]', expectedPanel: "tab-body" },
    { label: "memory", selector: '#bottomNav button[data-panel="tab-diet"]', expectedPanel: "tab-diet" },
    { label: "trend", selector: '#bottomNav button[data-panel="tab-trend"]', expectedPanel: "tab-trend", expectedActiveShortcut: "tab-trend" }
  ]) {
    await page.click(item.selector);
    const state = await page.evaluate((expectedActiveShortcut) => ({
      activePanel: document.querySelector(".tab-panel.active")?.id || "",
      activeShortcut: document.querySelector(".bottom-tab-btn.active")?.dataset?.panel || "",
      sheetOpen: document.getElementById("photoSourceSheet")?.classList.contains("active") || false
    }), item.expectedActiveShortcut || item.expectedPanel);
    clickResults.push({ ...item, ...state });
    assert.strictEqual(state.activePanel, item.expectedPanel, `${item.label} should switch to ${item.expectedPanel}`);
    assert.strictEqual(state.activeShortcut, item.expectedActiveShortcut || item.expectedPanel, `${item.label} should activate its own bottom tab`);
    assert.strictEqual(state.sheetOpen, false, `${item.label} should not open photo sheet`);
  }

  await page.click("#bottomPhotoAction");
  const photoState = await page.evaluate(() => ({
    activePanel: document.querySelector(".tab-panel.active")?.id || "",
    sheetOpen: document.getElementById("photoSourceSheet")?.classList.contains("active") || false
  }));
  assert.strictEqual(photoState.activePanel, "tab-trend", "photo CTA should open the source sheet without jumping tabs");
  assert.strictEqual(photoState.sheetOpen, true, "photo CTA should open photo source sheet");
  assert.strictEqual(await page.locator("#bottomPhotoInput").count(), 0, "bottom nav should not include a file input overlay");

  await page.evaluate(() => {
    window.__photoPickerClicks = [];
    HTMLInputElement.prototype.click = function patchedPhotoInputClick() {
      window.__photoPickerClicks.push({
        id: this.id,
        accept: this.getAttribute("accept") || "",
        capture: this.getAttribute("capture") || ""
      });
    };
  });

  await page.click("#photoSourceBeforeAlbum");
  const beforeAlbumClick = await page.evaluate(() => window.__photoPickerClicks.at(-1));
  assert.strictEqual(beforeAlbumClick?.id, "photoAlbumInput", "before album source should trigger the before album file input");
  assert.strictEqual(beforeAlbumClick?.capture, "", "before album input should not force camera capture");

  await page.evaluate(() => openPhotoSourceSheet("after"));
  await page.click("#photoSourceAfterAlbum");
  const afterAlbumClick = await page.evaluate(() => window.__photoPickerClicks.at(-1));
  assert.strictEqual(afterAlbumClick?.id, "afterPhotoAlbumInput", "after album source should trigger the after album file input");
  assert.strictEqual(afterAlbumClick?.capture, "", "after album input should not force camera capture");

  await page.evaluate(() => openPhotoPicker("before"));
  const beforeCameraClick = await page.evaluate(() => window.__photoPickerClicks.at(-1));
  assert.strictEqual(beforeCameraClick?.id, "photoInput", "before camera mode should trigger the before camera input");
  assert.strictEqual(beforeCameraClick?.capture, "environment", "before camera input should request environment capture");

  await browser.close();

  console.log(JSON.stringify({ ok: true, results, clickResults, photoState, pickerClicks: { beforeAlbumClick, afterAlbumClick, beforeCameraClick } }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
