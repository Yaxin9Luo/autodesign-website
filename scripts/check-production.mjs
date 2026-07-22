import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const required = [
  "_headers",
  "app.js",
  "artifact-showcase.js",
  "i18n.js",
  "index.html",
  "intro-audio.js",
  "intro-scene.js",
  "intro-state.js",
  "language-menu.js",
  "locales.js",
  "robots.txt",
  "sitemap.xml",
  "styles.css",
  "three-scene.js",
  "assets/posters/attention-1600.webp",
  "assets/studies/longcat-next-poster.webp",
  ...Array.from({ length: 12 }, (_, index) => `assets/studies/longcat-next-slide-${String(index + 1).padStart(2, "0")}.webp`),
  "assets/studies/ddpm-conference-teaser.mp4",
  "assets/studies/ddpm-conference-video-6min.mp4",
  "assets/studies/ddpm-conference.en.vtt",
  "assets/studies/slide-03.webp",
  "assets/studies/video-poster.webp",
  "assets/studies/webpage.webp",
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
const headerBlock = (route) => {
  const start = headers.indexOf(`${route}\n`);
  assert.notEqual(start, -1, `missing _headers route: ${route}`);
  const end = headers.indexOf("\n\n", start);
  return headers.slice(start, end === -1 ? headers.length : end);
};
const wildcardHeaders = headerBlock("/*");
assert.doesNotMatch(wildcardHeaders, /Content-Security-Policy:/,
  "wildcard headers must not impose the application CSP on standalone artifacts");
for (const route of ["/", "/index.html"]) {
  const applicationHeaders = headerBlock(route);
  assert.ok(applicationHeaders.includes(`'${importMapHash}'`), `${route} CSP does not allow the production import map`);
  assert.match(applicationHeaders, /style-src 'self' 'unsafe-inline'/, `${route} CSP blocks runtime layout styles`);
  assert.match(applicationHeaders, /frame-src 'self'/, `${route} CSP blocks same-origin artifact frames`);
  assert.match(applicationHeaders, /frame-ancestors 'none'/, `${route} CSP must reject embedding`);
}
const inlineHashes = (file, tag) => {
  const source = readFileSync(resolve(root, file), "utf8");
  return [...source.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((match) => `sha256-${createHash("sha256").update(match[1]).digest("base64")}`);
};
for (const [route, file] of [
  ["/artifacts/slides/longcat-next/*", "artifacts/slides/longcat-next/index.html"],
  ["/artifacts/web/longcat-next/*", "artifacts/web/longcat-next/index.html"],
]) {
  const artifactHeaders = headerBlock(route);
  assert.match(artifactHeaders, /default-src 'none'/, `${route} CSP must deny unspecified sources`);
  assert.match(artifactHeaders, /connect-src 'self' https:\/\/cloudflareinsights\.com/,
    `${route} CSP must allow Cloudflare same-origin RUM reporting`);
  assert.match(artifactHeaders, /frame-ancestors 'self'/, `${route} CSP must allow only same-origin framing`);
  assert.doesNotMatch(artifactHeaders, /'unsafe-inline'/, `${route} CSP must hash inline code`);
  for (const hash of [...inlineHashes(file, "script"), ...inlineHashes(file, "style")]) {
    assert.ok(artifactHeaders.includes(`'${hash}'`), `${route} CSP is missing inline hash ${hash}`);
  }
}
for (const match of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)) {
  assert.equal(existsSync(resolve(root, match[1])), true, `broken HTML asset reference: ${match[1]}`);
}

for (const file of files.filter((path) => extname(path) === ".js")) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/(?:from\s+|import\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
    const imported = resolve(file, "..", match[1].split(/[?#]/, 1)[0]);
    assert.equal(existsSync(imported), true, `broken JavaScript import in ${file}: ${match[1]}`);
  }
}

console.log(`research-site production package: OK (${files.length} files)`);
