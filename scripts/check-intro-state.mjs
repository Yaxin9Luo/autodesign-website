import assert from "node:assert/strict";
import {
  INTRO_ARRIVAL_SECONDS,
  INTRO_CHARGE_THRESHOLD,
  INTRO_CINEMATIC_SECONDS,
  addIntroCharge,
  advanceIntroState,
  createIntroState,
  getIntroView,
  resetIntroState,
} from "../intro-state.js";
import { createIntroAudio } from "../intro-audio.js";

let state = createIntroState({ reducedMotion: false });
assert.deepEqual(state, {
  phase: "arriving",
  charge: 0,
  elapsed: 0,
  ignited: false,
  complete: false,
  reducedMotion: false,
});

const arrivingInput = state;
const earlyCharge = addIntroCharge(arrivingInput, INTRO_CHARGE_THRESHOLD);
assert.equal(earlyCharge.charge, 0);
assert.equal(earlyCharge.ignited, false);
assert.deepEqual(arrivingInput, state);

state = advanceIntroState(state, INTRO_ARRIVAL_SECONDS);
assert.equal(state.phase, "armed");
assert.equal(state.elapsed, INTRO_ARRIVAL_SECONDS);

state = addIntroCharge(state, -80);
assert.equal(state.charge, 0);
state = addIntroCharge(state, INTRO_CHARGE_THRESHOLD - 1);
assert.equal(state.charge, INTRO_CHARGE_THRESHOLD - 1);
assert.equal(state.ignited, false);
assert.equal(state.phase, "charging");
state = addIntroCharge(state, 100);
assert.equal(state.charge, INTRO_CHARGE_THRESHOLD);
assert.equal(state.ignited, true);
assert.equal(state.phase, "shockwave");
assert.equal(state.elapsed, 0);

const cinematicInput = advanceIntroState(state, 1.2);
const ignoredCinematicCharge = addIntroCharge(cinematicInput, 90);
assert.equal(ignoredCinematicCharge.phase, cinematicInput.phase);
assert.equal(ignoredCinematicCharge.elapsed, cinematicInput.elapsed);
assert.notEqual(ignoredCinematicCharge, cinematicInput);
assert.deepEqual(cinematicInput, advanceIntroState(state, 1.2));

for (const [seconds, phase] of [
  [0.15, "expansion"],
  [1.1, "assembly"],
  [2.5, "portal"],
  [INTRO_CINEMATIC_SECONDS, "complete"],
]) {
  state = {
    ...state,
    elapsed: seconds,
    phase: "shockwave",
    complete: false,
  };
  state = advanceIntroState(state, 0);
  assert.equal(state.phase, phase);
}
assert.equal(state.complete, true);

const view = getIntroView(
  advanceIntroState(
    addIntroCharge(advanceIntroState(createIntroState({ reducedMotion: false }), 1.8), 220),
    1.1,
  ),
);
assert.equal(view.phase, "assembly");
assert.equal(view.arrival, 1);
assert.equal(view.charge, 1);
assert.equal(view.shockwave, 1);
assert.equal(view.expansion, 1);
assert.equal(view.assembly, 0);
assert.equal(view.portal, 0);

assert.deepEqual(resetIntroState(state), createIntroState({ reducedMotion: false }));

const reducedWaiting = advanceIntroState(createIntroState({ reducedMotion: true }), 10);
assert.equal(reducedWaiting.phase, "armed");
assert.equal(reducedWaiting.complete, false);
const reducedMotion = addIntroCharge(reducedWaiting, 1);
assert.equal(reducedMotion.phase, "complete");
assert.equal(reducedMotion.complete, true);
const directReducedMotion = addIntroCharge(createIntroState({ reducedMotion: true }), 1);
assert.equal(directReducedMotion.phase, "complete");
assert.equal(directReducedMotion.complete, true);

class FakeAudioParam {
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

const audioNodes = [];
class FakeAudioNode {
  constructor() {
    this.frequency = new FakeAudioParam();
    this.gain = new FakeAudioParam();
    audioNodes.push(this);
  }
  connect() {}
  disconnect() { this.disconnected = true; }
}

class FakeAudioSource extends FakeAudioNode {
  start() {}
  stop() { this.stopped = true; this.onended?.(); }
}

let audioContextsCreated = 0;
let createdAudioContext = null;
class FakeAudioContext {
  constructor() {
    audioContextsCreated += 1;
    createdAudioContext = this;
    this.currentTime = 0;
    this.destination = {};
    this.sampleRate = 8;
    this.state = "running";
  }
  createOscillator() { return new FakeAudioSource(); }
  createGain() { return new FakeAudioNode(); }
  createBuffer() { return { getChannelData: () => new Float32Array(2) }; }
  createBufferSource() { return new FakeAudioSource(); }
  resume() { this.state = "running"; return Promise.resolve(); }
  suspend() { this.state = "suspended"; return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
}

const originalAudioContext = globalThis.AudioContext;
globalThis.AudioContext = FakeAudioContext;
const audio = createIntroAudio();
assert.equal(audioContextsCreated, 0);
audio.setEnabled(false);
assert.equal(audioContextsCreated, 0);
audio.setEnabled(true);
assert.equal(audioContextsCreated, 1);
assert.equal(audio.getEnabled(), true);
audio.charge(0.5);
audio.ignite();
audio.resolve();
audio.setEnabled(false);
assert.equal(audio.getEnabled(), false);
await audio.destroy();
assert.equal(createdAudioContext.closed, true);
assert.ok(audioNodes.length > 0);
assert.ok(audioNodes.every((node) => node.disconnected === true));
assert.ok(audioNodes.filter((node) => node instanceof FakeAudioSource).every((node) => node.stopped === true));

audioNodes.length = 0;
const directlyDestroyedAudio = createIntroAudio();
directlyDestroyedAudio.setEnabled(true);
directlyDestroyedAudio.charge(0.75);
const directlyDestroyedContext = createdAudioContext;
await directlyDestroyedAudio.destroy();
assert.equal(directlyDestroyedContext.closed, true);
assert.ok(audioNodes.length > 0);
assert.ok(audioNodes.every((node) => node.disconnected === true));
assert.ok(audioNodes.filter((node) => node instanceof FakeAudioSource).every((node) => node.stopped === true));
globalThis.AudioContext = originalAudioContext;

console.log("research-site intro state: OK");
