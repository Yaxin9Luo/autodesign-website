export const INTRO_CHARGE_THRESHOLD = 220;
export const INTRO_ARRIVAL_SECONDS = 1.8;
export const INTRO_CINEMATIC_SECONDS = 3.6;

const CINEMATIC_PHASES = [
  [0.15, "shockwave"],
  [1.1, "expansion"],
  [2.5, "assembly"],
  [INTRO_CINEMATIC_SECONDS, "portal"],
];

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function positiveNumber(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function cinematicPhase(elapsed) {
  for (const [end, phase] of CINEMATIC_PHASES) {
    if (elapsed < end) return phase;
  }
  return "complete";
}

function completeState(state) {
  return {
    ...state,
    phase: "complete",
    charge: INTRO_CHARGE_THRESHOLD,
    elapsed: INTRO_CINEMATIC_SECONDS,
    ignited: true,
    complete: true,
  };
}

export function createIntroState({ reducedMotion = false } = {}) {
  return {
    phase: "arriving",
    charge: 0,
    elapsed: 0,
    ignited: false,
    complete: false,
    reducedMotion: Boolean(reducedMotion),
  };
}

export function addIntroCharge(state, delta) {
  const input = positiveNumber(delta);
  if (state.complete || input === 0) return { ...state };
  if (state.reducedMotion) return completeState(state);
  if (state.phase === "arriving") return { ...state };
  if (state.ignited) return { ...state };

  const charge = clamp(state.charge + input, 0, INTRO_CHARGE_THRESHOLD);
  const ignited = state.ignited || charge >= INTRO_CHARGE_THRESHOLD;
  if (!ignited) return { ...state, phase: charge > 0 ? "charging" : "armed", charge };

  return {
    ...state,
    phase: "shockwave",
    charge,
    elapsed: 0,
    ignited: true,
  };
}

export function advanceIntroState(state, deltaSeconds) {
  const delta = positiveNumber(deltaSeconds);
  if (state.complete) return { ...state };
  if (!state.ignited) {
    const elapsed = clamp(state.elapsed + delta, 0, INTRO_ARRIVAL_SECONDS);
    return {
      ...state,
      phase: elapsed >= INTRO_ARRIVAL_SECONDS ? "armed" : "arriving",
      elapsed,
    };
  }

  const elapsed = clamp(state.elapsed + delta, 0, INTRO_CINEMATIC_SECONDS);
  const phase = cinematicPhase(elapsed);
  return {
    ...state,
    phase,
    elapsed,
    complete: phase === "complete",
  };
}

export function resetIntroState(state) {
  return createIntroState({ reducedMotion: state.reducedMotion });
}

export function getIntroView(state) {
  const cinematicElapsed = state.ignited ? state.elapsed : 0;
  const segment = (start, end) => clamp((cinematicElapsed - start) / (end - start), 0, 1);

  return {
    phase: state.phase,
    arrival: state.ignited ? 1 : clamp(state.elapsed / INTRO_ARRIVAL_SECONDS, 0, 1),
    charge: clamp(state.charge / INTRO_CHARGE_THRESHOLD, 0, 1),
    shockwave: segment(0, 0.15),
    expansion: segment(0.15, 1.1),
    assembly: segment(1.1, 2.5),
    portal: segment(2.5, INTRO_CINEMATIC_SECONDS),
  };
}
