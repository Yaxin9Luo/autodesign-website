import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const noticeRoot = resolve(root, "platform-notice");
const html = await readFile(resolve(noticeRoot, "index.html"), "utf8");
const css = await readFile(resolve(noticeRoot, "styles.css"), "utf8");
const app = await readFile(resolve(noticeRoot, "app.js"), "utf8");
const headers = await readFile(resolve(noticeRoot, "_headers"), "utf8");
const installer = resolve(noticeRoot, "install.sh");

assert.match(html, /<html lang="en">/);
assert.match(html, /Run AutoDesign locally for the complete experience/);
assert.match(html, /The public online demo has been retired/);
assert.match(html, /Online generation is no longer available here/);
assert.match(html, /data-language-toggle/);
assert.match(html, /data-copy-command/g);
assert.match(html, /README\.md#quickstart/);
assert.match(html, /autodesign\.designanything\.ai/);
assert.match(css, /@media \(max-width: 560px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(app, /navigator\.clipboard\.writeText/);
assert.match(app, /README\.zh-CN\.md#quickstart/);
assert.match(app, /setLanguage\(currentLanguage === "en" \? "zh" : "en"\)/);
assert.match(headers, /Content-Security-Policy/);
assert.doesNotMatch(headers, /unsafe-inline/);

const shellCheck = spawnSync("bash", ["-n", installer], { encoding: "utf8" });
assert.equal(shellCheck.status, 0, shellCheck.stderr || "install.sh failed bash -n");

console.log("platform notice: OK (copy, local-only messaging, responsive CSS, installer syntax)");
