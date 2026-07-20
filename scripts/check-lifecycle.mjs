import assert from "node:assert/strict";
import { bindPageLifecycle } from "../page-lifecycle.js";

class FakePage {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, persisted) {
    for (const listener of this.listeners.get(type) ?? []) listener({ persisted });
  }
}

const page = new FakePage();
const calls = [];
const unbind = bindPageLifecycle({
  page,
  controller: {
    resume: () => calls.push("scene:resume"),
    destroy: () => calls.push("scene:destroy"),
  },
  headerController: {
    refresh: () => calls.push("header:refresh"),
    destroy: () => calls.push("header:destroy"),
  },
  focusController: {
    refresh: () => calls.push("focus:refresh"),
    destroy: () => calls.push("focus:destroy"),
  },
});

page.dispatch("pagehide", true);
assert.deepEqual(calls, []);
page.dispatch("pageshow", true);
assert.deepEqual(calls, ["scene:resume", "header:refresh", "focus:refresh"]);
page.dispatch("pageshow", false);
assert.deepEqual(calls, ["scene:resume", "header:refresh", "focus:refresh"]);
page.dispatch("pagehide", false);
assert.deepEqual(calls, [
  "scene:resume",
  "header:refresh",
  "focus:refresh",
  "scene:destroy",
  "header:destroy",
  "focus:destroy",
]);
page.dispatch("pageshow", true);
assert.deepEqual(calls, [
  "scene:resume",
  "header:refresh",
  "focus:refresh",
  "scene:destroy",
  "header:destroy",
  "focus:destroy",
]);

unbind();
assert.equal(page.listeners.get("pagehide")?.size ?? 0, 0);
assert.equal(page.listeners.get("pageshow")?.size ?? 0, 0);

console.log("research-site lifecycle: OK");
