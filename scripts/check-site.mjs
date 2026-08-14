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
  "opening-intro.js",
  "intro-scene.js",
  "intro-state.js",
  "language-menu.js",
  "page-lifecycle.js",
  "assets/brand/autodesign-editorial-background.webp",
  "assets/brand/design-agent-mark.webp",
  "assets/brand/design-agent-evolution.webp",
  "assets/paper/method-detail.webp",
  "assets/studies/autodesign-poster.webp",
  "assets/studies/autodesign-formal-slide-01.webp",
  "assets/studies/autodesign-conference-poster.webp",
  "assets/studies/autodesign-conference-teaser.mp4",
  "assets/studies/autodesign-conference-video-6min.mp4",
  "assets/tutorials/autodesign-workbench-tutorial.mp4",
  "assets/tutorials/autodesign-workbench-tutorial-poster.jpg",
];

for (const file of requiredFiles) {
  expect(existsSync(resolve(root, file)), `missing ${file}`);
}

const html = read("index.html");
const styles = read("styles.css");
const app = read("app.js");
const openingIntro = read("opening-intro.js");
const introScene = read("intro-scene.js");
const data = read("site-data.js");
const posterArtifact = read("artifacts/posters/autodesign/index.html");

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
expect(!html.includes("artifact-canvas"), "public page must not retain the retired 3D artifact canvas");
expect(html.includes('id="intro-overlay"'), "public page must retain the interactive opening overlay");
expect(html.includes('id="intro-canvas"'), "opening overlay must have a dedicated particle canvas");
expect(!html.includes("intro-output-key"), "opening interaction must not enumerate artifact cards after the explosion");
expect(!html.includes("engine-labels"), "public page must not retain the 3D engine annotations");
expect(!html.includes("poster-universe"), "public page must not retain the 3D poster universe");
expect(!app.includes("three-scene.js"), "public app must not import the retired artifact scene");
expect(!app.includes("createArtifactScene"), "public app must not initialize the retired artifact scene");
expect(!app.includes("bindSceneFocus"), "public app must not use scene-phase focus handling");
expect(app.includes("createOpeningIntro"), "public app must initialize the opening interaction");
expect(!openingIntro.includes("INTRO_ASSETS"), "opening interaction must not load post-explosion artifact textures");
expect(!openingIntro.includes("assets/studies/"), "opening interaction must not fetch showcase assets");
for (const token of [
  "createArtifact",
  "Poster dominant artifact",
  "Slides satellite group",
  "Web satellite group",
  "Video satellite group",
  "outputGroup",
]) {
  expect(!introScene.includes(token), `opening interaction must not retain ${token}`);
}
expect(introScene.includes("structureFade"), "opening interaction must retain a particle-only post-explosion finish");
expect(styles.includes("#scene-shell.static-hero"), "static hero styling is missing");
expect(styles.includes(".static-hero-art"), "static hero image styling is missing");
expect(styles.includes("/* Static editorial hero"), "static hero replacement should be documented in CSS");
expect(statSync(resolve(root, "assets/brand/autodesign-editorial-background.webp")).size > 100_000,
  "static hero background is unexpectedly small");

expect(html.includes('href="#artifact-studies"'), "poster navigation must lead to the accessible artifact showcase");
expect(!html.includes('href="#posters"'), "stale 3D poster anchor remains in the public page");
expect(html.includes("https://designanything.ai"), "missing platform CTA");
const headerCta = html.match(/<a class="header-cta"[\s\S]*?<\/a>/)?.[0] ?? "";
expect(headerCta.includes("Open Research Demo"), "header CTA must use the approved Open Research Demo label");
expect(headerCta.includes("data-i18n=\"nav.openResearchDemo\""), "header CTA must have a dedicated localization key");
expect(html.includes('id="language-menu-trigger"'), "language selector trigger is missing");
expect(html.includes('id="language-menu"'), "language selector menu is missing");

