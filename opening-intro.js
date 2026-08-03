import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createIntroAudio } from "./intro-audio.js?v=20260803a";
import { createIntroScene } from "./intro-scene.js?v=20260803b";
import { t } from "./i18n.js?v=20260803b";
import {
  INTRO_ARRIVAL_SECONDS,
  INTRO_CHARGE_THRESHOLD,
  addIntroCharge,
  advanceIntroState,
  createIntroState,
  getIntroView,
  resetIntroState,
} from "./intro-state.js?v=20260803a";

const INTRO_ASSETS = Object.freeze({
  poster: "./assets/studies/autodesign-poster.webp?v=20260729a",
  slides: "./assets/studies/autodesign-formal-slide-01.webp?v=20260730b",
  web: "./assets/studies/webpage.webp",
  video: "./assets/studies/autodesign-conference-poster.webp?v=20260731c",
});

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

function setDocumentIntroState(active, story) {
  document.documentElement.classList.toggle("intro-active", active);
  document.documentElement.classList.toggle("intro-complete", !active);
  story.toggleAttribute("inert", active);
  story.setAttribute("aria-hidden", active ? "true" : "false");
  document.querySelectorAll("main > :not(#scene-shell), #site-footer").forEach((element) => {
    element.toggleAttribute("inert", active);
  });
}

function loadTexture(loader, renderer, textures, source) {
  let texture;
  texture = loader.load(source, undefined, undefined, () => textures.delete(texture));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  textures.add(texture);
  return texture;
}

function canUseWebGL(canvas) {
  try {
    return Boolean(canvas.getContext("webgl2", { antialias: true, powerPreference: "high-performance" }));
  } catch {
    return false;
  }
}

