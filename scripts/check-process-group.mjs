import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { runBoundedProcess } from "./process-group.mjs";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "autodesign-process-group-"));
const leaderPidPath = join(temporaryDirectory, "leader.pid");
const childPidPath = join(temporaryDirectory, "child.pid");
const fixture = `
  import { spawn } from "node:child_process";
  import { writeFileSync } from "node:fs";
  writeFileSync(${JSON.stringify(leaderPidPath)}, String(process.pid));
  const child = spawn(process.execPath, ["--input-type=module", "-e", ${JSON.stringify('process.on("SIGTERM", () => {}); setInterval(() => {}, 1_000);')}], { stdio: "ignore" });
  writeFileSync(${JSON.stringify(childPidPath)}, String(child.pid));
  process.on("SIGTERM", () => {});
  setInterval(() => {}, 1_000);
`;

const processExists = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
};

try {
  await assert.rejects(
    runBoundedProcess(process.execPath, ["--input-type=module", "-e", fixture], {
      stdio: "ignore",
      timeoutMs: 500,
      graceMs: 100,
      forceMs: 2_000,
    }),
    (error) => error.code === "ERR_PROCESS_TIMEOUT",
  );
  const pids = await Promise.all([leaderPidPath, childPidPath]
    .map(async (path) => Number(await readFile(path, "utf8"))));
  const deadline = Date.now() + 2_000;
  while (pids.some(processExists) && Date.now() < deadline) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  assert.deepEqual(pids.map(processExists), [false, false],
    `timed-out process group survived: ${pids.join(", ")}`);
  console.log("research-site process group cleanup: OK");
} finally {
  for (const path of [leaderPidPath, childPidPath]) {
    const pid = Number(await readFile(path, "utf8").catch(() => ""));
    if (!pid || !processExists(pid)) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  await rm(temporaryDirectory, { force: true, recursive: true });
}
