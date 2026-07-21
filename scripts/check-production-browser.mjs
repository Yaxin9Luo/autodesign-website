import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.env.SITE_URL;
assert.ok(url, "SITE_URL is required for the production browser probe");

let browser;
try {
  browser = await chromium.launch({ headless: true, timeout: 30_000 });
  const page = await browser.newPage({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 },
  });
  page.setDefaultNavigationTimeout(30_000);
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.getElementById("scene-shell")?.dataset.introPhase === "armed");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.getElementById("scene-shell")?.dataset.introPhase === "complete");

  for (const name of ["slides", "web"]) {
    await page.locator(`#artifact-tab-${name}`).click();
    const trigger = page.locator(`#artifact-panel-${name} [data-open-artifact]`);
    await trigger.click();
    const iframe = page.locator("#artifact-viewer-stage iframe");
    await iframe.waitFor({ state: "visible" });
    const frame = iframe.contentFrame();
    await frame.locator("body").waitFor();
    await frame.locator("body").evaluate(() => new Promise((resolveReady) => {
      if (document.readyState !== "loading") resolveReady();
      else document.addEventListener("DOMContentLoaded", resolveReady, { once: true });
    }));

    if (name === "slides") {
      assert.equal(await frame.locator(".deck-slide").count(), 12);
      assert.notEqual(
        await frame.locator(".deck-slide").first().evaluate((slide) => getComputedStyle(slide).backgroundColor),
        "rgba(0, 0, 0, 0)",
        "slide deck inline styles did not run under the hosted CSP",
      );
      await frame.locator("body").evaluate((body) => {
        body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
      });
      assert.equal(await frame.locator('.deck-slide[aria-current="page"]').count(), 1,
        `slide deck inline navigation did not run under the hosted CSP: ${errors.join(" | ")}`);
    } else {
      await frame.locator(".figure-trigger").first().click();
      await frame.locator("#figure-dialog").waitFor({ state: "visible" });
      await frame.locator("#dialog-close").click();
      await frame.locator("#figure-dialog").waitFor({ state: "hidden" });
    }

    await frame.locator("body").press("Escape");
    await page.locator("#artifact-viewer").waitFor({ state: "hidden" });
    assert.equal(await trigger.evaluate((element) => document.activeElement === element), true,
      `${name} viewer did not restore focus after iframe Escape`);
  }

  assert.deepEqual(errors, [], `production browser console errors: ${errors.join(" | ")}`);
  console.log("research-site production browser probe: OK");
} finally {
  await browser?.close();
}
