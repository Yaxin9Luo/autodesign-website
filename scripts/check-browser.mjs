import assert from "node:assert/strict";
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const sourceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = resolve(sourceRoot, process.env.SITE_ROOT ?? ".");
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".svg", "image/svg+xml"],
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

function watchConsole(page, expectedError = () => false) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !expectedError(message.text())) errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (!expectedError(error.message)) errors.push(error.message);
  });
  return errors;
}

async function waitForPhase(page, phase, timeout = 15_000) {
  try {
    await page.waitForFunction(
      (expected) => document.getElementById("scene-shell")?.dataset.introPhase === expected,
      phase,
      { timeout },
    );
  } catch (error) {
    const state = await page.locator("#scene-shell").evaluate((element) => ({
      drawCalls: element.dataset.drawCalls,
      fallback: element.classList.contains("webgl-fallback"),
      introPhase: element.dataset.introPhase,
      scene: element.querySelector("canvas")?.dataset.scene,
    })).catch(() => ({ unavailable: true }));
    if (state.introPhase === phase) return;
    throw new Error(`Timed out waiting for intro phase ${phase}: ${JSON.stringify(state)}`, { cause: error });
  }
}

async function openArmed(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await waitForPhase(page, "armed");
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `horizontal overflow: ${overflow}px`);
}

async function assertDrawCalls(page, maximum) {
  await page.waitForFunction(() => Number(document.getElementById("scene-shell")?.dataset.drawCalls) > 0);
  const drawCalls = await page.locator("#scene-shell").getAttribute("data-draw-calls");
  assert.ok(Number(drawCalls) > 1, `expected a real 3D render, got ${drawCalls} draw call(s)`);
  assert.ok(Number(drawCalls) <= maximum, `draw calls exceeded ${maximum}: ${drawCalls}`);
}

async function runDesktop(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = watchConsole(page);
  await openArmed(page, url);
  assert.equal(await page.locator("#scene-shell").evaluate((element) => element.classList.contains("webgl-fallback")), false);
  await assertNoOverflow(page);
  await assertDrawCalls(page, 120);

  await page.locator("#intro-sound").focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#intro-sound").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#scene-shell").getAttribute("data-intro-phase"), "armed");
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#intro-sound").getAttribute("aria-pressed"), "false");

  await page.locator("#intro-sound").evaluate((element) => element.blur());
  await page.keyboard.press("Space");
  await waitForPhase(page, "complete");
  assert.equal(await page.locator("#intro-replay").isVisible(), true);

  assert.equal(await page.locator("[data-artifact-tab]").count(), 4);
  assert.equal(await page.locator("#artifact-panel-poster").isVisible(), true);
  assert.equal(await page.locator("#artifact-panel-video source").getAttribute("src"), null);
  await page.locator("#artifact-tab-poster").focus();
  await page.keyboard.press("End");
  assert.equal(await page.locator("#artifact-tab-video").getAttribute("aria-selected"), "true");
  await page.keyboard.press("Home");
  assert.equal(await page.locator("#artifact-tab-poster").getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator("#artifact-tab-video").getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#artifact-tab-poster").getAttribute("aria-selected"), "true");
  await page.locator("#artifact-tab-video").click();
  await page.waitForFunction(() => document.querySelector("#artifact-panel-video source")?.src.endsWith("ddpm-conference-teaser.mp4"));
  await page.locator("#artifact-tab-poster").click();
  await page.waitForFunction(() => {
    const video = document.querySelector("#artifact-panel-video video");
    const source = video?.querySelector("source");
    return video?.paused && !source?.hasAttribute("src") && video.networkState === video.NETWORK_NO_SOURCE;
  });

  for (const name of ["poster", "slides", "web", "video"]) {
    await page.locator(`#artifact-tab-${name}`).click();
    const trigger = page.locator(`#artifact-panel-${name} [data-open-artifact]`);
    const kind = await trigger.getAttribute("data-artifact-kind");
    const source = await trigger.getAttribute("data-artifact-src");
    await trigger.click();
    const artifact = page.locator(`#artifact-viewer-stage ${kind === "image" ? "img" : kind}`);
    await artifact.waitFor({ state: "visible" });
    const detachedVideo = kind === "video" ? await artifact.elementHandle() : null;
    assert.equal(await artifact.getAttribute("src"), source);
    assert.equal(await page.locator("#artifact-viewer-stage").locator(kind === "image" ? "img" : kind).count(), 1);
    if (kind === "iframe") {
      assert.notEqual(await artifact.getAttribute("sandbox"), null);
    }
    if (kind === "video") {
      const captions = artifact.locator('track[kind="captions"][srclang="en"]');
      assert.equal(await captions.getAttribute("src"), "./assets/studies/ddpm-conference.en.vtt");
      assert.equal(await captions.getAttribute("default"), "");
    }
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.locator("#artifact-viewer-external").evaluate((element) => document.activeElement === element), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator("#artifact-viewer .artifact-viewer__close").evaluate((element) => document.activeElement === element), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#artifact-viewer-stage").evaluate((stage) => stage.childElementCount), 0);
    if (detachedVideo) {
      assert.deepEqual(await detachedVideo.evaluate((video) => ({
        paused: video.paused,
        references: [...video.querySelectorAll("source, track")].map((element) => element.getAttribute("src")),
        source: video.getAttribute("src"),
        unloaded: [video.NETWORK_EMPTY, video.NETWORK_NO_SOURCE].includes(video.networkState),
      })), { paused: true, references: [null], source: null, unloaded: true });
      await detachedVideo.dispose();
    }
    assert.equal(await trigger.evaluate((element) => document.activeElement === element), true);
  }

  await page.locator("#intro-replay").click();
  await waitForPhase(page, "armed");
  assert.equal(await page.locator("#artifact-canvas").count(), 1);
  assert.equal(await page.locator("#scene-shell").getAttribute("data-intro-phase"), "armed");

  assert.deepEqual(errors, [], `desktop console errors: ${errors.join(" | ")}`);
  await page.close();
}

async function runMobile(browser, url) {
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = watchConsole(page);
  await openArmed(page, url);
  await assertNoOverflow(page);
  await assertDrawCalls(page, 70);
  await page.keyboard.press("ArrowDown");
  await waitForPhase(page, "complete");
  assert.deepEqual(errors, [], `mobile console errors: ${errors.join(" | ")}`);
  await page.close();
}

async function runReducedMotion(browser, url) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const errors = watchConsole(page);
  await openArmed(page, url);
  await page.keyboard.press("ArrowDown");
  await waitForPhase(page, "complete", 1_500);
  await page.locator("#artifact-tab-video").click();
  const teaserState = await page.locator("#artifact-panel-video video").evaluate((video) => ({
    networkState: video.networkState,
    paused: video.paused,
    source: video.querySelector("source")?.getAttribute("src") ?? null,
  }));
  assert.deepEqual(teaserState, { networkState: 3, paused: true, source: null });
  assert.deepEqual(errors, [], `reduced-motion console errors: ${errors.join(" | ")}`);
  await page.close();
}

