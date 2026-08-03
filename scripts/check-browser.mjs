import assert from "node:assert/strict";
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const sourceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = resolve(sourceRoot, process.env.SITE_ROOT ?? ".");
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".vtt", "text/vtt"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function startServer() {
  const server = createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const absolutePath = resolve(root, relativePath);
      if (absolutePath !== root && !absolutePath.startsWith(root + sep)) throw new Error("Invalid path");
      const stat = statSync(absolutePath);
      if (!stat.isFile()) throw new Error("Not a file");
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": stat.size,
        "Content-Type": mimeTypes.get(extname(absolutePath)) ?? "application/octet-stream",
      });
      if (request.method === "HEAD") response.end();
      else createReadStream(absolutePath).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

function watchConsole(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function localeUrl(url, locale) {
  const localized = new URL(url);
  localized.searchParams.set("lang", locale);
  return localized.href;
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `horizontal overflow: ${overflow}px`);
}

async function assertOpeningIntro(page) {
  const overlay = page.locator("#intro-overlay");
  const canvas = page.locator("#intro-canvas");
  await overlay.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.documentElement.classList.contains("intro-active"));
  await page.waitForFunction(() => document.querySelector("#scene-shell")?.dataset.introPhase === "armed", null, {
    timeout: 6_000,
  });
  assert.equal(await canvas.count(), 1, "opening interaction must have one dedicated canvas");
  assert.equal(await canvas.isVisible(), true, "opening particle canvas must be visible before ignition");
  const canvasBounds = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bitmapHeight: element.height,
      bitmapWidth: element.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  assert.ok(Math.abs(canvasBounds.left) <= 1 && Math.abs(canvasBounds.top) <= 1,
    `opening canvas must start at the viewport origin: ${JSON.stringify(canvasBounds)}`);
  assert.ok(Math.abs(canvasBounds.width - canvasBounds.viewportWidth) <= 1
    && Math.abs(canvasBounds.height - canvasBounds.viewportHeight) <= 1,
  `opening canvas must fill the viewport: ${JSON.stringify(canvasBounds)}`);
  assert.ok(canvasBounds.bitmapWidth >= canvasBounds.width && canvasBounds.bitmapHeight >= canvasBounds.height,
    `opening canvas bitmap must cover its CSS bounds: ${JSON.stringify(canvasBounds)}`);
  assert.equal(await page.locator("#artifact-canvas").count(), 0, "retired 3D artifact canvas must remain absent");
}

async function completeOpeningIntro(page, input = "wheel") {
  if (input === "wheel") {
    for (let index = 0; index < 4; index += 1) {
      await page.mouse.wheel(0, 720);
      await page.waitForTimeout(40);
    }
  } else {
    for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowDown");
  }
  await page.waitForFunction(() => !document.documentElement.classList.contains("intro-active"), null, {
    timeout: 9_000,
  });
}

async function assertStaticHero(page) {
  const image = page.locator(".static-hero-art");
  await image.waitFor({ state: "visible" });
  assert.equal(await page.locator("#intro-canvas").count(), 1, "opening canvas must remain available for replay");
  assert.equal(await page.locator("#intro-canvas").isVisible(), false, "opening canvas must retire after the intro");
  assert.equal(await page.locator("#artifact-canvas").count(), 0, "static homepage must not instantiate the retired artifact canvas");
  assert.ok(await image.evaluate((element) => element.complete && element.naturalWidth >= 1600),
    "static editorial image did not load at high resolution");
  const hasRetiredScene = await page.evaluate(() => performance.getEntriesByType("resource")
    .some((entry) => entry.name.includes("three-scene.js")));
  assert.equal(hasRetiredScene, false, "static homepage must not download the retired artifact scene");
  const hasOpeningScene = await page.evaluate(() => performance.getEntriesByType("resource")
    .some((entry) => entry.name.includes("opening-intro.js")));
  assert.equal(hasOpeningScene, true, "static homepage must load the independent opening interaction");
  assert.equal(await page.locator(".site-header").evaluate((header) => header.classList.contains("site-header--scene")), true,
    "dark editorial hero must keep the header readable");

  const geometry = await page.locator("#hero").evaluate((hero) => {
    const title = hero.querySelector("h1").getBoundingClientRect();
    const copy = hero.querySelector(".hero-copy").getBoundingClientRect();
    const heroBounds = hero.getBoundingClientRect();
    return { copy: copy.toJSON(), hero: heroBounds.toJSON(), title: title.toJSON() };
  });
  const viewport = page.viewportSize();
  assert.ok(viewport, "viewport is unavailable");
  for (const bounds of [geometry.copy, geometry.title]) {
    assert.ok(bounds.left >= -1 && bounds.right <= viewport.width + 1,
      `hero content overflows the viewport: ${JSON.stringify(geometry)}`);
    assert.ok(bounds.top >= geometry.hero.top - 1 && bounds.bottom <= geometry.hero.bottom + 1,
      `hero content escapes its visual field: ${JSON.stringify(geometry)}`);
  }
}