const heroAccess = html.match(/<nav class="hero-access"[\s\S]*?<\/nav>/)?.[0] ?? "";
const heroControls = [...heroAccess.matchAll(/<(a|button)\b([^>]*)>/g)];
expect(heroControls.length === 4, "hero research access must expose exactly four controls");
expect(/data-hero-access="system"/.test(heroAccess), "hero system link is missing");
expect(/data-hero-access="tutorial"[^>]*data-artifact-kind="video"/.test(heroAccess), "hero tutorial video action is missing");
expect(/autodesign-workbench-tutorial\.mp4/.test(heroAccess), "hero tutorial must use the workbench video");
expect(/<a[^>]*data-hero-access="code"[^>]*href="https:\/\/github\.com\/Yaxin9Luo\/AutoDesign"/.test(heroAccess), "hero code link must target the public GitHub repository");
expect(/<a[^>]*data-hero-access="paper"[^>]*href="https:\/\/arxiv\.org\/abs\/2608\.13560"/.test(heroAccess), "hero paper link must target the public arXiv paper");
expect(!heroAccess.includes("Code release planned"), "hero must not retain the unreleased-code placeholder");
expect(!heroAccess.includes("Coming soon"), "hero must not retain the unpublished-paper placeholder");
expect(html.includes('href="https://github.com/Yaxin9Luo/AutoDesign"'), "research code link is missing");
expect(html.includes('href="https://arxiv.org/abs/2608.13560"'), "paper link is missing");
expect(!html.includes("resource-link--pending"), "public resources must not render as pending");
const audibleConferenceVideoTriggers = html.match(/data-artifact-autoplay="true" data-artifact-audible="true" data-artifact-src="\.\/assets\/studies\/autodesign-conference-video-6min\.mp4\?v=20260731c"/g) ?? [];
expect(audibleConferenceVideoTriggers.length === 2, "both conference-video triggers must start the full audio player");

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
  "autodesign-conference-video-6min.mp4?v=20260731c",
  "assets/paper/method-detail.webp?v=20260730b",
]) {
  expect(html.includes(token), `artifact showcase missing ${token}`);
}
expect(!html.includes("ddpm-conference"), "artifact showcase must not retain the previous DDPM video");
expect(
  /<p class="poster-authors"[^>]*>Yaxin Luo, Haobin Jiang, Jialv Zou, Xu Huang, Wenhao Yan, Haodong Li, Zhengrong Yue, Jing Li, Xiaofu Chen, Xiaohan Zhao, Jiacheng Liu, Jiacheng Cui, Zhiqian Shen, Xiaotong Li<\/p>/.test(posterArtifact),
  "AutoDesign poster must carry the complete author roster in static HTML",
);

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
  ["index.html", "styles.css?v=20260806a"],
  ["index.html", "app.js?v=20260814a"],
  ["index.html", "site-data.js?v=20260730b"],
  ["index.html", "i18n.js?v=20260806a"],
  ["index.html", "language-menu.js?v=20260806a"],
  ["app.js", "artifact-showcase.js?v=20260814a"],
  ["app.js", "i18n.js?v=20260806a"],
  ["app.js", "opening-intro.js?v=20260812a"],
  ["opening-intro.js", "intro-scene.js?v=20260812a"],
  ["opening-intro.js", "intro-state.js?v=20260803a"],
  ["artifact-showcase.js", "i18n.js?v=20260806a"],
  ["opening-intro.js", "i18n.js?v=20260806a"],
  ["language-menu.js", "i18n.js?v=20260806a"],
  ["language-menu.js", "locales.js?v=20260806a"],
  ["i18n.js", "locales.js?v=20260806a"],
]) {
  expect(read(file).includes(specifier), `${file} must load ${specifier}`);
}

for (const file of ["app.js", "artifact-showcase.js", "i18n.js", "language-menu.js", "opening-intro.js", "page-lifecycle.js"]) {
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
