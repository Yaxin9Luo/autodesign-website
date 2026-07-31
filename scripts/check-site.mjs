import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => readFileSync(resolve(root, file), "utf8");
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const requiredFiles = [
  "index.html",
  "styles.css",
  "site-data.js",
  "locales.js",
  "app.js",
  "artifact-showcase.js",
  "language-menu.js",
  "page-lifecycle.js",
  "assets/brand/autodesign-editorial-background.webp",
  "assets/brand/design-agent-mark.webp",
  "assets/brand/design-agent-evolution.webp",
  "assets/paper/method-detail.webp",
  "assets/studies/autodesign-poster.webp",
  "assets/studies/autodesign-formal-slide-01.webp",
  "assets/studies/ddpm-conference-video-6min.mp4",
];

for (const file of requiredFiles) {
  expect(existsSync(resolve(root, file)), `missing ${file}`);
}

const html = read("index.html");
const styles = read("styles.css");
const app = read("app.js");
const data = read("site-data.js");

for (const id of [
  "scene-shell",
  "hero",
  "optimization",
  "artifact-studies",
  "evolution",
  "evolution-rail",
  "harness",
  "evidence",
  "metric-grid",
  "results",
  "transfer-chart",
  "resources",
  "artifact-viewer",
]) {
  expect(html.includes(`id="${id}"`), `missing #${id}`);
}

expect(html.includes('id="scene-shell" class="static-hero"'), "page must use the static editorial hero");
expect(html.includes('class="static-hero-art"'), "static editorial hero image is missing");
expect(html.includes("autodesign-editorial-background.webp?v=20260731b"), "static hero image must bypass stale deployment caches");
expect(!html.includes("artifact-canvas"), "public page must not retain the WebGL canvas");
expect(!html.includes("intro-overlay"), "public page must not retain the interactive opening overlay");
expect(!html.includes("engine-labels"), "public page must not retain the 3D engine annotations");
expect(!html.includes("poster-universe"), "public page must not retain the 3D poster universe");
expect(!app.includes("three-scene.js"), "public app must not import the WebGL scene");
expect(!app.includes("createArtifactScene"), "public app must not initialize the WebGL scene");
expect(!app.includes("bindSceneFocus"), "public app must not use scene-phase focus handling");
expect(styles.includes("#scene-shell.static-hero"), "static hero styling is missing");
expect(styles.includes(".static-hero-art"), "static hero image styling is missing");
expect(styles.includes("/* Static editorial hero"), "static hero replacement should be documented in CSS");
expect(statSync(resolve(root, "assets/brand/autodesign-editorial-background.webp")).size > 100_000,
  "static hero background is unexpectedly small");

expect(html.includes('href="#artifact-studies"'), "poster navigation must lead to the accessible artifact showcase");
expect(!html.includes('href="#posters"'), "stale 3D poster anchor remains in the public page");
expect(html.includes("https://designanything.ai"), "missing platform CTA");
expect(html.includes('id="language-menu-trigger"'), "language selector trigger is missing");
expect(html.includes('id="language-menu"'), "language selector menu is missing");

const heroAccess = html.match(/<nav class="hero-access"[\s\S]*?<\/nav>/)?.[0] ?? "";
const heroControls = [...heroAccess.matchAll(/<(a|button)\b([^>]*)>/g)];
expect(heroControls.length === 3, "hero research access must expose exactly three controls");
expect(/data-hero-access="system"/.test(heroAccess), "hero system link is missing");
expect(/data-hero-access="code"[^>]*disabled/.test(heroAccess), "unreleased code action must stay disabled");
expect(/data-hero-access="paper"[^>]*disabled/.test(heroAccess), "unreleased paper action must stay disabled");

const posterPanel = html.match(/<div class="artifact-study" id="artifact-panel-poster"[\s\S]*?<\/div>\n\s*<div class="artifact-study" id="artifact-panel-slides"/)?.[0] ?? "";
expect(Boolean(posterPanel), "poster artifact panel is missing");
expect(!posterPanel.includes("Figure 1"), "poster showcase must describe the artifact, not a paper figure number");
for (const token of [
  "data-artifact-tab=\"poster\"",
  "data-artifact-tab=\"slides\"",
  "data-artifact-tab=\"web\"",
  "data-artifact-tab=\"video\"",
  "data-slide-carousel",
  "data-open-artifact",
  "data-method-figure",
  "autodesign-poster.webp?v=20260729a",
  "autodesign-formal-slide-{index}.webp?v=20260730b",
  "ddpm-conference-video-6min.mp4?v=98e94d39",
  "assets/paper/method-detail.webp?v=20260730b",
]) {
  expect(html.includes(token), `artifact showcase missing ${token}`);
}

for (const [sourceName, source] of [["index.html", html], ["site-data.js", data]]) {
  for (const term of ["DesignHarness", "PosterBench"]) {
    expect(source.includes(term), `${sourceName} must include ${term}`);
  }
  for (const term of ["PosterHarness", "AutoPosterBench", "worker"]) {
    expect(!source.includes(term), `${sourceName} must not contain ${term}`);
  }
}

for (const claim of ["78.32", "77.97", "+7.45", "+5.01–19.56", "100"]) {
  expect(data.includes(claim), `site data is missing approved claim ${claim}`);
}

try {
  const sandbox = { window: {} };
  createContext(sandbox);
  new Script(data, { filename: "site-data.js" }).runInContext(sandbox);
  const siteData = sandbox.window.AutoDesignSiteData;
  expect(siteData?.metrics?.length === 5, "site data must expose five benchmark metrics");
  expect(siteData?.posters?.length === 12, "site data must expose twelve representative posters");
  expect(siteData?.evolution?.length === 5, "site data must expose five evolution states");
  expect(siteData?.harnessStages?.length === 5, "site data must expose five DesignHarness stages");
  expect(siteData?.transferResults?.length === 7, "site data must expose seven transfer configurations");
} catch (error) {
  failures.push(`site-data.js failed to execute: ${error.message}`);
}

for (const [file, specifier] of [
  ["index.html", "styles.css?v=20260731b"],
  ["index.html", "app.js?v=20260731b"],
  ["index.html", "site-data.js?v=20260730b"],
  ["app.js", "artifact-showcase.js?v=20260730b"],
  ["app.js", "i18n.js?v=20260730b"],
  ["artifact-showcase.js", "i18n.js?v=20260730b"],
]) {
  expect(read(file).includes(specifier), `${file} must load ${specifier}`);
}

for (const file of ["app.js", "artifact-showcase.js", "i18n.js", "language-menu.js", "page-lifecycle.js"]) {
  try {
    execFileSync(process.execPath, ["--check", resolve(root, file)], { stdio: "pipe" });
  } catch (error) {
    failures.push(`${file} has invalid module syntax: ${error.message}`);
  }
}

for (const match of html.matchAll(/(?:src|href)="\.\/([^"#?]+)(?:\?[^\"]*)?"/g)) {
  const target = resolve(root, match[1]);
  expect(existsSync(target), `broken local HTML reference: ${match[1]}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("research-site static hero contract: OK");
}
