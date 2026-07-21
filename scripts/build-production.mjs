import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, "dist");
const runtimeFiles = [
  "_headers",
  "app.js",
  "index.html",
  "intro-audio.js",
  "intro-scene.js",
  "intro-state.js",
  "page-lifecycle.js",
  "robots.txt",
  "scene-focus.js",
  "scene-state.js",
  "site-data.js",
  "sitemap.xml",
  "styles.css",
  "three-scene.js",
];

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });
for (const file of runtimeFiles) await cp(resolve(root, file), resolve(output, file));
await cp(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });
await cp(resolve(root, "artifacts"), resolve(output, "artifacts"), { recursive: true });
await cp(resolve(root, "vendor"), resolve(output, "vendor"), { recursive: true });

console.log(`research-site production build: ${output}`);
