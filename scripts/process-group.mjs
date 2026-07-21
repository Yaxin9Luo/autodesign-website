import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const activeGroups = new Set();
const isWindows = process.platform === "win32";
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
let cleanupInstalled = false;

function groupExists(child) {
  if (!child?.pid) return false;
  if (isWindows) return child.exitCode === null && child.signalCode === null;
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    // Darwin can briefly report EPERM while retiring a process group after SIGKILL.
    if (error.code === "ESRCH" || error.code === "EPERM") return false;
    throw error;
  }
}

function signalGroup(child, signal) {
  if (!child?.pid) return;
  if (isWindows) {
    const args = ["/PID", String(child.pid), "/T"];
    if (signal === "SIGKILL") args.push("/F");
    spawnSync("taskkill", args, { stdio: "ignore", timeout: 5_000 });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function forceActiveGroups() {
  for (const child of activeGroups) {
    try {
      signalGroup(child, "SIGKILL");
    } catch {
      // Continue parent shutdown even if a child is already exiting.
    }
  }
}

function installCleanup() {
  if (cleanupInstalled) return;
  cleanupInstalled = true;
  process.once("exit", forceActiveGroups);
  for (const [signal, exitCode] of [["SIGHUP", 129], ["SIGINT", 130], ["SIGTERM", 143]]) {
    process.once(signal, () => {
      forceActiveGroups();
      process.exit(exitCode);
    });
  }
}

async function waitForGroupExit(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (groupExists(child) && Date.now() < deadline) await delay(50);
  return !groupExists(child);
}

async function stopProcessGroup(child, { graceMs, forceMs }) {
  if (!groupExists(child)) {
    activeGroups.delete(child);
    return;
  }
  signalGroup(child, "SIGTERM");
  if (!(await waitForGroupExit(child, graceMs))) {
    signalGroup(child, "SIGKILL");
    if (!(await waitForGroupExit(child, forceMs))) {
      throw new Error(`process group ${child.pid} did not terminate`);
    }
  }
  activeGroups.delete(child);
}

function processError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function runBoundedProcess(command, args, {
  timeoutMs,
  graceMs = 5_000,
  forceMs = 5_000,
  onSpawn,
  signal,
  ...options
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive");
  installCleanup();
  const child = spawn(command, args, { ...options, detached: !isWindows });
  activeGroups.add(child);
  const exit = new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, exitSignal) => resolveExit({ code, signal: exitSignal }));
  });
  let timeout;
  let handleAbort;
  const timedOut = new Promise((_, reject) => {
    timeout = setTimeout(
      () => reject(processError("ERR_PROCESS_TIMEOUT", `process exceeded ${timeoutMs}ms: ${command}`)),
      timeoutMs,
    );
  });
  const aborted = new Promise((_, reject) => {
    handleAbort = () => reject(processError("ERR_PROCESS_ABORTED", `process aborted: ${command}`));
    if (signal?.aborted) handleAbort();
    else signal?.addEventListener("abort", handleAbort, { once: true });
  });

  try {
    onSpawn?.(child);
    return await Promise.race([exit, timedOut, aborted]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", handleAbort);
    await stopProcessGroup(child, { graceMs, forceMs });
  }
}