async function assertResearchAccess(page, layout) {
  const access = page.locator(".hero-access");
  await access.waitFor({ state: "visible" });
  const controls = access.locator(":scope > [data-hero-access]");
  assert.equal(await controls.count(), 3, "research access must have three controls");
  assert.equal(await access.locator('[data-hero-access="system"]').evaluate((element) => element.tagName), "A");
  assert.equal(await access.locator('[data-hero-access="code"]').isDisabled(), true);
  assert.equal(await access.locator('[data-hero-access="paper"]').isDisabled(), true);

  const geometry = await controls.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON()));
  if (layout === "desktop") {
    assert.equal(new Set(geometry.map((bounds) => Math.round(bounds.top))).size, 1,
      `desktop access controls must share one row: ${JSON.stringify(geometry)}`);
  } else {
    assert.equal(Math.round(geometry[0].top), Math.round(geometry[1].top),
      `mobile primary controls must share one row: ${JSON.stringify(geometry)}`);
    assert.ok(geometry[2].top > geometry[0].top,
      `mobile paper action must occupy a second row: ${JSON.stringify(geometry)}`);
  }
}

async function assertLanguagePicker(page) {
  const trigger = page.locator("#language-menu-trigger");
  const menu = page.locator("#language-menu");
  assert.equal(await page.locator("html").getAttribute("lang"), "en", "fresh visits must default to English");
  await trigger.click();
  await menu.waitFor({ state: "visible" });
  assert.deepEqual(await menu.locator("[data-locale]").evaluateAll((items) => items.map((item) => item.dataset.locale)),
    ["en", "zh-CN", "ko", "ar", "ja", "es", "fr", "de", "ru", "it"]);
  await menu.locator('[data-locale="zh-CN"]').click();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  await trigger.click();
  await menu.locator('[data-locale="ar"]').click();
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  await trigger.click();
  await menu.locator('[data-locale="en"]').click();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
}