export function createOpeningIntro() {
  const shell = document.getElementById("scene-shell");
  const overlay = document.getElementById("intro-overlay");
  const canvas = document.getElementById("intro-canvas");
  const story = shell?.querySelector(".scene-story");
  if (!shell || !overlay || !canvas || !story) return { destroy() {}, resume() {} };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 760px)");
  const charge = document.getElementById("intro-charge");
  const prompt = document.getElementById("intro-prompt");
  const announcement = document.getElementById("intro-announcement");
  const soundButton = document.getElementById("intro-sound");
  const replayButton = document.getElementById("intro-replay");
  const enterButton = document.getElementById("intro-enter");

  if (reducedMotion.matches || !canUseWebGL(canvas)) {
    overlay.hidden = true;
    setDocumentIntroState(false, story);
    return { destroy() {}, resume() {} };
  }

  let renderer;
  let composer;
  let bloom;
  let introScene;
  let raf = 0;
  let exitTimer = 0;
  let lastFrame = 0;
  let touchY = null;
  let active = false;
  let exiting = false;
  let destroyed = false;
  let announcedPhase = null;
  let state = createIntroState();
  const textures = new Set();
  const audio = createIntroAudio();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090c);
  scene.fog = new THREE.Fog(0x07090c, 18, 34);
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 70);
  camera.position.set(0, 0, 14.2);
  camera.lookAt(0, 0, 0);

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x07090c, 1);

    composer = new EffectComposer(renderer);
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.28, 0.76);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const loader = new THREE.TextureLoader();
    introScene = createIntroScene({
      THREE,
      scene,
      registerTexture: (texture) => {
        textures.add(texture);
        return texture;
      },
      textures: Object.fromEntries(Object.entries(INTRO_ASSETS).map(([key, source]) => (
        [key, loadTexture(loader, renderer, textures, source)]
      ))),
      compact: compact.matches,
      saveData: navigator.connection?.saveData === true,
    });
  } catch {
    renderer?.dispose();
    overlay.hidden = true;
    setDocumentIntroState(false, story);
    return { destroy() {}, resume() {} };
  }

  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, compact.matches ? 1.35 : 1.8);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
  }

  function synchronize(view = getIntroView(state)) {
    shell.dataset.introPhase = state.phase;
    shell.style.setProperty("--intro-charge", view.charge.toFixed(4));
    const chargeValue = Math.round(view.charge * INTRO_CHARGE_THRESHOLD);
    charge?.setAttribute("aria-valuenow", String(chargeValue));
    if (prompt) {
      prompt.dataset.chargeLabel = `${chargeValue} / ${INTRO_CHARGE_THRESHOLD}`;
      prompt.textContent = state.phase === "arriving"
        ? t("intro.collecting")
        : state.phase === "armed"
          ? t("intro.scroll")
          : state.phase === "charging"
            ? t("intro.continue")
            : t("intro.transforming");
    }
    if (announcement && announcedPhase !== state.phase) {
      const messages = {
        arriving: "intro.announceArriving",
        armed: "intro.announceArmed",
        charging: "intro.announceCharging",
        shockwave: "intro.announceShockwave",
        expansion: "intro.announceExpansion",
        assembly: "intro.announceAssembly",
        portal: "intro.announcePortal",
        complete: "intro.announceComplete",
      };
      announcement.textContent = t(messages[state.phase] ?? "intro.label");
      announcedPhase = state.phase;
    }
    if (bloom) {
      bloom.strength = state.phase === "shockwave"
        ? 1.18
        : state.phase === "expansion"
          ? 0.66
          : state.phase === "assembly"
            ? 0.12
            : 0.32 + view.charge * 0.42;
    }
  }

  function draw(now) {
    const view = getIntroView(state);
    introScene.update(view, {
      time: now,
      width: window.innerWidth,
      height: window.innerHeight,
      reducedMotion: reducedMotion.matches,
    });
    composer.render();
  }

  function endIntro() {
    if (destroyed) return;
    active = false;
    exiting = false;
    window.clearTimeout(exitTimer);
    exitTimer = 0;
    cancelAnimationFrame(raf);
    raf = 0;
    introScene.setVisible(false);
    overlay.classList.remove("is-exiting");
    shell.dataset.introPhase = "complete";
    setDocumentIntroState(false, story);
    replayButton.hidden = false;
    enterButton.hidden = true;
  }

  function resolveIntro() {
    if (!active || exiting) return;
    exiting = true;
    overlay.classList.add("is-exiting");
    audio.resolve();
    exitTimer = window.setTimeout(endIntro, 480);
  }

  function frame(now) {
    if (!active || destroyed) return;
    const elapsed = Math.min(0.08, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (state.phase === "arriving" || state.ignited) state = advanceIntroState(state, elapsed);
    synchronize();
    draw(now);
    if (state.complete) {
      resolveIntro();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function beginIntro() {
    window.clearTimeout(exitTimer);
    exitTimer = 0;
    cancelAnimationFrame(raf);
    state = resetIntroState(state);
    announcedPhase = null;
    active = true;
    exiting = false;
    lastFrame = performance.now();
    overlay.hidden = false;
    overlay.classList.remove("is-exiting");
    replayButton.hidden = true;
    enterButton.hidden = true;
    introScene.setVisible(true);
    setDocumentIntroState(true, story);
    window.scrollTo({ top: 0, behavior: "instant" });
    synchronize();
    resize();
    draw(lastFrame);
    raf = requestAnimationFrame(frame);
  }

  function addCharge(amount) {
    if (!active || state.complete || exiting) return;
    const previous = state;
    state = addIntroCharge(state, amount);
    const view = getIntroView(state);
    if (state.charge !== previous.charge) audio.charge(view.charge);
    if (!previous.ignited && state.ignited) audio.ignite();
    synchronize(view);
  }

  function onWheel(event) {
    if (!active) return;
    event.preventDefault();
    addCharge(Math.min(72, 12 + Math.abs(event.deltaY) * 0.16));
  }

  function onTouchStart(event) {
    touchY = event.touches[0]?.clientY ?? null;
  }

  function onTouchMove(event) {
    if (!active) return;
    const nextY = event.touches[0]?.clientY;
    if (nextY === undefined || touchY === null) return;
    event.preventDefault();
    addCharge(Math.min(58, Math.abs(touchY - nextY) * 0.55));
    touchY = nextY;
  }

  function onKeyDown(event) {
    if (!active) return;
    if ([" ", "Enter", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      addCharge(56);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      state = advanceIntroState(addIntroCharge(advanceIntroState(state, INTRO_ARRIVAL_SECONDS), INTRO_CHARGE_THRESHOLD), 4);
      synchronize();
      resolveIntro();
    }
  }

  function onPointerMove(event) {
    if (!active) return;
    introScene.setPointer(
      clamp((event.clientX / Math.max(1, window.innerWidth)) * 2 - 1, -1, 1),
      clamp(-((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1), -1, 1),
    );
  }

  function setSound() {
    const next = !audio.getEnabled();
    audio.setEnabled(next);
    soundButton.setAttribute("aria-pressed", String(next));
    soundButton.textContent = t(next ? "intro.soundOn" : "intro.soundOff");
  }

  function onLocaleChange() {
    soundButton.textContent = t(audio.getEnabled() ? "intro.soundOn" : "intro.soundOff");
    announcedPhase = null;
    synchronize();
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("autodesign:localechange", onLocaleChange);
  soundButton.addEventListener("click", setSound);
  replayButton.addEventListener("click", beginIntro);
  enterButton.addEventListener("click", resolveIntro);
  resize();
  beginIntro();

  return {
    resume() {
      if (active && !raf) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    destroy() {
      destroyed = true;
      window.clearTimeout(exitTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("autodesign:localechange", onLocaleChange);
      soundButton.removeEventListener("click", setSound);
      replayButton.removeEventListener("click", beginIntro);
      enterButton.removeEventListener("click", resolveIntro);
      setDocumentIntroState(false, story);
      introScene.dispose();
      textures.forEach((texture) => texture.dispose());
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      void audio.destroy();
    },
  };
}
