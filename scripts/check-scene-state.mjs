import assert from "node:assert/strict";
import {
  allowsPointerParallax,
  AUTHORED_SCENE_TARGETS,
  clamp01,
  getAuthoredSceneProgress,
  isCompactPosterViewport,
  getReducedMotionProgress,
  segmentProgress,
  getPosterProgress,
  getSceneState,
  getPosterPose,
  getWidePosterPose,
  POSTER_SEQUENCE_END,
  POSTER_SEQUENCE_START,
  POSTER_WIDE_START,
} from "../scene-state.js";

assert.equal(getAuthoredSceneProgress("hero", 8), AUTHORED_SCENE_TARGETS.hero);
assert.equal(getAuthoredSceneProgress("system", 8), AUTHORED_SCENE_TARGETS.system);
assert.equal(AUTHORED_SCENE_TARGETS.system, 0.31);
assert.equal(getAuthoredSceneProgress("artifacts", 8), POSTER_SEQUENCE_START);
assert.equal(getAuthoredSceneProgress("poster", 8, 4), getPosterProgress(4, 8));
assert.equal(getAuthoredSceneProgress("finale", 8), 1);

const authoredStops = new Set([
  ...Object.values(AUTHORED_SCENE_TARGETS),
  ...Array.from({ length: 8 }, (_, index) => getPosterProgress(index, 8)),
]);
for (let step = 0; step <= 100; step += 1) {
  assert.ok(authoredStops.has(getReducedMotionProgress(step / 100, 8)));
}
assert.equal(getReducedMotionProgress(0.01, 8), AUTHORED_SCENE_TARGETS.hero);
assert.equal(getReducedMotionProgress(0.23, 8), AUTHORED_SCENE_TARGETS.system);
assert.equal(
  getReducedMotionProgress(getPosterProgress(5, 8) + 0.001, 8),
  getPosterProgress(5, 8),
);

assert.equal(allowsPointerParallax({ pointerType: "touch", finePointer: true, compact: false }), false);
assert.equal(allowsPointerParallax({ pointerType: "mouse", finePointer: false, compact: false }), false);
assert.equal(allowsPointerParallax({ pointerType: "mouse", finePointer: true, compact: true }), false);
assert.equal(allowsPointerParallax({ pointerType: "mouse", finePointer: true, compact: false }), true);

for (const width of [390, 768, 1024, 1099, 1100]) {
  assert.equal(isCompactPosterViewport(width), true);
}
for (const width of [1101, 1280, 1440]) {
  assert.equal(isCompactPosterViewport(width), false);
}

assert.equal(clamp01(-1), 0);
assert.equal(clamp01(2), 1);
assert.equal(segmentProgress(0.25, 0.2, 0.4), 0.25);
assert.equal(getSceneState(0, 8).phase, "dormant");
assert.equal(getSceneState(0.25, 8).phase, "ingest");
assert.equal(getSceneState(0.45, 8).phase, "interior");
assert.equal(getSceneState(0.62, 8).phase, "evaluate");
assert.equal(getSceneState(0.9, 8).phase, "universe");
const epsilon = 1e-6;
for (const [boundary, phase, previousPhase] of [
  [0.16, "ingest", "dormant"],
  [0.36, "interior", "ingest"],
  [0.56, "evaluate", "interior"],
  [0.70, "universe", "evaluate"],
]) {
  assert.equal(getSceneState(boundary, 8).phase, phase);
  assert.equal(getSceneState(boundary - epsilon, 8).phase, previousPhase);
}
assert.equal(getSceneState(1, 8).activePoster, 7);
assert.equal(getSceneState(0.86, 8).activePoster, 5);
assert.ok(getSceneState(0.86, 8).posterMix > 0);

