import assert from "node:assert/strict";
import { bindSceneFocus } from "../scene-focus.js";

class FakePage {
  innerWidth = 390;
  innerHeight = 800;
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

class FakeElement {
  attributes = new Set();
  dataset = {};
  bounds = { top: 100, bottom: 700 };
  offsetHeight = 80;

  getBoundingClientRect() {
    return this.bounds;
  }

  toggleAttribute(name, force) {
    if (force) this.attributes.add(name);
    else this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }
}

class FakeObserver {
  static instance;

  constructor(callback) {
    this.callback = callback;
    FakeObserver.instance = this;
  }

  observe(element, options) {
    this.element = element;
    this.options = options;
  }

  disconnect() {
    this.disconnected = true;
  }

  dispatch() {
    this.callback();
  }
}

const page = new FakePage();
const shell = new FakeElement();
const header = new FakeElement();
const hero = new FakeElement();
const posterSection = new FakeElement();
const posterControls = new FakeElement();
shell.dataset.phase = "dormant";
shell.dataset.universeView = "engine";
shell.dataset.introPhase = "complete";

const controller = bindSceneFocus({
  page,
  shell,
  header,
  hero,
  posterSection,
  posterControls,
  Observer: FakeObserver,
});

assert.equal(hero.hasAttribute("inert"), false);
assert.equal(posterSection.hasAttribute("inert"), true);
assert.deepEqual(
  FakeObserver.instance.options.attributeFilter,
  ["data-phase", "data-universe-view", "data-intro-phase"],
);

shell.dataset.introPhase = "armed";
FakeObserver.instance.dispatch();
assert.equal(hero.hasAttribute("inert"), true);
assert.equal(posterSection.hasAttribute("inert"), true);

shell.dataset.introPhase = "complete";
FakeObserver.instance.dispatch();
assert.equal(hero.hasAttribute("inert"), false);
assert.equal(posterSection.hasAttribute("inert"), true);

shell.dataset.phase = "evaluate";
FakeObserver.instance.dispatch();
assert.equal(hero.hasAttribute("inert"), true);
assert.equal(posterSection.hasAttribute("inert"), true);

shell.dataset.phase = "universe";
shell.dataset.universeView = "focused";
FakeObserver.instance.dispatch();
assert.equal(hero.hasAttribute("inert"), true);
assert.equal(posterSection.hasAttribute("inert"), false);

posterControls.bounds = { top: -240, bottom: 70 };
page.dispatch("scroll");
assert.equal(hero.hasAttribute("inert"), true);
assert.equal(posterSection.hasAttribute("inert"), true);

posterControls.bounds = { top: 440, bottom: 760 };
page.dispatch("resize");
assert.equal(posterSection.hasAttribute("inert"), false);

page.innerWidth = 1440;
shell.dataset.universeView = "wide";
FakeObserver.instance.dispatch();
assert.equal(posterSection.hasAttribute("inert"), true);

page.innerWidth = 900;
page.dispatch("resize");
assert.equal(posterSection.hasAttribute("inert"), false);

controller.destroy();
assert.equal(FakeObserver.instance.disconnected, true);
assert.equal(page.listeners.get("scroll")?.size ?? 0, 0);
assert.equal(page.listeners.get("resize")?.size ?? 0, 0);

console.log("research-site scene focus: OK");
