import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createIntroAudio } from "./intro-audio.js";
import { createIntroScene } from "./intro-scene.js";
import { t } from "./i18n.js?v=20260722b";
import {
  INTRO_CHARGE_THRESHOLD,
  addIntroCharge,
  advanceIntroState,
  createIntroState,
  getIntroView,
  resetIntroState,
} from "./intro-state.js";
import {
  allowsPointerParallax,
  getAuthoredSceneProgress,
  getPosterPose,
  getReducedMotionProgress,
  getSceneState,
  getWidePosterPose,
  POSTER_COMPACT_MAX_WIDTH,
} from "./scene-state.js";

const COLORS = Object.freeze({
  graphite: 0x07090c,
  frame: 0x252a31,
  edge: 0x69736f,
  paper: 0xefece3,
  ink: 0x13191c,
  teal: 0x63d6b3,
  yellow: 0xf2c14e,
  vermilion: 0xe86a52,
  blue: 0x4777ff,
});
const POSTER_ASPECT = 2048 / 1025;
const POSTER_TEXTURE_LOAD_PROGRESS = 0.64;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (from, to, amount) => from + (to - from) * amount;
const smooth = (value) => {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

function scrollToSceneProgress(shell, progress) {
  const top = shell.getBoundingClientRect().top + window.scrollY;
  const distance = Math.max(1, shell.offsetHeight - window.innerHeight);
  window.scrollTo({ top: top + distance * progress, behavior: "instant" });
  return progress;
}

function makeCanvasTexture(width, height, draw) {
  const surface = document.createElement("canvas");
  surface.width = width;
  surface.height = height;
  const context = surface.getContext("2d", { alpha: true });
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawDocumentLines(context, x, y, width, count, gap) {
  context.fillStyle = "#aeb6b1";
  for (let index = 0; index < count; index += 1) {
    const lineWidth = width * (index % 3 === 2 ? 0.68 : index % 2 === 0 ? 1 : 0.84);
    context.fillRect(x, y + index * gap, lineWidth, 4);
  }
}

function makeSourceTexture(kind, accent) {
  return makeCanvasTexture(640, 400, (context, width, height) => {
    context.fillStyle = "#eef0ea";
    context.fillRect(0, 0, width, height);
    context.fillStyle = accent;
    context.fillRect(0, 0, 11, height);
    context.fillRect(0, 0, width, 8);

    context.fillStyle = "#172023";
    context.font = "700 28px Arial, sans-serif";
    context.fillText(kind.toUpperCase(), 42, 58);
    context.fillStyle = "#5f6b67";
    context.font = "600 15px monospace";
    context.fillText("SOURCE RECORD / AUTODESIGN", 43, 88);

    if (kind === "paper") {
      context.fillStyle = "#1d272a";
      context.font = "700 20px Georgia, serif";
      context.fillText("Method and evaluation protocol", 43, 138);
      drawDocumentLines(context, 43, 169, 528, 7, 25);
    } else if (kind === "figure") {
      context.strokeStyle = "#1e8f83";
      context.lineWidth = 5;
      context.strokeRect(48, 133, 218, 176);
      context.strokeStyle = "#7c8984";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(72, 275);
      context.lineTo(116, 216);
      context.lineTo(158, 243);
      context.lineTo(238, 158);
      context.stroke();
      drawDocumentLines(context, 304, 142, 260, 6, 26);
    } else if (kind === "table") {
      context.strokeStyle = "#79847f";
      context.lineWidth = 2;
      for (let row = 0; row < 6; row += 1) {
        context.beginPath();
        context.moveTo(44, 137 + row * 39);
        context.lineTo(580, 137 + row * 39);
        context.stroke();
      }
      for (let column = 0; column < 4; column += 1) {
        context.beginPath();
        context.moveTo(44 + column * 178, 137);
        context.lineTo(44 + column * 178, 332);
        context.stroke();
      }
      context.fillStyle = "#183f3a";
      context.fillRect(44, 137, 536, 38);
    } else {
      context.fillStyle = "#172023";
      context.font = "italic 34px Georgia, serif";
      context.fillText("A(x) = softmax(QKᵀ / √d) V", 46, 184);
      context.font = "italic 29px Georgia, serif";
      context.fillText("H* = arg max  E[R(a, s)]", 46, 246);
      drawDocumentLines(context, 48, 291, 466, 2, 25);
    }

    context.fillStyle = "#65716d";
    context.font = "600 14px monospace";
    context.fillText("INSPECTABLE INPUT", 43, height - 28);
  });
}

function makeModuleTexture(index, name) {
  return makeCanvasTexture(640, 180, (context, width, height) => {
    context.fillStyle = "#e9ebe5";
    context.fillRect(0, 0, width, height);
    context.fillStyle = index === 4 ? "#20c9b1" : "#263134";
    context.fillRect(0, 0, 13, height);
    context.fillStyle = "#172023";
    context.font = "700 22px monospace";
    context.fillText(String(index + 1).padStart(2, "0"), 42, 54);
    context.font = "700 37px Arial, sans-serif";
    context.fillText(name.toUpperCase(), 42, 108);
    context.fillStyle = "#68736f";
    context.font = "600 14px monospace";
    context.fillText("HARNESS MODULE", 430, 54);
    context.fillRect(430, 82, 140, 5);
    context.fillRect(430, 101, 92, 5);
  });
}

function makeFallbackPosterTexture(title) {
  return makeCanvasTexture(1024, 512, (context, width, height) => {
    context.fillStyle = "#f4f5f1";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#08679b";
    context.fillRect(24, 20, width - 48, 12);
    context.fillRect(24, 122, width * 0.3, 36);
    context.fillRect(width * 0.35, 122, width * 0.3, 36);
    context.fillRect(width * 0.67, 122, width * 0.3, 36);
    context.fillStyle = "#1a2023";
    context.font = "700 42px Georgia, serif";
    context.textAlign = "center";
    context.fillText(title, width / 2, 88);
    context.textAlign = "left";
    drawDocumentLines(context, 25, 182, width * 0.28, 9, 27);
    drawDocumentLines(context, width * 0.35, 182, width * 0.28, 9, 27);
    drawDocumentLines(context, width * 0.67, 182, width * 0.28, 9, 27);
  });
}

function loadFallbackImage(shell) {
  const fallback = shell.querySelector(".scene-fallback");
  if (!fallback || fallback.hasAttribute("src") || !fallback.dataset.src) return;
  fallback.src = fallback.dataset.src;
}

function setIntroDocumentState(active) {
  document.documentElement.classList.toggle("intro-active", active);
  document.documentElement.classList.toggle("intro-complete", !active);
  document.querySelectorAll("main > section, #site-footer").forEach((element) => {
    element.toggleAttribute("inert", active);
  });
}

function resetIntroScroll(shell) {
  scrollToSceneProgress(shell, 0);
  requestAnimationFrame(() => scrollToSceneProgress(shell, 0));
}

function createFallbackController(canvas, shell, posters, onPosterChange) {
  loadFallbackImage(shell);
  canvas.dataset.scene = "fallback";
  shell.dataset.phase = "dormant";
  shell.dataset.introPhase = "armed";
  shell.classList.add("webgl-fallback");
  setIntroDocumentState(true);
  resetIntroScroll(shell);
  const enter = document.getElementById("intro-enter");
  const replay = document.getElementById("intro-replay");
  if (enter) enter.hidden = false;
  let selectedPoster = 0;
  const updateFallbackScroll = () => {
    const top = shell.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(1, shell.offsetHeight - window.innerHeight);
    const progress = clamp((window.scrollY - top) / distance, 0, 1);
    const state = getSceneState(progress, posters.length);
    shell.dataset.phase = state.phase;
    shell.dataset.universeView = state.phase === "universe" && state.wide > 0 ? "wide" : "focused";
    if (state.phase === "universe" && state.activePoster !== selectedPoster) {
      selectedPoster = state.activePoster;
      onPosterChange?.(selectedPoster);
    }
  };
  const completeIntro = () => {
    shell.dataset.introPhase = "complete";
    resetIntroScroll(shell);
    setIntroDocumentState(false);
    if (enter) enter.hidden = true;
    if (replay) replay.hidden = false;
  };
  const goToState = (target, index = 0) => {
    const selected = clamp(Math.round(index), 0, Math.max(0, posters.length - 1));
    const progress = getAuthoredSceneProgress(target, posters.length, selected);
    if ((target === "poster" || target === "artifacts") && selected !== selectedPoster) {
      selectedPoster = selected;
      onPosterChange?.(selected);
    }
    shell.dataset.phase = getSceneState(progress, posters.length).phase;
    scrollToSceneProgress(shell, progress);
  };
  const controller = {
    goToState,
    setPoster(index) {
      goToState("poster", index);
    },
    resize() {},
    renderStatic() {},
    resume() { updateFallbackScroll(); },
    completeIntro,
    replayIntro() {
      shell.dataset.introPhase = "armed";
      setIntroDocumentState(true);
      if (enter) enter.hidden = false;
      if (replay) replay.hidden = true;
      resetIntroScroll(shell);
    },
    setIntroSound() {},
    getIntroSound() { return false; },
    destroy() {
      window.removeEventListener("scroll", updateFallbackScroll);
      setIntroDocumentState(false);
    },
  };
  window.addEventListener("scroll", updateFallbackScroll, { passive: true });
  updateFallbackScroll();
  return controller;
}

export function createArtifactScene(options) {
  const rollback = [];
  const registerRollback = (cleanup) => rollback.push(cleanup);
  try {
    const controller = createArtifactSceneRuntime(options, registerRollback);
    rollback.length = 0;
    return controller;
  } catch (error) {
    for (const cleanup of rollback.reverse()) {
      try {
        cleanup();
      } catch {}
    }
    console.error("AutoDesign scene initialization failed; using fallback.", error);
    setIntroDocumentState(false);
    return createFallbackController(
      options.canvas,
      options.shell,
      options.posters,
      options.onPosterChange,
    );
  }
}

function createArtifactSceneRuntime({
  canvas,
  shell,
  posters,
  onPosterChange,
  onPosterActivate,
}, registerRollback = () => {}) {
  const saveData = navigator.connection?.saveData === true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia(`(max-width: ${POSTER_COMPACT_MAX_WIDTH}px)`);
  const finePointer = window.matchMedia("(pointer: fine)");
  let webglContext;
  let renderer;
  try {
    webglContext = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
    });
    if (!webglContext) return createFallbackController(canvas, shell, posters, onPosterChange);
    renderer = new THREE.WebGLRenderer({
      canvas,
      context: webglContext,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (error) {
    try {
      webglContext?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {}
    return createFallbackController(canvas, shell, posters, onPosterChange);
  }
  registerRollback(() => {
    renderer.dispose();
    renderer.forceContextLoss?.();
  });

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(COLORS.graphite, 1);
  renderer.shadowMap.enabled = !saveData && window.innerWidth > 760;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.graphite);
  scene.fog = new THREE.Fog(COLORS.graphite, 14, 32);
  registerRollback(() => {
    const geometries = new Set();
    const materials = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    scene.clear();
  });

  const introAudio = createIntroAudio();
  registerRollback(() => { void introAudio.destroy(); });
  let destroyed = false;
  registerRollback(() => { destroyed = true; });
  let introState = createIntroState({ reducedMotion: reducedMotion.matches });
  if (reducedMotion.matches) introState = advanceIntroState(introState, 1.8);
  let introCompletionHandled = false;
  let touchY = null;
  const introCharge = document.getElementById("intro-charge");
  const introPrompt = document.getElementById("intro-prompt");
  const introAnnouncement = document.getElementById("intro-announcement");
  const introReplay = document.getElementById("intro-replay");
  const introEnter = document.getElementById("intro-enter");
  setIntroDocumentState(true);
  registerRollback(() => setIntroDocumentState(false));
  resetIntroScroll(shell);

  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 70);
  camera.position.set(-1.45, 0.4, 14.8);
  const cameraPosition = new THREE.Vector3();
  const cameraLookTarget = new THREE.Vector3();
  const cameraPath = Object.freeze({
    source: new THREE.Vector3(-1.55, 0.65, 14.9),
    ingest: new THREE.Vector3(-0.2, 0.5, 12.9),
    interior: new THREE.Vector3(2.25, 0.2, 10.9),
    evaluate: new THREE.Vector3(4.35, -0.38, 11.8),
    future: new THREE.Vector3(2.9, -0.05, 10.9),
    universe: new THREE.Vector3(0.15, 0.15, 12.9),
    wide: new THREE.Vector3(0, 0.3, 19.2),
  });
  const cameraTargets = Object.freeze({
    source: new THREE.Vector3(0.35, -0.05, 0.1),
    ingest: new THREE.Vector3(0.8, 0.15, 0.3),
    interior: new THREE.Vector3(1.6, -0.05, 0.65),
    evaluate: new THREE.Vector3(3.8, -0.2, 0.45),
    future: new THREE.Vector3(2.4, -0.1, 0.5),
    universe: new THREE.Vector3(0, 0.1, -0.4),
    wide: new THREE.Vector3(0, 0.05, -1.25),
  });

  const ambient = new THREE.HemisphereLight(0xddeae4, 0x07090c, 0.62);
  const key = new THREE.DirectionalLight(0xfff0d1, 3.4);
  key.position.set(-5.5, 7.5, 8.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  const sideLight = new THREE.DirectionalLight(0x6e86ff, 1.85);
  sideLight.position.set(8, 1.5, -4);
  const rimLight = new THREE.PointLight(COLORS.teal, 13, 16, 1.65);
  rimLight.position.set(2.4, -2.35, 4.4);
  const outputLight = new THREE.SpotLight(0xffdba8, 10, 18, 0.48, 0.7, 1.5);
  outputLight.position.set(7, 4.2, 7);
  outputLight.target.position.set(3.7, 0, 0);
  scene.add(ambient, key, sideLight, rimLight, outputLight, outputLight.target);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.frame,
    metalness: 0.82,
    roughness: 0.28,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.edge,
    metalness: 0.72,
    roughness: 0.34,
  });
  const porcelainMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.paper,
    metalness: 0.04,
    roughness: 0.46,
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: COLORS.teal,
    transparent: true,
    opacity: 0.14,
    metalness: 0.08,
    roughness: 0.16,
    transmission: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const textures = new Set();
  const disposedTextures = new WeakSet();
  const registerTexture = (texture) => {
    if (!disposedTextures.has(texture)) textures.add(texture);
    return texture;
  };
  const disposeTexture = (texture) => {
    if (!texture || disposedTextures.has(texture)) return;
    textures.delete(texture);
    disposedTextures.add(texture);
    texture.dispose();
  };
  registerRollback(() => [...textures].forEach(disposeTexture));

  const box = (width, height, depth, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.castShadow = material.transparent !== true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const engineRoot = new THREE.Group();
  engineRoot.name = "Artifact Engine";
  scene.add(engineRoot);

  const machine = new THREE.Group();
  machine.rotation.z = -0.055;
  engineRoot.add(machine);

  const backing = box(3.18, 4.5, 0.38, frameMaterial);
  backing.position.set(0.12, 0, -0.76);
  machine.add(backing);

  const frameParts = [
    [-1.62, 0.08, -0.38, 0.18, 4.92, 0.42],
    [1.78, -0.22, -0.3, 0.2, 4.28, 0.4],
    [0.08, 2.39, -0.36, 4.58, 0.17, 0.38],
    [0.65, -2.29, -0.32, 3.38, 0.18, 0.4],
    [-2.94, 0.9, -0.22, 2.82, 0.13, 0.28],
    [3.04, -0.92, -0.15, 2.86, 0.14, 0.3],
  ];
  frameParts.forEach(([x, y, z, width, height, depth], index) => {
    const rail = box(width, height, depth, index > 3 ? edgeMaterial : frameMaterial);
    rail.position.set(x, y, z);
    machine.add(rail);
  });

  for (let index = 0; index < 2; index += 1) {
    const layer = box(3.45, 4.62, 0.035, glassMaterial.clone());
    layer.position.set(-0.04 + index * 0.18, 0.03 - index * 0.1, -0.48 + index * 0.16);
    layer.rotation.z = -0.02 + index * 0.035;
    machine.add(layer);
  }

  const moduleNames = ["Context", "Designer", "Render", "Evaluate", "Repair"];
  const moduleBases = [
    [-0.54, 1.52, 0.12, -0.055],
    [0.32, 0.77, 0.39, 0.025],
    [-0.18, 0.02, 0.66, -0.02],
    [0.47, -0.75, 0.93, 0.045],
    [-0.2, -1.53, 1.2, -0.035],
  ];
  const translucentModuleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9fb6b0,
    transparent: true,
    opacity: 0.72,
    metalness: 0.08,
    roughness: 0.2,
    transmission: 0.08,
  });
  const evaluateModuleMaterial = new THREE.MeshStandardMaterial({
    color: 0x353b42,
    metalness: 0.72,
    roughness: 0.3,
  });
  const moduleBodyMaterials = [
    porcelainMaterial,
    translucentModuleMaterial,
    porcelainMaterial,
    evaluateModuleMaterial,
    porcelainMaterial,
  ];
  const moduleGroups = moduleNames.map((name, index) => {
    const module = new THREE.Group();
    module.name = name;
    const [x, y, z, rotation] = moduleBases[index];
    module.position.set(x, y, z);
    module.rotation.z = rotation;
    module.userData.base = new THREE.Vector3(x, y, z);

    const shell = box(2.18, 0.7, 0.48, index === 3 ? edgeMaterial : frameMaterial);
    shell.position.z = -0.04;
    const plateMaterial = moduleBodyMaterials[index].clone();
    const plate = box(1.96, 0.56, 0.42, plateMaterial);
    plate.position.z = 0.09;
    module.add(shell, plate);

    const labelTexture = registerTexture(makeModuleTexture(index, name));
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.84, 0.5),
      new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true }),
    );
    label.position.z = 0.31;
    module.add(label);
    module.userData.plate = plate;
    machine.add(module);
    return module;
  });
  const repairPlate = moduleGroups[4].userData.plate;
  const repairBaseColor = new THREE.Color(COLORS.paper);
  const repairAcceptedColor = new THREE.Color(COLORS.teal);

  const acceptedMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.teal,
    emissive: COLORS.teal,
    emissiveIntensity: 1.8,
    metalness: 0.34,
    roughness: 0.24,
    transparent: true,
    opacity: 0,
  });
  const acceptedInsert = box(1.64, 0.07, 0.5, acceptedMaterial);
  acceptedInsert.position.set(0, -0.38, 0.02);
  moduleGroups[4].add(acceptedInsert);

  const repairLock = new THREE.Group();
  repairLock.name = "Repair accepted-state lock";
  const lockLeft = box(0.14, 0.86, 0.62, acceptedMaterial.clone());
  const lockRight = box(0.14, 0.86, 0.62, acceptedMaterial.clone());
  lockLeft.position.x = -1.32;
  lockRight.position.x = 1.32;
  repairLock.add(lockLeft, lockRight);
  moduleGroups[4].add(repairLock);

  const sourceSpecs = [
    ["paper", "#e86a52", -3.16, 1.78, 0.18, -0.13],
    ["figure", "#63d6b3", -3.64, 0.7, -0.16, 0.08],
    ["table", "#f2c14e", -3.12, -0.4, 0.26, -0.05],
    ["equation", "#4777ff", -3.58, -1.48, -0.08, 0.11],
  ];
  const activeSourceSpecs = saveData ? sourceSpecs.slice(0, 2) : sourceSpecs;
  const sourcePlanes = activeSourceSpecs.map(([kind, accent, x, y, z, rotation], index) => {
    const sourceTexture = saveData ? null : registerTexture(makeSourceTexture(kind, accent));
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.paper,
      map: sourceTexture,
      transparent: true,
      opacity: 0.96,
      roughness: 0.66,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.075), material);
    plane.position.set(x, y, z);
    plane.rotation.z = rotation;
    plane.userData.start = new THREE.Vector3(x, y, z);
    plane.userData.compactStart = new THREE.Vector3(x + 1.28, y, z);
    plane.userData.end = new THREE.Vector3(-1.63, 0.78 - index * 0.39, 0.12 + index * 0.04);
    plane.userData.compactEnd = new THREE.Vector3(-1.24, 0.72 - index * 0.34, 0.18 + index * 0.04);
    plane.userData.rotation = rotation;
    engineRoot.add(plane);
    return plane;
  });

  const outputRailGroup = new THREE.Group();
  outputRailGroup.name = "Shared accepted-output rail";
  [1.14, -1.14].forEach((y) => {
    const outputRail = box(7.3, 0.11, 0.24, edgeMaterial);
    outputRail.position.set(4.65, y, -0.08);
    outputRailGroup.add(outputRail);
  });
  for (let index = 0; index < 7; index += 1) {
    const tie = box(0.08, 2.36, 0.18, frameMaterial);
    tie.position.set(1.65 + index * 1.02, 0, -0.11);
    outputRailGroup.add(tie);
  }
  const outputPortal = new THREE.Group();
  const portalTop = box(0.18, 2.74, 0.5, frameMaterial);
  portalTop.position.set(1.55, 0, 0.04);
  const portalCap = box(0.42, 0.16, 0.52, edgeMaterial);
  portalCap.position.set(1.72, 1.28, 0.04);
  outputPortal.add(portalTop, portalCap);
  outputRailGroup.add(outputPortal);
  engineRoot.add(outputRailGroup);

  const textureLoader = new THREE.TextureLoader();
  const loadIntroTexture = (path) => {
    let texture;
    texture = textureLoader.load(
      path,
      () => requestRender(),
      undefined,
      () => disposeTexture(texture),
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return registerTexture(texture);
  };
  const introTextures = {
    poster: loadIntroTexture("./assets/posters/attention-1600.webp"),
    slides: loadIntroTexture("./assets/studies/slide-03.webp"),
    web: loadIntroTexture("./assets/studies/webpage.webp"),
    video: loadIntroTexture("./assets/studies/video-poster.webp"),
  };
  const introScene = createIntroScene({
    THREE,
    scene,
    registerTexture,
    textures: introTextures,
    compact: compact.matches,
    saveData,
  });
  registerRollback(() => introScene.dispose());
  const posterTextures = posters.map((poster) => registerTexture(makeFallbackPosterTexture(poster.title)));

  const outputMaterial = new THREE.MeshStandardMaterial({
    map: posterTextures[0],
    transparent: true,
    opacity: 0.8,
    roughness: 0.68,
    metalness: 0.01,
  });
  const posterACarriage = new THREE.Group();
  posterACarriage.name = "Poster A output carriage";
  const outputBacking = box(4.28, 2.3, 0.18, edgeMaterial);
  outputBacking.position.z = -0.12;
  const outputPosterWidth = 4.12;
  const outputPoster = new THREE.Mesh(
    new THREE.PlaneGeometry(outputPosterWidth, outputPosterWidth / POSTER_ASPECT),
    outputMaterial,
  );
  outputPoster.position.z = 0.01;
  posterACarriage.add(outputBacking, outputPoster);
  posterACarriage.position.set(4.1, 0.02, 0.12);
  posterACarriage.rotation.z = 0.018;
  engineRoot.add(posterACarriage);
  const outputBed = posterACarriage;

  const posterBCarriage = new THREE.Group();
  posterBCarriage.name = "Poster B output carriage after accepted Repair";
  posterBCarriage.visible = false;
  const futureBackingMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.edge,
    metalness: 0.55,
    roughness: 0.36,
    transparent: true,
    opacity: 0,
  });
  const futurePosterMaterial = new THREE.MeshStandardMaterial({
    map: posterTextures[Math.min(1, posterTextures.length - 1)],
    transparent: true,
    opacity: 0,
    roughness: 0.66,
    metalness: 0.01,
  });
  const futureBacking = box(4.28, 2.3, 0.18, futureBackingMaterial);
  futureBacking.position.z = -0.12;
  const futurePosterWidth = 4.12;
  const futurePoster = new THREE.Mesh(
    new THREE.PlaneGeometry(futurePosterWidth, futurePosterWidth / POSTER_ASPECT),
    futurePosterMaterial,
  );
  posterBCarriage.add(futureBacking, futurePoster);
  engineRoot.add(posterBCarriage);
  const futureOutput = posterBCarriage;

  const assemblyPanels = [-1, 0, 1].map((offset, index) => {
    const panel = box(1.27, 2.02, 0.08, porcelainMaterial.clone());
    panel.userData.offset = offset;
    panel.userData.index = index;
    outputBed.add(panel);
    return panel;
  });

  const scanMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.vermilion,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(4.05, 0.035), scanMaterial);
  scanLine.position.z = 0.08;
  outputBed.add(scanLine);

  const traceCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(7.35, -1.14, 0.18),
    new THREE.Vector3(6.3, -2.75, 0.42),
    new THREE.Vector3(2.1, -3.12, 0.82),
    new THREE.Vector3(-0.2, -1.53, 1.62),
  ]);
  const tracePoints = traceCurve.getPoints(90);
  const traceGeometry = new THREE.BufferGeometry().setFromPoints(tracePoints);
  const traceMaterial = new THREE.LineDashedMaterial({
    color: COLORS.teal,
    dashSize: 0.16,
    gapSize: 0.11,
    transparent: true,
    opacity: 0.82,
  });
  const diagnosticReturn = new THREE.Line(traceGeometry, traceMaterial);
  diagnosticReturn.computeLineDistances();
  diagnosticReturn.geometry.setDrawRange(0, 0);
  engineRoot.add(diagnosticReturn);
  const diagnosticPuck = box(0.24, 0.1, 0.18, new THREE.MeshBasicMaterial({ color: COLORS.teal }));
  diagnosticPuck.visible = false;
  engineRoot.add(diagnosticPuck);

  const universeGroup = new THREE.Group();
  universeGroup.visible = false;
  scene.add(universeGroup);
  const universePosters = posters.map((poster, index) => {
    const group = new THREE.Group();
    group.userData.materials = [];

    const backingMaterial = new THREE.MeshStandardMaterial({
      color: index === 0 ? 0x64716d : 0x263033,
      metalness: 0.48,
      roughness: 0.38,
      transparent: true,
      opacity: 0,
    });
    const posterMaterial = new THREE.MeshStandardMaterial({
      map: posterTextures[index],
      roughness: 0.64,
      metalness: 0.01,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const posterWidth = 4.08;
    const posterHeight = posterWidth / POSTER_ASPECT;
    const backingMesh = box(posterWidth + 0.18, posterHeight + 0.18, 0.18, backingMaterial);
    backingMesh.position.z = -0.12;
    const posterMesh = new THREE.Mesh(new THREE.PlaneGeometry(posterWidth, posterHeight), posterMaterial);
    group.add(backingMesh, posterMesh);
    group.userData.materials.push(backingMaterial, posterMaterial);
    group.userData.posterMaterial = posterMaterial;
    group.userData.posterMesh = posterMesh;
    universeGroup.add(group);
    return group;
  });

  let composer = null;
  let bloomPass = null;
  const postprocessingPasses = [];
  const bloomCapable = window.innerWidth > POSTER_COMPACT_MAX_WIDTH
    && !saveData
    && renderer.capabilities.maxTextures >= 16;
  if (bloomCapable) {
    composer = new EffectComposer(renderer);
    registerRollback(() => {
      postprocessingPasses.forEach((pass) => pass.dispose?.());
      composer?.dispose();
    });
    bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.52, 0.28, 0.76);
    postprocessingPasses.push(
      new RenderPass(scene, camera),
      bloomPass,
      new OutputPass(),
    );
    postprocessingPasses.forEach((pass) => composer.addPass(pass));
  }
  let postProcessingEnabled = composer !== null;
  let performanceDowngraded = false;
  let slowFrameCount = 0;

  let width = 1;
  let height = 1;
  let targetProgress = 0;
  let renderedProgress = 0;
  let selectedPoster = 0;
  let posterTexturesRequested = false;
  const initialShellBounds = shell.getBoundingClientRect();
  let inView = initialShellBounds.bottom > 0 && initialShellBounds.top < window.innerHeight;
  let frame = 0;
  let lastTime = performance.now();
  let pointerX = 0;
  let pointerY = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let activationPointer = null;
  let lastState = getSceneState(0, posters.length);
  let announcedIntroPhase = null;
  const raycaster = new THREE.Raycaster();
  const raycastPointer = new THREE.Vector2();
  const canDraw = () => inView && !document.hidden;

  function syncIntroPresentation(view = getIntroView(introState)) {
    shell.dataset.introPhase = introState.phase;
    shell.style.setProperty("--intro-charge", view.charge.toFixed(4));
    const chargeValue = Math.round(view.charge * INTRO_CHARGE_THRESHOLD);
    introCharge?.setAttribute("aria-valuenow", String(chargeValue));
    if (introPrompt) {
      introPrompt.dataset.chargeLabel = `${chargeValue} / ${INTRO_CHARGE_THRESHOLD}`;
      introPrompt.textContent = introState.phase === "arriving"
        ? t("intro.collecting")
        : introState.phase === "armed"
          ? t("intro.scroll")
          : introState.phase === "charging"
            ? t("intro.continue")
            : t("intro.transforming");
    }
    if (introAnnouncement && announcedIntroPhase !== introState.phase) {
      const phaseAnnouncements = {
        arriving: t("intro.announceArriving"),
        armed: t("intro.announceArmed"),
        charging: t("intro.announceCharging"),
        shockwave: t("intro.announceShockwave"),
        expansion: t("intro.announceExpansion"),
        assembly: t("intro.announceAssembly"),
        portal: t("intro.announcePortal"),
        complete: t("intro.announceComplete"),
      };
      introAnnouncement.textContent = phaseAnnouncements[introState.phase] ?? t("intro.label");
      announcedIntroPhase = introState.phase;
    }
    if (bloomPass) {
      const introBloom = introState.phase === "shockwave"
        ? 1.08
        : introState.phase === "expansion"
          ? 0.46
          : introState.phase === "assembly"
            ? 0.025
            : introState.phase === "portal"
              ? 0.06
              : 0.28 + view.charge * 0.34;
      bloomPass.strength = introState.complete ? 0.035 : introBloom;
      bloomPass.radius = introState.complete ? 0.1 : introState.phase === "shockwave" ? 0.38 : 0.16;
      bloomPass.threshold = introState.complete ? 0.98 : introState.phase === "assembly" ? 0.99 : 0.78;
    }
  }

  const syncIntroLocale = () => {
    announcedIntroPhase = null;
    syncIntroPresentation();
  };
  window.addEventListener("autodesign:localechange", syncIntroLocale);
  registerRollback(() => window.removeEventListener("autodesign:localechange", syncIntroLocale));

  function finishIntro() {
    if (introCompletionHandled) return;
    introCompletionHandled = true;
    introState = { ...introState, phase: "complete", complete: true };
    introScene.setVisible(false);
    shell.dataset.introPhase = "complete";
    resetIntroScroll(shell);
    setIntroDocumentState(false);
    if (introReplay) introReplay.hidden = false;
    if (introEnter) introEnter.hidden = true;
    syncIntroPresentation();
  }

  function applyIntroCharge(delta) {
    if (introState.complete) return;
    const previous = introState;
    introState = addIntroCharge(introState, delta);
    const view = getIntroView(introState);
    if (introState.charge !== previous.charge) introAudio.charge(view.charge);
    if (!previous.ignited && introState.ignited) introAudio.ignite();
    if (introState.complete) {
      finishIntro();
      updateScene(targetProgress, performance.now());
      draw();
    }
    syncIntroPresentation(view);
  }

  function completeIntro() {
    if (introState.complete) return;
    introState = advanceIntroState(createIntroState({ reducedMotion: false }), 1.8);
    introState = addIntroCharge(introState, INTRO_CHARGE_THRESHOLD);
    introState = advanceIntroState(introState, 3.6);
    finishIntro();
    updateScene(0, performance.now());
    draw();
  }

  function replayIntro() {
    introState = resetIntroState({ ...introState, reducedMotion: reducedMotion.matches });
    introCompletionHandled = false;
    introScene.setVisible(true);
    setIntroDocumentState(true);
    if (introReplay) introReplay.hidden = true;
    if (introEnter) introEnter.hidden = true;
    targetProgress = 0;
    renderedProgress = 0;
    resetIntroScroll(shell);
    syncIntroPresentation();
    updateScene(0, performance.now());
    draw();
    updateRunState();
  }

  function ensurePosterTextures() {
    if (posterTexturesRequested) return;
    posterTexturesRequested = true;

    posters.forEach((poster, index) => {
      let texture;
      texture = textureLoader.load(
        `./assets/posters/${poster.slug}-640.webp`,
        () => {
          if (destroyed) {
            disposeTexture(texture);
            return;
          }
          const placeholder = posterTextures[index];
          posterTextures[index] = texture;
          const posterMaterials = [
            universePosters[index].userData.posterMaterial,
            outputMaterial,
            futurePosterMaterial,
          ];
          posterMaterials.forEach((material) => {
            if (material.map !== placeholder) return;
            material.map = texture;
            material.needsUpdate = true;
          });
          if (!posterMaterials.some((material) => material.map === placeholder)) {
            disposeTexture(placeholder);
          }
          requestRender();
        },
        undefined,
        () => {
          disposeTexture(texture);
          if (!destroyed) requestRender();
        },
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      registerTexture(texture);
    });
  }

  function updateCameraTraversal(state) {
    let fromPosition = cameraPath.source;
    let toPosition = cameraPath.ingest;
    let fromTarget = cameraTargets.source;
    let toTarget = cameraTargets.ingest;
    let progress = state.ingest;

    if (state.progress >= 0.68) {
      const universeEntry = smooth(clamp((state.progress - 0.68) / 0.04, 0, 1));
      const wideView = compact.matches ? 0 : smooth(state.wide);
      if (wideView > 0) {
        fromPosition = cameraPath.universe;
        toPosition = cameraPath.wide;
        fromTarget = cameraTargets.universe;
        toTarget = cameraTargets.wide;
        progress = wideView;
      } else {
        fromPosition = cameraPath.future;
        toPosition = cameraPath.universe;
        fromTarget = cameraTargets.future;
        toTarget = cameraTargets.universe;
        progress = universeEntry;
      }
    } else if (state.progress >= 0.64) {
      fromPosition = cameraPath.evaluate;
      toPosition = cameraPath.future;
      fromTarget = cameraTargets.evaluate;
      toTarget = cameraTargets.future;
      progress = clamp((state.progress - 0.64) / 0.08, 0, 1);
    } else if (state.evaluate > 0) {
      fromPosition = cameraPath.interior;
      toPosition = cameraPath.evaluate;
      fromTarget = cameraTargets.interior;
      toTarget = cameraTargets.evaluate;
      progress = state.evaluate;
    } else if (state.interior > 0) {
      fromPosition = cameraPath.ingest;
      toPosition = cameraPath.interior;
      fromTarget = cameraTargets.ingest;
      toTarget = cameraTargets.interior;
      progress = state.interior;
    }

    cameraPosition.lerpVectors(fromPosition, toPosition, smooth(progress));
    cameraLookTarget.lerpVectors(fromTarget, toTarget, smooth(progress));

    const horizontalScale = width < 761 ? 0.42 : width <= POSTER_COMPACT_MAX_WIDTH ? 0.68 : 1;
    cameraPosition.x *= horizontalScale;
    cameraLookTarget.x *= horizontalScale;
    cameraPosition.z += width < 761 ? 1.5 : width <= POSTER_COMPACT_MAX_WIDTH ? 1.15 : 0;
    if (compact.matches && state.phase !== "universe") {
      const compactTargetCap = width < 761 ? 0.75 : 1.25;
      cameraLookTarget.x = Math.min(cameraLookTarget.x, compactTargetCap);
      cameraPosition.x = Math.min(cameraPosition.x, compactTargetCap + 0.45);
    }
    cameraPosition.x += pointerX * 0.14;
    cameraPosition.y += pointerY * 0.08;
    cameraLookTarget.x += pointerX * 0.05;
    cameraLookTarget.y -= pointerY * 0.035;

    camera.position.copy(cameraPosition);
    camera.lookAt(cameraLookTarget);
  }

  function updateScrollTarget() {
    const top = shell.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(1, shell.offsetHeight - window.innerHeight);
    const rawProgress = clamp((window.scrollY - top) / distance, 0, 1);
    const nextProgress = reducedMotion.matches
      ? getReducedMotionProgress(rawProgress, posters.length)
      : rawProgress;
    if (nextProgress === targetProgress && reducedMotion.matches) return;
    targetProgress = nextProgress;
    if (reducedMotion.matches) renderStatic();
  }

  function updateSelectedPoster(index) {
    const next = clamp(Math.round(index), 0, Math.max(0, posters.length - 1));
    if (next === selectedPoster) return;
    selectedPoster = next;
    outputMaterial.map = posterTextures[next];
    outputMaterial.needsUpdate = true;
    onPosterChange?.(next);
  }

  function updateScene(progress, time) {
    const state = getSceneState(progress, posters.length);
    const introView = getIntroView(introState);
    const engineAvailable = introState.complete
      || (introState.phase === "portal" && introView.portal > 0.5);
    lastState = state;
    shell.dataset.phase = state.phase;
    shell.dataset.universeView = state.phase !== "universe"
      ? "engine"
      : state.wide > 0
        ? "wide"
        : "focused";
    introScene.update(introView, {
      time,
      width,
      height,
      reducedMotion: reducedMotion.matches,
    });
    syncIntroPresentation(introView);

    if (state.progress >= POSTER_TEXTURE_LOAD_PROGRESS) ensurePosterTextures();
    if (state.phase === "universe") updateSelectedPoster(state.activePoster);

    const universe = smooth(clamp((state.progress - 0.68) / 0.04, 0, 1));
    const interior = smooth(state.interior);
    const evaluation = smooth(state.evaluate);
    const float = reducedMotion.matches ? 0 : Math.sin(time * 0.00055) * 0.025;

    engineRoot.visible = engineAvailable && universe < 0.98;
    const desktopX = width < 761 ? 0.34 : width <= POSTER_COMPACT_MAX_WIDTH ? 0.72 : 2.12;
    const desktopY = width < 381 ? -1.65 : width < 761 ? -1.08 : width <= POSTER_COMPACT_MAX_WIDTH ? -1.34 : -0.02;
    const phoneHeroDrop = width < 381
      ? (1 - smooth(clamp(state.progress / 0.18, 0, 1))) * 1.5
      : 0;
    engineRoot.position.x = mix(desktopX, 0, universe)
      - interior * (1 - universe) * (width < 761 ? 0.08 : 0.48);
    engineRoot.position.y = desktopY - phoneHeroDrop + float
      + mix(0, width < 761 ? -0.4 : -0.12, universe);
    engineRoot.position.z = mix(0, -2.1, universe);
    const engineScale = (width < 761 ? 0.74 : width <= POSTER_COMPACT_MAX_WIDTH ? 0.8 : 0.88)
      * mix(1, 0.76, universe);
    engineRoot.scale.setScalar(engineScale);
    engineRoot.rotation.y = -0.32 + interior * 0.26 + pointerX * 0.034;
    engineRoot.rotation.x = -0.035 + pointerY * 0.024;

    sourcePlanes.forEach((plane, index) => {
      const delayed = smooth(clamp(state.ingest * 1.42 - index * 0.13, 0, 1));
      const sourceStart = width < 761 ? plane.userData.compactStart : plane.userData.start;
      const sourceEnd = width < 761 ? plane.userData.compactEnd : plane.userData.end;
      plane.position.lerpVectors(sourceStart, sourceEnd, delayed);
      plane.position.y += reducedMotion.matches ? 0 : Math.sin(time * 0.001 + index * 1.7) * 0.025 * (1 - delayed);
      plane.rotation.z = mix(plane.userData.rotation, -0.02, delayed);
      plane.rotation.y = delayed * -0.54;
      plane.material.opacity = 0.96 * (1 - interior * 0.94);
      const allowedOnCompact = !compact.matches || index < 2;
      plane.visible = allowedOnCompact && plane.material.opacity > 0.025 && universe < 0.95;
    });

    moduleGroups.forEach((module, index) => {
      const base = module.userData.base;
      const direction = index % 2 === 0 ? -1 : 1;
      module.position.x = base.x + direction * interior * (0.28 + index * 0.055);
      module.position.y = base.y + (index - 2) * interior * 0.07;
      module.position.z = base.z + interior * (0.28 + index * 0.09);
    });

    const accepted = smooth(state.repairLocked);
    moduleGroups[4].position.z += accepted * 0.38;
    repairPlate.material.color.copy(repairBaseColor).lerp(repairAcceptedColor, accepted * 0.58);
    acceptedInsert.material.opacity = accepted;
    acceptedInsert.scale.x = Math.max(0.001, accepted);
    lockLeft.position.x = mix(-1.32, -1.08, accepted);
    lockRight.position.x = mix(1.32, 1.08, accepted);
    lockLeft.material.opacity = accepted;
    lockRight.material.opacity = accepted;

    const outputAExit = smooth(state.outputAExit);
    const outputBaseX = width < 761 ? 0.9 : compact.matches ? 3.15 : 4.1;
    const outputExitX = width < 761 ? 5.2 : compact.matches ? 7.25 : 8.2;
    const outputEntryX = width < 761 ? -0.9 : compact.matches ? 0.75 : 1.72;
    outputRailGroup.scale.x = width < 761 ? 0.62 : compact.matches ? 0.84 : 1;
    posterACarriage.position.set(mix(outputBaseX, outputExitX, outputAExit), 0.02, 0.12);
    posterACarriage.rotation.y = mix(-0.12, 0.04, interior);
    const outputAFade = 1 - smooth(clamp((outputAExit - 0.76) / 0.24, 0, 1));
    outputMaterial.opacity = (0.78 + interior * 0.22) * outputAFade * (1 - universe);
    outputBacking.visible = outputAFade > 0.01;

    const futureEnter = smooth(state.outputBEnter);
    const futureExit = smooth(clamp((state.progress - 0.705) / 0.035, 0, 1));
    const futureVisibility = futureEnter * (1 - futureExit);
    futureOutput.visible = futureVisibility > 0.01;
    futureOutput.position.set(
      mix(outputEntryX, outputBaseX, futureEnter),
      0.02,
      0.12,
    );
    futureOutput.rotation.set(
      0,
      mix(-0.3, 0.04, futureEnter),
      mix(-0.025, 0.018, futureEnter),
    );
    futureOutput.scale.setScalar(1);
    futureBackingMaterial.opacity = futureVisibility;
    futurePosterMaterial.opacity = futureVisibility;

    outputPoster.scale.setScalar(0.84 + interior * 0.16);
    assemblyPanels.forEach((panel) => {
      const offset = panel.userData.offset;
      const index = panel.userData.index;
      panel.position.x = mix(-2.9 + index * 0.28, offset * 1.34, interior);
      panel.position.y = mix(1.25 - index * 0.78, 0, interior);
      panel.position.z = mix(0.54 + index * 0.1, 0.04, interior);
      panel.rotation.z = mix(-0.24 + index * 0.2, 0, interior);
      panel.material.opacity = Math.sin(interior * Math.PI) * 0.72 * (1 - universe);
      panel.material.transparent = true;
      panel.visible = panel.material.opacity > 0.02;
    });

    const diagnosticSweep = smooth(state.diagnosticSweep);
    scanLine.position.y = mix(1.01, -1.01, diagnosticSweep);
    scanMaterial.opacity = Math.sin(diagnosticSweep * Math.PI) * 0.96 * (1 - universe);
    const diagnostic = smooth(state.diagnosticReturn);
    diagnosticReturn.geometry.setDrawRange(0, Math.floor(tracePoints.length * diagnostic));
    diagnosticReturn.visible = diagnostic > 0.01 && state.progress < 0.7;
    diagnosticPuck.visible = diagnostic > 0.01 && diagnostic < 1;
    diagnosticPuck.position.copy(traceCurve.getPoint(diagnostic));

    const wideView = compact.matches ? 0 : smooth(state.wide);
    const focusedGroupX = 0.15;
    const wideGroupX = 0;
    const focusedPoseScale = compact.matches ? 0.88 : 1;
    const widePoseScale = 1;
    const compactGroupY = width < 381
      ? height <= 700 ? 2.24 : 1.7
      : width < 761 ? 1.28 : 0.72;
    universeGroup.visible = engineAvailable && universe > 0.01;
    universeGroup.position.set(
      compact.matches ? 0 : mix(focusedGroupX, wideGroupX, wideView),
      compact.matches ? compactGroupY : 0.78,
      0.1,
    );
    universeGroup.scale.setScalar(compact.matches ? 0.9 : 1);
    const posterFloat = state.posterPosition * Math.max(0, posters.length - 1);
    const fromPoster = Math.floor(posterFloat);
    const toPoster = Math.min(posters.length - 1, Math.ceil(posterFloat));
    const poseMix = smooth(state.posterMix);
    universePosters.forEach((posterGroup, index) => {
      const fromPose = getPosterPose(index, fromPoster, compact.matches);
      const toPose = getPosterPose(index, toPoster, compact.matches);
      const x = mix(fromPose.x, toPose.x, poseMix);
      const y = mix(fromPose.y, toPose.y, poseMix);
      const z = mix(fromPose.z, toPose.z, poseMix);
      const ry = mix(fromPose.ry, toPose.ry, poseMix);
      const focusedScale = mix(fromPose.scale, toPose.scale, poseMix) * focusedPoseScale;
      const poseOpacity = mix(fromPose.opacity, toPose.opacity, poseMix);
      const widePose = getWidePosterPose(index, posters.length);
      const distance = Math.abs(index - selectedPoster);
      const focusedOpacity = distance === 0 ? 1 : distance === 1 ? 0.72 : distance === 2 ? 0.3 : 0.06;
      const exhibitionOpacity = mix(focusedOpacity, widePose.opacity, wideView);
      const opacity = poseOpacity * universe * exhibitionOpacity;
      posterGroup.position.set(
        mix(x, widePose.x, wideView),
        mix(y, widePose.y, wideView),
        mix(z, widePose.z, wideView),
      );
      posterGroup.rotation.set(0, mix(ry, widePose.ry, wideView), 0);
      posterGroup.scale.setScalar(mix(focusedScale, widePose.scale * widePoseScale, wideView));
      posterGroup.userData.materials.forEach((material) => {
        material.opacity = opacity;
      });
      posterGroup.visible = opacity > 0.015;
      posterGroup.renderOrder = index === selectedPoster ? 20 : Math.max(1, 10 - distance);
    });

    rimLight.intensity = 9 + evaluation * 4 + accepted * 6;
    if (state.phase !== "universe") canvas.style.cursor = "default";
    updateCameraTraversal(state);
  }

  function draw() {
    if (!canDraw()) return;
    renderer.info.reset();
    if (composer && postProcessingEnabled) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    shell.dataset.drawCalls = String(renderer.info.render.calls);
  }

  function tick(time) {
    if (destroyed || !canDraw()) {
      frame = 0;
      return;
    }
    const frameTime = time - lastTime;
    shell.dataset.frameMs = String(Math.max(0, Math.round(frameTime)));
    const delta = Math.min(0.05, Math.max(0.001, frameTime / 1000));
    lastTime = time;
    if (postProcessingEnabled) {
      slowFrameCount = frameTime > 24 ? slowFrameCount + 1 : Math.max(0, slowFrameCount - 2);
      if (slowFrameCount >= 45) {
        performanceDowngraded = true;
        postProcessingEnabled = false;
        shell.dataset.renderQuality = "direct";
      }
    }
    renderedProgress += (targetProgress - renderedProgress) * (1 - Math.pow(0.0008, delta));
    pointerX += (pointerTargetX - pointerX) * (1 - Math.pow(0.002, delta));
    pointerY += (pointerTargetY - pointerY) * (1 - Math.pow(0.002, delta));
    if (!introState.complete) {
      const previousPhase = introState.phase;
      introState = advanceIntroState(introState, delta);
      if (previousPhase !== "assembly" && introState.phase === "assembly") introAudio.resolve();
      if (introState.complete) finishIntro();
    }
    updateScene(renderedProgress, time);
    draw();
    frame = requestAnimationFrame(tick);
  }

  function stopLoop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function updateRunState() {
    stopLoop();
    const shouldRun = canDraw() && !reducedMotion.matches;
    canvas.dataset.scene = shouldRun ? "running" : "static";
    if (shouldRun) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (canDraw() && reducedMotion.matches) {
      renderStatic();
    }
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    const dprCap = compact.matches ? 1.35 : 1.8;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = compact.matches ? 45 : 37;
    camera.updateProjectionMatrix();
    composer?.setPixelRatio(renderer.getPixelRatio());
    composer?.setSize(width, height);
    postProcessingEnabled = composer !== null && !compact.matches && !performanceDowngraded;
    if (reducedMotion.matches) renderStatic();
  }

  function renderStatic() {
    if (destroyed) return;
    if (!canDraw()) return;
    renderedProgress = targetProgress;
    pointerX = 0;
    pointerY = 0;
    updateScene(renderedProgress, performance.now());
    draw();
    canvas.dataset.scene = "static";
  }

  function goToState(target, index = 0) {
    const selected = target === "artifacts"
      ? 0
      : clamp(Math.round(index), 0, Math.max(0, posters.length - 1));
    if (target === "poster" || target === "artifacts") ensurePosterTextures();
    const progress = getAuthoredSceneProgress(target, posters.length, selected);
    scrollToSceneProgress(shell, progress);
    targetProgress = progress;
    renderedProgress = progress;
    if (target === "poster" || target === "artifacts") updateSelectedPoster(selected);
    updateScene(progress, performance.now());
    draw();
  }

  function setPoster(index) {
    goToState("poster", index);
  }

  function handlePointer(event) {
    if (!inView || reducedMotion.matches) return;
    const normalizedX = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
    const normalizedY = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
    if (!introState.complete) introScene.setPointer(normalizedX, -normalizedY);
    if (!allowsPointerParallax({
      pointerType: event.pointerType,
      finePointer: finePointer.matches,
      compact: compact.matches,
    })) return;
    pointerTargetX = normalizedX;
    pointerTargetY = normalizedY;
    if (lastState.phase === "universe") {
      canvas.style.cursor = isActivePosterHit(event) ? "zoom-in" : "default";
    }
  }

  function isActivePosterHit(event) {
    if (lastState.phase !== "universe") return false;
    const activePosterMesh = universePosters[selectedPoster]?.userData.posterMesh;
    if (!activePosterMesh || !activePosterMesh.parent.visible) return false;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    raycastPointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(raycastPointer, camera);
    return raycaster.intersectObject(activePosterMesh, false).length > 0;
  }

  function handleCanvasPointerDown(event) {
    if (event.button !== 0 || lastState.phase !== "universe") return;
    activationPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handleCanvasPointerUp(event) {
    const start = activationPointer;
    activationPointer = null;
    if (!start || start.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    if (isActivePosterHit(event)) onPosterActivate?.(selectedPoster);
  }

  function handleCanvasPointerCancel() {
    activationPointer = null;
  }

  function handleIntroWheel(event) {
    if (introState.complete) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    applyIntroCharge(Math.max(0, event.deltaY * unit));
  }

  function handleIntroTouchStart(event) {
    if (introState.complete) return;
    touchY = event.touches[0]?.clientY ?? null;
  }

  function handleIntroTouchMove(event) {
    if (introState.complete || touchY === null) return;
    const touch = event.touches[0];
    if (!touch) return;
    event.preventDefault();
    const delta = touchY - touch.clientY;
    touchY = touch.clientY;
    introScene.setPointer(
      clamp((touch.clientX / window.innerWidth) * 2 - 1, -1, 1),
      -clamp((touch.clientY / window.innerHeight) * 2 - 1, -1, 1),
    );
    applyIntroCharge(Math.max(0, delta));
  }

  function handleIntroTouchEnd() {
    touchY = null;
  }

  function handleIntroKeydown(event) {
    if (introState.complete || ![" ", "Spacebar", "PageDown", "ArrowDown"].includes(event.key)) return;
    const target = event.target;
    if (target instanceof Element && (
      target.closest("button, a, input, select, textarea, summary")
      || target.closest("[contenteditable='true']")
    )) return;
    event.preventDefault();
    applyIntroCharge(INTRO_CHARGE_THRESHOLD);
  }

  function requestRender() {
    if (!destroyed && !frame && reducedMotion.matches) renderStatic();
  }

  let resizeObserver;
  let intersectionObserver;
  try {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        updateRunState();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(shell);
  } catch (error) {
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    throw error;
  }
  registerRollback(() => {
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
  });

  const handleVisibility = () => updateRunState();
  const handleMotionChange = () => {
    if (!introState.complete) {
      introState = createIntroState({ reducedMotion: reducedMotion.matches });
      if (reducedMotion.matches) introState = advanceIntroState(introState, 1.8);
      introScene.setVisible(true);
      syncIntroPresentation();
    }
    updateScrollTarget();
    updateRunState();
  };
  const handleCompactChange = () => {
    pointerTargetX = 0;
    pointerTargetY = 0;
    resize();
  };
  window.addEventListener("scroll", updateScrollTarget, { passive: true });
  window.addEventListener("pointermove", handlePointer, { passive: true });
  window.addEventListener("wheel", handleIntroWheel, { passive: false });
  window.addEventListener("touchstart", handleIntroTouchStart, { passive: true });
  window.addEventListener("touchmove", handleIntroTouchMove, { passive: false });
  window.addEventListener("touchend", handleIntroTouchEnd, { passive: true });
  window.addEventListener("touchcancel", handleIntroTouchEnd, { passive: true });
  window.addEventListener("keydown", handleIntroKeydown);
  document.addEventListener("visibilitychange", handleVisibility);
  reducedMotion.addEventListener("change", handleMotionChange);
  compact.addEventListener("change", handleCompactChange);
  canvas.addEventListener("pointerdown", handleCanvasPointerDown);
  canvas.addEventListener("pointerup", handleCanvasPointerUp);
  canvas.addEventListener("pointercancel", handleCanvasPointerCancel);
  registerRollback(() => {
    window.removeEventListener("scroll", updateScrollTarget);
    window.removeEventListener("pointermove", handlePointer);
    window.removeEventListener("wheel", handleIntroWheel);
    window.removeEventListener("touchstart", handleIntroTouchStart);
    window.removeEventListener("touchmove", handleIntroTouchMove);
    window.removeEventListener("touchend", handleIntroTouchEnd);
    window.removeEventListener("touchcancel", handleIntroTouchEnd);
    window.removeEventListener("keydown", handleIntroKeydown);
    document.removeEventListener("visibilitychange", handleVisibility);
    reducedMotion.removeEventListener("change", handleMotionChange);
    compact.removeEventListener("change", handleCompactChange);
    canvas.removeEventListener("pointerdown", handleCanvasPointerDown);
    canvas.removeEventListener("pointerup", handleCanvasPointerUp);
    canvas.removeEventListener("pointercancel", handleCanvasPointerCancel);
  });

  syncIntroPresentation();
  updateScrollTarget();
  resize();
  updateRunState();

  return {
    goToState,
    setPoster,
    completeIntro,
    replayIntro,
    setIntroSound(enabled) {
      introAudio.setEnabled(enabled);
    },
    getIntroSound() {
      return introAudio.getEnabled();
    },
    resize,
    renderStatic,
    resume() {
      if (destroyed) return;
      const bounds = shell.getBoundingClientRect();
      inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
      updateScrollTarget();
      resize();
      updateScene(targetProgress, performance.now());
      draw();
      updateRunState();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("scroll", updateScrollTarget);
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("wheel", handleIntroWheel);
      window.removeEventListener("touchstart", handleIntroTouchStart);
      window.removeEventListener("touchmove", handleIntroTouchMove);
      window.removeEventListener("touchend", handleIntroTouchEnd);
      window.removeEventListener("touchcancel", handleIntroTouchEnd);
      window.removeEventListener("keydown", handleIntroKeydown);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionChange);
      compact.removeEventListener("change", handleCompactChange);
      canvas.removeEventListener("pointerdown", handleCanvasPointerDown);
      canvas.removeEventListener("pointerup", handleCanvasPointerUp);
      canvas.removeEventListener("pointercancel", handleCanvasPointerCancel);

      introScene.dispose();
      void introAudio.destroy();
      setIntroDocumentState(false);
      scene.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => material.dispose());
      });
      [...textures].forEach(disposeTexture);
      postprocessingPasses.forEach((pass) => pass.dispose?.());
      composer?.dispose();
      renderer.dispose();
    },
  };
}