const posterAExiting = getSceneState(0.57, 8);
assert.ok(posterAExiting.outputAExit > 0);
assert.ok(posterAExiting.diagnosticSweep > 0);
assert.equal(posterAExiting.diagnosticReturn, 0);
assert.equal(posterAExiting.repairLocked, 0);
assert.equal(posterAExiting.outputBEnter, 0);
const diagnosticReturning = getSceneState(0.605, 8);
assert.equal(diagnosticReturning.outputAExit, 1);
assert.ok(diagnosticReturning.diagnosticReturn > 0);
assert.equal(diagnosticReturning.repairLocked, 0);
assert.equal(diagnosticReturning.outputBEnter, 0);
const repairLocking = getSceneState(0.635, 8);
assert.equal(repairLocking.outputAExit, 1);
assert.equal(repairLocking.diagnosticReturn, 1);
assert.ok(repairLocking.repairLocked > 0);
assert.equal(repairLocking.outputBEnter, 0);
const posterBEmerging = getSceneState(0.67, 8);
assert.equal(posterBEmerging.outputAExit, 1);
assert.equal(posterBEmerging.repairLocked, 1);
assert.ok(posterBEmerging.outputBEnter > 0);
assert.equal(getSceneState(0.64, 8).outputBEnter, 0);
assert.ok(getSceneState(0.66, 8).outputBEnter > 0.5);
assert.equal(getSceneState(0.67, 8).outputBEnter, 1);

const posterCount = 8;
const posterStops = Array.from(
  { length: posterCount },
  (_, index) => getPosterProgress(index, posterCount),
);
assert.equal(posterStops[0], POSTER_SEQUENCE_START);
assert.equal(posterStops.at(-1), POSTER_SEQUENCE_END);
assert.ok(POSTER_SEQUENCE_END < POSTER_WIDE_START);
const selectedSequence = posterStops.map((progress) => getSceneState(progress, posterCount).activePoster);
assert.deepEqual(selectedSequence, [0, 1, 2, 3, 4, 5, 6, 7]);
for (const progress of posterStops) {
  assert.equal(getSceneState(progress, posterCount).wide, 0);
}
assert.equal(getSceneState(POSTER_SEQUENCE_END, posterCount).posterPosition, 1);
assert.equal(getSceneState(POSTER_SEQUENCE_END, posterCount).activePoster, 7);
assert.equal(getSceneState(POSTER_SEQUENCE_END, posterCount).wide, 0);
assert.equal(getSceneState((POSTER_SEQUENCE_END + POSTER_WIDE_START) / 2, posterCount).wide, 0);
assert.equal(getSceneState(POSTER_WIDE_START, posterCount).wide, 0);
assert.ok(getSceneState(POSTER_WIDE_START + 0.01, posterCount).wide > 0);
assert.ok(getSceneState(POSTER_WIDE_START + 0.01, posterCount).wide < 1);
assert.equal(getSceneState(1, posterCount).wide, 1);

for (let step = -20; step <= 20; step += 1) {
  const activePoster = getSceneState(step / 10, posterCount).activePoster;
  assert.ok(activePoster >= 0 && activePoster < posterCount);
}

const activePose = getPosterPose(3, 3, false);
assert.deepEqual(activePose, { x: 0, y: 0.28, z: 0.9, ry: 0, scale: 1, opacity: 1 });
const fullPoses = [0, 1, 2, 4, 5, 6, 7].map((index) => getPosterPose(index, 3, false));
for (const pose of fullPoses) {
  assert.ok(Math.abs(pose.x) <= 8);
  assert.ok(pose.z <= -0.75);
  assert.ok(Math.abs(pose.ry) >= 0.3);
  assert.ok(pose.scale < 1);
}
assert.ok(getPosterPose(2, 3, false).x < 0);
assert.ok(getPosterPose(4, 3, false).x > 0);
assert.ok(getPosterPose(1, 3, false).z < getPosterPose(2, 3, false).z);
assert.ok(getPosterPose(5, 3, false).z < getPosterPose(4, 3, false).z);

const compactActivePose = getPosterPose(3, 3, true);
for (let index = 0; index < posterCount; index += 1) {
  const pose = getPosterPose(index, 3, true);
  if (index === 3) {
    assert.deepEqual(pose, compactActivePose);
    continue;
  }
  assert.equal(pose.x, compactActivePose.x);
  assert.equal(pose.y, compactActivePose.y);
  assert.ok(pose.z < compactActivePose.z);
  assert.equal(pose.opacity, 0);
}

const widePoses = Array.from({ length: posterCount }, (_, index) => getWidePosterPose(index, posterCount));
assert.ok(widePoses.at(-1).x - widePoses[0].x >= 16);
assert.ok(Math.max(...widePoses.map((pose) => pose.y)) - Math.min(...widePoses.map((pose) => pose.y)) >= 1.5);
assert.ok(widePoses.every((pose) => pose.opacity === 1));
assert.ok(widePoses.every((pose) => pose.scale >= 0.72));
console.log("research-site scene state: OK");