async function assertArtifactSuite(page) {
  await page.locator("#artifact-studies").scrollIntoViewIfNeeded();
  await page.locator("#artifact-tab-poster").click();
  const posterPanel = page.locator("#artifact-panel-poster");
  const posterImage = posterPanel.locator(".artifact-study__stage img");
  assert.ok(await posterImage.evaluate((image) => image.complete && image.naturalWidth > 0),
    "academic poster preview did not load");
  const posterFit = await posterPanel.evaluate((panel) => {
    const stage = panel.querySelector(".artifact-study__stage").getBoundingClientRect();
    const image = panel.querySelector(".artifact-study__stage img").getBoundingClientRect();
    const label = panel.querySelector(".artifact-stage-label").getBoundingClientRect();
    return { image: image.toJSON(), label: label.toJSON(), stage: stage.toJSON() };
  });
  assert.ok(posterFit.image.top >= posterFit.stage.top && posterFit.image.bottom < posterFit.label.top - 6,
    `poster preview is clipped by the stage: ${JSON.stringify(posterFit)}`);
  await posterPanel.locator("[data-open-artifact]").click();
  const posterViewerImage = page.locator("#artifact-viewer-stage img");
  await posterViewerImage.waitFor({ state: "visible" });
  assert.ok(await posterViewerImage.evaluate((image) => image.complete && image.naturalWidth > 0),
    "poster inspector image did not load");
  await page.keyboard.press("Escape");

  await page.locator("#artifact-tab-slides").click();
  const slidesPanel = page.locator("#artifact-panel-slides");
  const slideImage = slidesPanel.locator("[data-slide-current-image]");
  await slideImage.waitFor({ state: "visible" });
  assert.ok(await slideImage.evaluate((image) => image.complete && image.naturalWidth > 0),
    "embedded slide did not load");
  assert.equal(await slidesPanel.locator("[data-slide-current]").textContent(), "01");
  await slidesPanel.locator("[data-slide-next]").click();
  await page.waitForFunction(() => document.querySelector("#artifact-panel-slides [data-slide-current]")?.textContent === "02");
  await slidesPanel.locator("[data-open-artifact]").click();
  const slideViewer = page.locator("#artifact-viewer-stage .artifact-slide-viewer");
  await slideViewer.waitFor({ state: "visible" });
  assert.equal(await page.locator("#artifact-viewer-stage video").count(), 0,
    "slides must never fall through to the video viewer");
  await slideViewer.locator("[data-viewer-slide-next]").click();
  await page.keyboard.press("Escape");

  await page.locator("#artifact-tab-web").click();
  const preview = page.locator("#artifact-panel-web iframe");
  const frame = preview.contentFrame();
  await frame.locator("footer").waitFor({ state: "attached" });
  const pageEnd = await frame.locator("body").evaluate(() => new Promise((resolveEnd) => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, document.documentElement.scrollHeight);
    requestAnimationFrame(() => {
      const footer = document.querySelector("footer");
      resolveEnd({
        gap: document.documentElement.scrollHeight - (footer.getBoundingClientRect().bottom + window.scrollY),
        maximum: document.documentElement.scrollHeight - window.innerHeight,
        top: window.scrollY,
      });
    });
  }));
  assert.ok(pageEnd.top > 0 && Math.abs(pageEnd.top - pageEnd.maximum) <= 1,
    `embedded research page cannot reach its end: ${JSON.stringify(pageEnd)}`);
  assert.ok(Math.abs(pageEnd.gap) <= 2,
    `embedded research page leaves a blank tail: ${JSON.stringify(pageEnd)}`);

  await page.locator("#artifact-tab-video").click();
  await page.waitForFunction(() => document.querySelector("#artifact-panel-video source")?.src.includes("autodesign-conference-teaser.mp4"));
  const videoTrigger = page.locator("#artifact-panel-video .video-specimen__play");
  await videoTrigger.click();
  const video = page.locator("#artifact-viewer-stage video");
  await video.waitFor({ state: "visible" });
  await video.evaluate((element) => new Promise((resolveReady, reject) => {
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) resolveReady();
    else {
      element.addEventListener("loadedmetadata", resolveReady, { once: true });
      element.addEventListener("error", () => reject(new Error("conference video failed to load")), { once: true });
    }
  }));
  assert.equal(await video.getAttribute("controls"), "");
  assert.match(await video.getAttribute("src"), /autodesign-conference-video-6min\.mp4\?v=20260731c/);
  assert.equal(await video.locator('track[src*="ddpm-conference"]').count(), 0,
    "AutoDesign video must not inherit unrelated DDPM captions");
  await page.keyboard.press("Escape");

  const methodFigure = page.locator("[data-method-figure]");
  await methodFigure.scrollIntoViewIfNeeded();
  await methodFigure.locator("[data-open-artifact]").click();
  const methodImage = page.locator("#artifact-viewer-stage img");
  await methodImage.waitFor({ state: "visible" });
  assert.ok(await methodImage.evaluate((image) => image.complete && image.naturalWidth > 0),
    "method figure inspector did not load");
  await page.keyboard.press("Escape");
}

async function runDesktop(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = watchConsole(page);
  await page.goto(url, { waitUntil: "networkidle" });
  await assertOpeningIntro(page);
  await completeOpeningIntro(page, "wheel");
  await assertStaticHero(page);
  await assertResearchAccess(page, "desktop");
  await assertLanguagePicker(page);
  await assertArtifactSuite(page);
  await page.locator("#evolution").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector(".site-header")?.classList.contains("site-header--scene"));
  await assertNoOverflow(page);
  assert.deepEqual(errors, [], `desktop console errors: ${errors.join(" | ")}`);
  await page.close();
}

async function runMobile(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = watchConsole(page);
  await page.goto(localeUrl(url, "en"), { waitUntil: "networkidle" });
  await assertOpeningIntro(page);
  await completeOpeningIntro(page, "keyboard");
  await assertStaticHero(page);
  await assertResearchAccess(page, "mobile");
  await page.locator("#artifact-studies").scrollIntoViewIfNeeded();
  const tabs = await page.locator(".artifact-tabs").evaluate((tablist) => ({
    clientWidth: tablist.clientWidth,
    scrollWidth: tablist.scrollWidth,
    tops: [...tablist.querySelectorAll("[data-artifact-tab]")].map((tab) => tab.offsetTop),
  }));
  assert.ok(tabs.scrollWidth > tabs.clientWidth, "mobile artifact tabs must remain horizontally scrollable");
  assert.equal(new Set(tabs.tops).size, 1, "mobile artifact tabs must remain on one row");
  await assertNoOverflow(page);
  assert.deepEqual(errors, [], `mobile console errors: ${errors.join(" | ")}`);
  await page.close();
}

const hostedUrl = process.env.SITE_URL;
const localServer = hostedUrl ? null : await startServer();
const server = localServer?.server;
const url = hostedUrl ? new URL(hostedUrl).href : localServer.url;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  await runDesktop(browser, url);
  await runMobile(browser, url);
  console.log("research-site static browser smoke: OK");
} finally {
  await browser?.close();
  if (server) {
    await new Promise((resolveClose) => server.close(resolveClose));
    server.closeAllConnections?.();
  }
}