async function runSaveData(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    const connection = new EventTarget();
    Object.defineProperty(connection, "saveData", { value: true });
    Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
  });
  const errors = watchConsole(page);
  await openArmed(page, url);
  await page.keyboard.press("ArrowDown");
  await waitForPhase(page, "complete");
  await page.locator("#artifact-tab-video").click();
  const teaserState = await page.locator("#artifact-panel-video video").evaluate((video) => ({
    networkState: video.networkState,
    paused: video.paused,
    source: video.querySelector("source")?.getAttribute("src") ?? null,
  }));
  assert.deepEqual(teaserState, { networkState: 3, paused: true, source: null });
  assert.deepEqual(errors, [], `save-data console errors: ${errors.join(" | ")}`);
  await page.close();
}

async function runFallback(browser, url, initializationFailure = false) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  if (initializationFailure) {
    await page.addInitScript(() => {
      globalThis.ResizeObserver = class {
        constructor() {
          throw new Error("Injected ResizeObserver initialization failure");
        }
      };
    });
  } else {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patchedGetContext(kind, ...args) {
        if (kind === "webgl" || kind === "webgl2") return null;
        return getContext.call(this, kind, ...args);
      };
    });
  }
  const errors = watchConsole(
    page,
    (message) => initializationFailure && message.includes("scene initialization failed"),
  );
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.getElementById("scene-shell")?.classList.contains("webgl-fallback"));
  assert.equal(await page.locator("#intro-enter").isVisible(), true);
  await page.locator("#intro-enter").click();
  await waitForPhase(page, "complete", 1_500);
  assert.deepEqual(errors, [], `fallback console errors: ${errors.join(" | ")}`);
  await page.close();
}

const hostedUrl = process.env.SITE_URL;
const localServer = hostedUrl ? null : await startServer();
const server = localServer?.server;
const url = hostedUrl ? new URL(hostedUrl).href : localServer.url;
let browser;
try {
  const browserName = process.env.PLAYWRIGHT_BROWSER ?? "chromium";
  const browserType = browserName === "webkit" ? webkit : chromium;
  const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "chromium";
  browser = await browserType.launch({
    ...(browserName === "chromium" && browserChannel !== "chromium" ? { channel: browserChannel } : {}),
    headless: true,
  });
  await runDesktop(browser, url);
  await runMobile(browser, url);
  await runReducedMotion(browser, url);
  await runSaveData(browser, url);
  await runFallback(browser, url, false);
  await runFallback(browser, url, true);
  console.log("research-site browser smoke: OK");
} finally {
  await browser?.close();
  if (server) {
    await new Promise((resolveClose) => server.close(resolveClose));
    server.closeAllConnections?.();
  }
}
