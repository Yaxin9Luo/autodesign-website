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

  await page.locator("#artifact-tab-poster").click();
  const hostedPosterFit = await page.locator("#artifact-panel-poster").evaluate((panel) => {
    const stage = panel.querySelector(".artifact-study__stage").getBoundingClientRect();
    const image = panel.querySelector("img").getBoundingClientRect();
    const label = panel.querySelector(".artifact-stage-label").getBoundingClientRect();
    return { image: { bottom: image.bottom, height: image.height, top: image.top, width: image.width }, label: { top: label.top }, stage: { bottom: stage.bottom, top: stage.top } };
  });
  assert.ok(hostedPosterFit.image.top >= hostedPosterFit.stage.top && hostedPosterFit.image.bottom < hostedPosterFit.label.top - 12,
    `hosted Poster preview is clipped or collides with its stage metadata: ${JSON.stringify(hostedPosterFit)}`);
  assert.ok(Math.abs(hostedPosterFit.image.width / hostedPosterFit.image.height - (3072 / 2140)) <= 0.01,
    `hosted Poster preview does not preserve its source aspect ratio: ${JSON.stringify(hostedPosterFit)}`);

  await page.locator("#artifact-tab-slides").click();
  const hostedSlideFit = await page.locator("#artifact-panel-slides").evaluate((panel) => {
    const stage = panel.querySelector(".artifact-study__stage").getBoundingClientRect();
    const frame = panel.querySelector(".slide-carousel__frame").getBoundingClientRect();
    return { frame: { bottom: frame.bottom, height: frame.height, top: frame.top, width: frame.width }, stage: { bottom: stage.bottom, top: stage.top } };
  });
  assert.ok(hostedSlideFit.frame.top >= hostedSlideFit.stage.top - 1
    && hostedSlideFit.frame.bottom <= hostedSlideFit.stage.bottom + 1,
  `hosted Slide page is clipped by its stage: ${JSON.stringify(hostedSlideFit)}`);
  assert.ok(Math.abs(hostedSlideFit.frame.width / hostedSlideFit.frame.height - (16 / 9)) <= 0.01,
    `hosted Slide page is not 16:9: ${JSON.stringify(hostedSlideFit)}`);
  await page.locator("#artifact-panel-slides [data-open-artifact]").click();
  await page.locator("#artifact-viewer-stage .artifact-slide-viewer").waitFor({ state: "visible" });
  assert.equal(await page.locator("#artifact-viewer-stage video").count(), 0,
    "hosted Slide viewer fell through to Video");
  assert.equal(await page.locator("#artifact-viewer-type").textContent(), "Slide deck");
  await page.keyboard.press("Escape");

  await page.locator("#artifact-tab-video").click();
  const previewPlay = page.locator("#artifact-panel-video .video-specimen__play[data-open-artifact]");
  assert.equal(await previewPlay.count(), 1, "video preview must expose one playable viewer control");
  await previewPlay.click();
  const fullVideo = page.locator("#artifact-viewer-stage video");
  await fullVideo.waitFor({ state: "visible" });
  await fullVideo.evaluate((video) => new Promise((resolveReady, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) resolveReady();
    else {
      video.addEventListener("loadedmetadata", resolveReady, { once: true });
      video.addEventListener("error", () => reject(new Error("Hosted conference video failed to load")), { once: true });
    }
  }));
  assert.equal(await fullVideo.getAttribute("controls"), "");
  assert.equal(await fullVideo.locator('track[kind="captions"][srclang="en"]').count(), 1);
  await fullVideo.evaluate((video) => video.play());
  await page.waitForFunction(() => !document.querySelector("#artifact-viewer-stage video")?.paused);
  await fullVideo.evaluate((video) => video.pause());
  await page.keyboard.press("Escape");
  assert.equal(await previewPlay.evaluate((element) => document.activeElement === element), true,
    "video viewer did not restore focus to its preview play control");

  const methodFigure = page.locator('[data-method-figure] [data-open-artifact]');
  await methodFigure.scrollIntoViewIfNeeded();
  await methodFigure.click();
  const methodImage = page.locator("#artifact-viewer-stage img");
  await methodImage.waitFor({ state: "visible" });
  assert.ok(await methodImage.evaluate((image) => image.complete && image.naturalWidth > 0),
    "hosted method figure did not load");
  await page.keyboard.press("Escape");

  await page.locator("#artifact-tab-web").click();
  const previewFrame = page.locator("#artifact-panel-web .browser-specimen__viewport iframe").contentFrame();
  await previewFrame.locator("footer").waitFor({ state: "attached" });
  const previewBottom = await previewFrame.locator("body").evaluate(() => new Promise((resolveScroll) => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, document.documentElement.scrollHeight);
    requestAnimationFrame(() => {
      const footer = document.querySelector("footer");
      resolveScroll({
        gap: document.documentElement.scrollHeight - (footer.getBoundingClientRect().bottom + window.scrollY),
        maximum: document.documentElement.scrollHeight - window.innerHeight,
        top: window.scrollY,
      });
    });
  }));
  assert.ok(previewBottom.top > 0 && Math.abs(previewBottom.top - previewBottom.maximum) <= 1,
    `hosted Web preview cannot reach its footer: ${JSON.stringify(previewBottom)}`);
  assert.ok(Math.abs(previewBottom.gap) <= 2,
    `hosted Web preview leaves a blank tail: ${JSON.stringify(previewBottom)}`);

  for (const name of ["web"]) {
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

    await frame.locator(".lightbox-launch").first().click();
    await frame.locator("#evidence-lightbox").waitFor({ state: "visible" });
    await frame.locator("#close-lightbox").click();
    await frame.locator("#evidence-lightbox").waitFor({ state: "hidden" });

    await frame.locator("body").press("Escape");
    await page.locator("#artifact-viewer").waitFor({ state: "hidden" });
    assert.equal(await trigger.evaluate((element) => document.activeElement === element), true,
      `${name} viewer did not restore focus after iframe Escape`);
  }

  const slideTrigger = page.locator("#artifact-panel-slides [data-open-artifact]");
  assert.equal(
    await slideTrigger.getAttribute("data-artifact-new-tab"),
    "./artifacts/slides/autodesign/AutoDesign-slides-formal-academic.pdf?v=20260730a",
    "Open slide deck must target the formal academic PDF",
  );
  const formalDeckResponse = await page.evaluate(async () => {
    const response = await fetch("./artifacts/slides/autodesign/AutoDesign-slides-formal-academic.pdf");
    return { contentType: response.headers.get("content-type"), ok: response.ok };
  });
  assert.equal(formalDeckResponse.ok, true, "formal academic PDF did not load from the hosted site");
  assert.match(formalDeckResponse.contentType ?? "", /application\/pdf/, "formal academic deck must retain its PDF content type");

  const posterPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  posterPage.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  posterPage.on("pageerror", (error) => errors.push(error.message));
  await posterPage.goto(new URL("artifacts/posters/autodesign/", url).href, { waitUntil: "networkidle" });
  const authors = await posterPage.locator(".poster-authors").textContent();
  assert.match(authors ?? "", /Zhiqian Shen/, "AutoDesign poster must include Zhiqian Shen in the author line");
  assert.match(authors ?? "", /Xiaotong Li/, "AutoDesign poster must include Xiaotong Li in the author line");
  const affiliations = await posterPage.locator(".poster-affiliations").textContent();
  assert.match(affiliations ?? "", /Peking University, Tsinghua University/,
    "AutoDesign poster affiliation line must retain Tsinghua University");
  assert.notEqual(
    await posterPage.locator(".poster-affiliations").evaluate((element) => getComputedStyle(element).display),
    "none",
    "poster affiliation line is hidden under the hosted CSP",
  );
  const posterImages = await posterPage.locator('img[src]:not([src^="data:"])').evaluateAll((images) => images
    .filter((image) => image.getAttribute("src"))
    .filter((image) => !image.complete || image.naturalWidth === 0)
    .map((image) => image.getAttribute("src")));
  assert.deepEqual(posterImages, [], `AutoDesign poster image assets failed to load: ${posterImages.join(", ")}`);
  await posterPage.close();

  const landingPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  landingPage.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  landingPage.on("pageerror", (error) => errors.push(error.message));
  await landingPage.goto(new URL("artifacts/web/autodesign/", url).href, { waitUntil: "networkidle" });
  await landingPage.evaluate(async () => {
    const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));
    for (let top = 0; top < document.documentElement.scrollHeight; top += Math.max(1, Math.floor(window.innerHeight * 0.7))) {
      window.scrollTo(0, top);
      await pause(120);
    }
    await pause(400);
  });
  const landingImages = await landingPage.locator('img[src]:not([src=""])').evaluateAll((images) => images
    .filter((image) => !image.complete || image.naturalWidth === 0)
    .map((image) => image.getAttribute("src")));
  assert.deepEqual(landingImages, [], `AutoDesign Landing Page image assets failed to load: ${landingImages.join(", ")}`);
  await landingPage.close();

  assert.deepEqual(errors, [], `production browser console errors: ${errors.join(" | ")}`);
  console.log("research-site production browser probe: OK");
} finally {
  await browser?.close();
}
