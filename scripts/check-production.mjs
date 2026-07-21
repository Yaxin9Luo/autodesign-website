import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const required = [
  "_headers",
  "app.js",
  "index.html",
  "intro-audio.js",
  "intro-scene.js",
  "intro-state.js",
  "robots.txt",
  "sitemap.xml",
  "styles.css",
  "three-scene.js",
  "assets/posters/attention-1600.webp",
  "assets/studies/longcat-next-poster.webp",
  "assets/studies/ddpm-conference-teaser.mp4",
  "assets/studies/ddpm-conference-video-6min.mp4",
  "assets/studies/ddpm-conference.en.vtt",
  "assets/studies/SAM2-motion-explainer.mp4",
  "artifacts/slides/longcat-next/index.html",
  "artifacts/web/longcat-next/index.html",
  "vendor/three/three.module.min.js",
];
const forbidden = ["node_modules", "scripts", "package.json", "package-lock.json", "README.md"];

required.forEach((file) => assert.equal(existsSync(resolve(root, file)), true, `missing production file: ${file}`));
forbidden.forEach((file) => assert.equal(existsSync(resolve(root, file)), false, `development file leaked into dist: ${file}`));

const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(root);
assert.ok(files.length < 500, `unexpected production file count: ${files.length}`);
for (const file of files) {
  assert.ok(statSync(file).size < 25 * 1024 * 1024, `production file exceeds 25 MiB: ${file}`);
}

const html = readFileSync(resolve(root, "index.html"), "utf8");
assert.match(html, /https:\/\/autodesign\.designanything\.ai\//, "production canonical URL is missing");
const importMap = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
assert.ok(importMap, "production import map is missing");
const importMapHash = `sha256-${createHash("sha256").update(importMap).digest("base64")}`;
const headers = readFileSync(resolve(root, "_headers"), "utf8");
assert.ok(headers.includes(`'${importMapHash}'`), "CSP does not allow the production import map");
assert.match(headers, /style-src 'self' 'unsafe-inline'/, "CSP blocks runtime layout styles");
for (const match of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)) {
  assert.equal(existsSync(resolve(root, match[1])), true, `broken HTML asset reference: ${match[1]}`);
}

for (const file of files.filter((path) => extname(path) === ".js")) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/(?:from\s+|import\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
    const imported = resolve(file, "..", match[1]);
    assert.equal(existsSync(imported), true, `broken JavaScript import in ${file}: ${match[1]}`);
  }
}

console.log(`research-site production package: OK (${files.length} files)`);
