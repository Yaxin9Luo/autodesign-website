import assert from "node:assert/strict";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBoundedProcess } from "./process-group.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const browserProbe = resolve(root, "scripts/check-production-browser.mjs");
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function reservePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const port = address.port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

const port = await reservePort();
const url = `http://127.0.0.1:${port}/`;
const abortWrangler = new AbortController();
const wranglerState = {};
let wrangler;
let wranglerLog = "";
const appendLog = (chunk) => {
  wranglerLog = (wranglerLog + chunk).slice(-20_000);
};
const wranglerRun = runBoundedProcess(process.execPath, [
  resolve(root, "node_modules/wrangler/bin/wrangler.js"),
  "pages",
  "dev",
  "dist",
  "--ip",
  "127.0.0.1",
  "--port",
  String(port),
], {
  cwd: root,
  env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
  onSpawn: (child) => {
    wrangler = child;
    child.stdout.on("data", appendLog);
    child.stderr.on("data", appendLog);
  },
  signal: abortWrangler.signal,
  stdio: ["ignore", "pipe", "pipe"],
  timeoutMs: 120_000,
}).then(
  (result) => { wranglerState.result = result; },
  (error) => { wranglerState.error = error; },
);

let failure;
try {
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    if (wranglerState.error || wrangler?.exitCode !== null) {
      await wranglerRun;
      throw new Error(
        `wrangler pages dev exited before readiness: ${JSON.stringify(wranglerState.result)}\n${wranglerLog}`,
        wranglerState.error ? { cause: wranglerState.error } : undefined,
      );
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      ready = response.ok;
      await response.body?.cancel();
    } catch {
      await delay(150);
    }
  }
  assert.equal(ready, true, `wrangler pages dev did not become ready\n${wranglerLog}`);

  const mainResponse = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  assert.equal(mainResponse.status, 200);
  const mainCsp = mainResponse.headers.get("content-security-policy") ?? "";
  assert.match(mainCsp, /frame-src 'self'/, "production root CSP must allow same-origin artifact frames");
  assert.match(mainCsp, /frame-ancestors 'none'/, "production root CSP must reject embedding");
  await mainResponse.body?.cancel();

  for (const path of [
    "artifacts/slides/longcat-next/index.html",
    "artifacts/web/longcat-next/index.html",
  ]) {
    const response = await fetch(new URL(path, url), { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200, `${path} did not return 200`);
    const csp = response.headers.get("content-security-policy") ?? "";
    assert.match(csp, /default-src 'none'/, `${path} is missing its standalone artifact CSP`);
    assert.match(csp, /frame-ancestors 'self'/, `${path} must allow same-origin embedding`);
    assert.doesNotMatch(csp, /frame-ancestors 'none'/,
      `${path} inherited the application frame-ancestor policy`);
    assert.doesNotMatch(csp, /'unsafe-inline'/, `${path} CSP must hash inline code`);
    await response.body?.cancel();
  }

  const browserResult = await runBoundedProcess(process.execPath, [browserProbe], {
    cwd: root,
    env: { ...process.env, SITE_URL: url },
    stdio: "inherit",
    timeoutMs: 60_000,
  });
  assert.equal(browserResult.code, 0,
    `production browser probe exited ${browserResult.code ?? `with signal ${browserResult.signal}`}`);
} catch (error) {
  failure = error;
} finally {
  abortWrangler.abort();
  await wranglerRun;
  if (!failure && wranglerState.error?.code !== "ERR_PROCESS_ABORTED") {
    failure = new Error(`wrangler pages dev failed\n${wranglerLog}`, { cause: wranglerState.error });
  }
  if (!failure && wranglerState.result) {
    failure = new Error(
      `wrangler pages dev exited unexpectedly: ${JSON.stringify(wranglerState.result)}\n${wranglerLog}`,
    );
  }
}

if (failure) throw failure;
console.log("research-site production host: OK (Cloudflare Pages headers + focused browser probe)");
