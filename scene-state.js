const STOPS = Object.freeze({
  dormant: 0,
  ingest: 0.16,
  interior: 0.36,
  evaluate: 0.56,
  universe: 0.70,
});
export const POSTER_COMPACT_MAX_WIDTH = 1100;
export const POSTER_SEQUENCE_START = 0.72;
export const POSTER_SEQUENCE_END = 0.93;
export const POSTER_WIDE_START = 0.95;
export const AUTHORED_SCENE_TARGETS = Object.freeze({
  hero: 0,
  system: 0.31,
  interior: 0.46,
  evaluation: 0.605,
  accepted: 0.67,
  artifacts: POSTER_SEQUENCE_START,
  finale: 1,
});

const finiteNumber = (value) => (Number.isFinite(value) ? value : 0);

export function clamp01(value) {
  return Math.min(1, Math.max(0, finiteNumber(value)));
}

export function segmentProgress(value, start, end) {
  const progress = clamp01(value);
  const from = clamp01(start);
  const to = clamp01(end);
  if (to <= from) return progress >= to ? 1 : 0;
  return clamp01(Math.round(((progress - from) / (to - from)) * 1e12) / 1e12);
}

const normalizePosterCount = (value) => Math.max(0, Math.floor(finiteNumber(value)));
const normalizePosterIndex = (value) => Math.max(0, Math.floor(finiteNumber(value)));

export function isCompactPosterViewport(width) {
  return Number.isFinite(width) && width <= POSTER_COMPACT_MAX_WIDTH;
}

export function getPosterProgress(index, posterCount) {
  const count = normalizePosterCount(posterCount);
  const lastPoster = Math.max(0, count - 1);
  const selected = Math.min(lastPoster, normalizePosterIndex(index));
  if (lastPoster === 0) return POSTER_SEQUENCE_START;
  return POSTER_SEQUENCE_START
    + (selected / lastPoster) * (POSTER_SEQUENCE_END - POSTER_SEQUENCE_START);
}

export function getAuthoredSceneProgress(target, posterCount, posterIndex = 0) {
  if (target === "poster") return getPosterProgress(posterIndex, posterCount);
  return AUTHORED_SCENE_TARGETS[target] ?? AUTHORED_SCENE_TARGETS.hero;
}

export function getReducedMotionProgress(progress, posterCount) {
  const authoredStops = [
    ...Object.values(AUTHORED_SCENE_TARGETS),
    ...Array.from(
      { length: normalizePosterCount(posterCount) },
      (_, index) => getPosterProgress(index, posterCount),
    ),
  ];
  const normalizedProgress = clamp01(progress);
  return authoredStops.reduce((nearest, stop) => (
    Math.abs(stop - normalizedProgress) < Math.abs(nearest - normalizedProgress) ? stop : nearest
  ), AUTHORED_SCENE_TARGETS.hero);
}

export function allowsPointerParallax({ pointerType, finePointer, compact }) {
  return pointerType !== "touch" && finePointer === true && compact !== true;
}

export function getSceneState(progress, posterCount) {
  const normalizedProgress = clamp01(progress);
  const count = normalizePosterCount(posterCount);
  const lastPoster = Math.max(0, count - 1);
  const posterPosition = segmentProgress(
    normalizedProgress,
    POSTER_SEQUENCE_START,
    POSTER_SEQUENCE_END,
  );
  const posterFloat = posterPosition * lastPoster;
  const activePoster = count === 0 ? 0 : Math.min(lastPoster, Math.round(posterFloat));

  return {
    progress: normalizedProgress,
    phase: normalizedProgress < STOPS.ingest
      ? "dormant"
      : normalizedProgress < STOPS.interior
        ? "ingest"
        : normalizedProgress < STOPS.evaluate
          ? "interior"
          : normalizedProgress < STOPS.universe
            ? "evaluate"
            : "universe",
    ingest: segmentProgress(normalizedProgress, STOPS.dormant, STOPS.ingest),
    interior: segmentProgress(normalizedProgress, STOPS.ingest, STOPS.interior),
    evaluate: segmentProgress(normalizedProgress, STOPS.interior, STOPS.evaluate),
    universe: segmentProgress(normalizedProgress, STOPS.evaluate, STOPS.universe),
    acceptedPulse: segmentProgress(normalizedProgress, 0.48, 0.64),
    diagnosticSweep: segmentProgress(normalizedProgress, 0.545, 0.59),
    outputAExit: segmentProgress(normalizedProgress, 0.56, 0.59),
    diagnosticReturn: segmentProgress(normalizedProgress, 0.59, 0.62),
    repairLocked: segmentProgress(normalizedProgress, 0.62, 0.65),
    outputBEnter: segmentProgress(normalizedProgress, 0.64, 0.67),
    posterPosition,
    wide: segmentProgress(normalizedProgress, POSTER_WIDE_START, 1),
    activePoster,
    posterMix: posterFloat - Math.floor(posterFloat),
  };
}

export function getPosterPose(index, activeIndex, compact) {
  const posterIndex = normalizePosterIndex(index);
  const focusedIndex = normalizePosterIndex(activeIndex);
  const offset = posterIndex - focusedIndex;

  if (compact && offset !== 0) {
    return { x: 0, y: 0.28, z: -4, ry: 0, scale: 0.82, opacity: 0 };
  }

  if (offset === 0) {
    return { x: 0, y: 0.28, z: 0.9, ry: 0, scale: 1, opacity: 1 };
  }

  const distance = Math.abs(offset);
  const side = Math.sign(offset);

  return {
    x: side * (3.2 + Math.min(3, distance - 1) * 1.12),
    y: 0.2 - Math.min(0.8, distance * 0.2),
    z: -0.85 - Math.min(6.1, distance * 1.18),
    ry: -side * (0.34 + Math.min(0.28, distance * 0.065)),
    scale: Math.max(0.66, 0.84 - distance * 0.045),
    opacity: Math.max(0.42, 0.86 - distance * 0.08),
  };
}

export function getWidePosterPose(index, posterCount) {
  const count = Math.max(1, normalizePosterCount(posterCount));
  const selected = Math.min(count - 1, normalizePosterIndex(index));
  const center = (count - 1) / 2;
  const offset = selected - center;
  const normalized = center === 0 ? 0 : offset / center;
  return {
    x: offset * 2.45,
    y: 0.8 - Math.abs(normalized) * 2,
    z: -0.35 - Math.abs(normalized) * 2.1,
    ry: -normalized * 0.42,
    scale: 0.78 - Math.abs(normalized) * 0.04,
    opacity: 1,
  };
}
