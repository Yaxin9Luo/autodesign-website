import assert from "node:assert/strict";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runBoundedProcess } from "./process-group.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const browserCheck = fileURLToPath(new URL("./check-browser.mjs", import.meta.url));

export async function runBrowserCheck({ env = process.env, timeoutMs = 240_000 } = {}) {
  const result = await runBoundedProcess(process.execPath, [browserCheck], {
    cwd: root,
    env,
    stdio: "inherit",
    timeoutMs,
  });
  assert.equal(result.code, 0, `browser check exited ${result.code ?? `with signal ${result.signal}`}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runBrowserCheck();
