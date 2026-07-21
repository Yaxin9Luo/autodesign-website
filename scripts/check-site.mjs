import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import process from "node:process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => readFileSync(resolve(root, file), "utf8");
const requiredIds = [
  "scene-shell",
  "hero",
  "optimization",
  "engine-labels",
  "posters",
  "poster-caption",
  "poster-index",
  "artifact-studies",
  "evidence",
  "metric-grid",
  "poster-dialog",
  "evolution",
  "evolution-rail",
  "harness",
  "harness-stage-list",
  "results",
  "transfer-chart",
  "resources",
  "intro-overlay",
  "intro-phase",
  "intro-announcement",
  "intro-charge",
  "intro-sound",
  "intro-replay",
  "intro-enter",
];
const posterSlugs = [
  "attention",
  "videogui",
  "global-burden",
  "climate-projections",
  "currency-crashes",
  "gravitational-waves",
  "global-carbon-budget",
  "vit",
  "nerf",
  "clip",
  "illustris",
  "m87",
];
const failures = [];
const threeFiles = [
  "vendor/three/three.module.min.js",
  "vendor/three/three.core.min.js",
  "vendor/three/addons/postprocessing/EffectComposer.js",
  "vendor/three/addons/postprocessing/RenderPass.js",
  "vendor/three/addons/postprocessing/UnrealBloomPass.js",
  "vendor/three/addons/postprocessing/OutputPass.js",
  "vendor/three/addons/postprocessing/Pass.js",
  "vendor/three/addons/postprocessing/ShaderPass.js",
  "vendor/three/addons/postprocessing/MaskPass.js",
  "vendor/three/addons/shaders/CopyShader.js",
  "vendor/three/addons/shaders/LuminosityHighPassShader.js",
  "vendor/three/addons/shaders/OutputShader.js",
  "vendor/three/LICENSE",
];
for (const file of threeFiles) {
  if (!existsSync(resolve(root, file))) failures.push("missing " + file);
}
const relativeImportPattern = /\b(?:import|export|from)\b[^"'`]*?["'](\.{1,2}\/[^"']+)["']/g;
const collectJavaScriptFiles = (directory, relativeDirectory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolutePath = resolve(directory, entry.name);
  const relativePath = relativeDirectory + "/" + entry.name;
  if (entry.isDirectory()) return collectJavaScriptFiles(absolutePath, relativePath);
  return entry.isFile() && entry.name.endsWith(".js") ? [relativePath] : [];
});
const vendoredJavaScriptFiles = existsSync(resolve(root, "vendor/three"))
  ? collectJavaScriptFiles(resolve(root, "vendor/three"), "vendor/three")
  : [];
for (const file of vendoredJavaScriptFiles) {
  const sourcePath = resolve(root, file);
  if (!existsSync(sourcePath)) continue;
  const source = readFileSync(sourcePath, "utf8");
  const relativeImports = new Set();
  for (const line of source.split(/\r?\n/)) {
    for (const match of line.matchAll(relativeImportPattern)) {
      relativeImports.add(match[1]);
    }
  }
  for (const importPath of relativeImports) {
    const target = resolve(root, file, "..", importPath);
    if (!existsSync(target)) failures.push("missing relative import " + file + " -> " + importPath);
  }
}

for (const file of ["index.html", "styles.css", "site-data.js", "app.js", "page-lifecycle.js", "scene-state.js", "three-scene.js", "intro-state.js", "intro-audio.js", "intro-scene.js", "scripts/prepare-promotional-assets.mjs"]) {
  if (!existsSync(resolve(root, file))) failures.push("missing " + file);
}

if (existsSync(resolve(root, "scripts/prepare-promotional-assets.mjs"))) {
  const preparationScript = read("scripts/prepare-promotional-assets.mjs");
  const approvedPosterSha256 = "6290d4be1bc4a7b0432941f875415102c78099d8e2c837431c375480115a3cf9";
  for (const symbol of [
    `const APPROVED_POSTER_SHA256 = "${approvedPosterSha256}"`,
    'createHash("sha256")',
    "Approved PosterHarness poster SHA-256 mismatch",
  ]) {
    if (!preparationScript.includes(symbol)) failures.push("promotional asset preparation missing " + symbol);
  }
  const overwriteFlagCount = preparationScript.match(/"-y"/g)?.length ?? 0;
  if (overwriteFlagCount !== 2) {
    failures.push("promotional asset preparation must set exactly two FFmpeg overwrite flags");
  }
}

if (existsSync(resolve(root, "intro-scene.js"))) {
  const introScene = read("intro-scene.js");
  for (const symbol of [
    "export function createIntroScene",
    "update(view, frame)",
    "setPointer(x, y)",
    "setVisible(visible)",
    "dispose()",
    "vec2 radialOffset = point.xy - pointerWorld",
    "normalize(radialOffset",
  ]) {
    if (!introScene.includes(symbol)) failures.push("intro-scene.js missing " + symbol);
  }
  for (const forbidden of [
    "WebGLRenderer",
    "requestAnimationFrame",
    "getContext(",
    "PerspectiveCamera",
    "EffectComposer",
    "ResizeObserver",
    "IntersectionObserver",
    "addEventListener(",
  ]) {
    if (introScene.includes(forbidden)) failures.push("intro-scene.js must not contain " + forbidden);
  }
  try {
    execFileSync(process.execPath, ["--check", resolve(root, "intro-scene.js")], { stdio: "pipe" });
  } catch (error) {
    failures.push("intro-scene.js has invalid module syntax");
  }
}

const projectJavaScriptFiles = collectJavaScriptFiles(root, ".")
  .filter((file) => !file.startsWith("./dist/") && !file.startsWith("./vendor/") && !file.startsWith("./node_modules/"));
const rendererOccurrences = projectJavaScriptFiles.reduce((count, file) => {
  const source = readFileSync(resolve(root, file), "utf8");
  return count + (source.match(/new\s+THREE\.WebGLRenderer\s*\(/g)?.length ?? 0);
}, 0);
if (rendererOccurrences !== 1) {
  failures.push("project must contain exactly one new THREE.WebGLRenderer occurrence; found " + rendererOccurrences);
}

if (["index.html", "styles.css", "site-data.js", "app.js", "scene-state.js"].every((file) => existsSync(resolve(root, file)))) {
  const html = read("index.html");
  for (const id of requiredIds) {
    if (!html.includes('id="' + id + '"')) failures.push("missing #" + id);
  }
  if (!html.includes('type="module"')) failures.push("missing ES module entrypoint");
  if (!html.includes('type="importmap"')) failures.push("missing import map");
  if (!html.includes('"three": "./vendor/three/three.module.min.js"')) failures.push("missing local three import");
  if (!html.includes('"three/addons/": "./vendor/three/addons/"')) failures.push("missing local three addons import");
  if (!html.includes("https://designanything.ai")) failures.push("missing platform CTA");
  for (const symbol of [
    "Meta-Harness Optimization Loop",
    "meta-loop-orbit",
    "poster-harness-core",
    "Accepted state",
    "Artifact studies / emerging formats",
    "10-paper controlled subset",
    "100-paper AutoPosterBench main track",
  ]) {
    if (!html.includes(symbol)) failures.push("index.html missing " + symbol);
  }
  if (html.includes("/api")) failures.push("public page must not request /api");
  const fallbackImage = html.match(/<img[^>]*class="scene-fallback"[^>]*>/)?.[0] ?? "";
  if (!fallbackImage.includes('data-src="./assets/posters/attention-1600.webp"')) {
    failures.push("fallback image must keep its poster URL in data-src");
  }
  if (/\ssrc=/.test(fallbackImage)) failures.push("fallback image must not load eagerly");
  for (const symbol of [
    'data-scene-target="system"',
    'data-scene-target="artifacts"',
    "fallback-composition",
    "fallback-source",
    "fallback-engine",
    "fallback-output",
  ]) {
    if (!html.includes(symbol)) failures.push("index.html missing " + symbol);
  }

  const data = read("site-data.js");
  for (const claim of ["77.55", "77.47", "+6.79", "+5.26–39.05", "100"]) {
    if (!data.includes(claim)) failures.push("missing approved claim " + claim);
  }
  if (data.includes("/api")) failures.push("site-data.js must not call /api");

  try {
    const sandbox = { window: {} };
    createContext(sandbox);
    new Script(data, { filename: "site-data.js" }).runInContext(sandbox);
    const siteData = sandbox.window.AutoDesignSiteData;
    if (!Array.isArray(siteData?.metrics) || siteData.metrics.length !== 5) {
      failures.push("site-data.js must expose five metrics");
    }
    if (!Array.isArray(siteData?.posters) || siteData.posters.length !== 12) {
      failures.push("site-data.js must expose twelve posters");
    }
    if (!Array.isArray(siteData?.researchRecord) || siteData.researchRecord.length !== 5) {
      failures.push("site-data.js must expose five research-record entries");
    }
    if (!Array.isArray(siteData?.evolution) || siteData.evolution.length !== 5) {
      failures.push("site-data.js must expose five representative evolution states");
    }
    if (siteData?.evolution?.[0]?.phase !== "Baseline") {
      failures.push("evolution must begin with Baseline");
    }
    if (siteData?.evolution?.at(-1)?.phase !== "Final Harness") {
      failures.push("evolution must end with Final Harness");
    }
    if (!Array.isArray(siteData?.harnessStages) || siteData.harnessStages.length !== 5) {
      failures.push("site-data.js must expose five PosterHarness stages");
    }
    if (!Array.isArray(siteData?.transferResults) || siteData.transferResults.length !== 7) {
      failures.push("site-data.js must expose seven transfer results");
    }
  } catch (error) {
    failures.push("site-data.js failed to execute: " + error.message);
  }

  const app = read("app.js");
  for (const symbol of [
    "openPoster",
    "createArtifactScene",
    "poster-index",
    "poster-caption",
    "poster-index__previous",
    "poster-index__next",
    "selectPoster",
    "aria-current",
    "Inspect poster",
    "researchRecord",
    "metrics",
    "bindPageLifecycle",
    "bindSceneFocus",
    "bindSemanticNavigation",
    "renderEvolution",
    "renderHarness",
    "renderTransferResults",
    "bindArtifactStudies",
    'controller?.goToState("system")',
    'controller?.goToState("artifacts")',
    'controller?.goToState("poster", activePosterIndex)',
  ]) {
    if (!app.includes(symbol)) failures.push("app.js missing " + symbol);
  }
  if (app.includes('fetch("/api') || app.includes("fetch('/api")) {
    failures.push("app.js must not call /api");
  }
  if (app.includes("overEvidence")) failures.push("app.js retains stale overEvidence header state");

  if (existsSync(resolve(root, "three-scene.js"))) {
    const scene = read("three-scene.js");
    for (const symbol of [
      "WebGLRenderer",
      'canvas.getContext("webgl2"',
      "if (!webglContext) return createFallbackController",
      "context: webglContext",
      "createArtifactScene",
      "createArtifactSceneRuntime",
      'from "./intro-state.js"',
      'from "./intro-audio.js"',
      'from "./intro-scene.js"',
      "IntersectionObserver",
      "visibilitychange",
      "prefers-reduced-motion",
      "renderer.info.autoReset = false",
      "renderer.info.reset()",
      'target.closest("button, a, input, select, textarea, summary")',
      "AutoDesign scene initialization failed; using fallback.",
      "getAuthoredSceneProgress",
      "getReducedMotionProgress",
      "allowsPointerParallax",
    ]) {
      if (!scene.includes(symbol)) failures.push("three-scene.js missing " + symbol);
    }
    for (const symbol of [
      "function loadFallbackImage",
      "fallback.src = fallback.dataset.src",
      "const saveData",
      "const canDraw",
      "activeSourceSpecs",
      "const sourceTexture = saveData ? null",
      "cameraLookTarget",
      "futureOutput",
      "const POSTER_ASPECT = 2048 / 1025",
      "function ensurePosterTextures()",
      "posterTexturesRequested",
      "state.progress >= POSTER_TEXTURE_LOAD_PROGRESS",
      "const fromPoster",
      "const toPoster",
      "state.posterMix",
      "state.wide",
      "scrollToSceneProgress",
      "POSTER_COMPACT_MAX_WIDTH",
      "shell.dataset.universeView",
      "state.wide > 0",
      "getWidePosterPose",
      "focusedGroupX",
      "wideGroupX",
      "focusedPoseScale",
      'behavior: "instant"',
      "new THREE.Raycaster",
      "intersectObject(activePosterMesh, false)",
      'lastState.phase !== "universe"',
      'canvas.addEventListener("pointerdown"',
      'canvas.addEventListener("pointerup"',
      'window.matchMedia("(pointer: fine)")',
      "posterACarriage",
      "posterBCarriage",
      "outputRailGroup",
      "repairLock",
      "state.outputAExit",
      "state.diagnosticReturn",
      "state.repairLocked",
      "state.outputBEnter",
      "slowFrameCount",
      "postProcessingEnabled",
    ]) {
      if (!scene.includes(symbol)) failures.push("three-scene.js missing " + symbol);
    }
    if (scene.includes('canvas.addEventListener("click"')) {
      failures.push("canvas activation must raycast pointer/touch instead of handling generic clicks");
    }
    if (!scene.includes('window.matchMedia(`(max-width: ${POSTER_COMPACT_MAX_WIDTH}px)`)')) {
      failures.push("Poster Universe matchMedia must use the shared compact breakpoint");
    }
    if (scene.includes('matchMedia("(max-width: 760px)"')) {
      failures.push("Poster Universe must not retain the old mobile-only compact breakpoint");
    }
    if (scene.includes("lastState.posterPosition <= 0")) {
      failures.push("poster activation must include the first visible universe stop");
    }
    if (!scene.includes("window.innerWidth > POSTER_COMPACT_MAX_WIDTH")) {
      failures.push("bloom must remain disabled at and below the compact breakpoint");
    }
    if (!scene.includes("const postprocessingPasses = []")) {
      failures.push("postprocessing passes must be retained for explicit disposal");
    }
    if (!/postprocessingPasses\.forEach\(\(pass\) => pass\.dispose\?\.\(\)\);[\s\S]{0,80}composer\?\.dispose\(\);/.test(scene)) {
      failures.push("postprocessing passes must be disposed before the composer");
    }
    for (const symbol of [
      "const disposedTextures = new WeakSet()",
      "disposeTexture(placeholder)",
      "[...textures].forEach(disposeTexture)",
    ]) {
      if (!scene.includes(symbol)) failures.push("three-scene.js missing texture cleanup " + symbol);
    }
    if (!/reducedMotion\.matches[\s\S]{0,120}getReducedMotionProgress/.test(scene)) {
      failures.push("reduced motion must quantize scroll progress to authored snapshots");
    }
    if (!scene.includes("if (!allowsPointerParallax")) {
      failures.push("pointermove must use the explicit fine non-touch parallax guard");
    }
    if (scene.indexOf("const saveData") > scene.indexOf("const sourceSpecs")) {
      failures.push("saveData must be determined before source planes");
    }
    const renderStaticBody = scene.match(/function renderStatic\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
    if (!renderStaticBody.includes("if (!canDraw()) return")) {
      failures.push("renderStatic must retain the visible draw guard");
    }
    if (renderStaticBody.includes("reducedMotion.matches")) {
      failures.push("public renderStatic must allow explicit normal-motion draws");
    }
    if (!scene.includes("if (reducedMotion.matches) renderStatic();")) {
      failures.push("automatic static draws must remain reduced-motion only");
    }
    if (!scene.includes("if (!canDraw()) return")) {
      failures.push("WebGL draws must be guarded while hidden or offscreen");
    }
  }

  const styles = read("styles.css");
  const sceneState = read("scene-state.js");
  for (const symbol of [
    "POSTER_COMPACT_MAX_WIDTH",
    "isCompactPosterViewport",
    "POSTER_SEQUENCE_START",
    "POSTER_SEQUENCE_END",
    "POSTER_WIDE_START",
    "getPosterProgress",
    "wide:",
    "AUTHORED_SCENE_TARGETS",
    "getAuthoredSceneProgress",
    "getReducedMotionProgress",
    "allowsPointerParallax",
    "getWidePosterPose",
  ]) {
    if (!sceneState.includes(symbol)) failures.push("scene-state.js missing " + symbol);
  }
  if (!styles.includes('#scene-shell[data-phase="evaluate"] .engine-label--designer')) {
    failures.push("styles.css must suppress the conflicting Designer label during evaluation");
  }
  if (!styles.includes(".site-header--scene")) failures.push("styles.css missing persistent scene header state");
  if (!styles.includes(".site-header--paper")) failures.push("styles.css missing persistent paper header state");
  for (const selector of [
    ".fallback-composition",
    ".fallback-source",
    ".fallback-engine",
    ".fallback-output",
    ".evidence::before",
    ".evolution-workbench",
    ".harness-stage-list",
    ".transfer-chart",
    ".resource-list",
  ]) {
    if (!styles.includes(selector)) failures.push("styles.css missing " + selector);
  }
  for (const selector of [
    ".poster-index__steps",
    ".poster-index__nav",
    ".poster-index__previous",
    ".poster-index__next",
    '#scene-shell[data-phase="universe"] .poster-controls',
    "#scene-shell.webgl-fallback .poster-controls",
    "#scene-shell.webgl-fallback .optimization-note",
    '#scene-shell[data-universe-view="wide"] .poster-controls',
    "touch-action: pan-y",
  ]) {
    if (!styles.includes(selector)) failures.push("styles.css missing Poster Universe contract " + selector);
  }
  if (!/#scene-shell\[data-universe-view="wide"\] \.poster-controls\s*\{[^}]*visibility:\s*hidden;[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s.test(styles)) {
    failures.push("styles.css must hide and disable Poster Universe controls in the desktop wide state");
  }
  if (!/@media\s*\(min-width:\s*1101px\)\s*\{[^}]*#scene-shell\[data-universe-view="wide"\] \.poster-controls/s.test(styles)) {
    failures.push("desktop wide controls must begin above the shared 1100px compact breakpoint");
  }
  if (!/@media\s*\(min-width:\s*761px\)\s*and\s*\(max-width:\s*1100px\)\s*\{[\s\S]*?\.poster-controls\s*\{/s.test(styles)) {
    failures.push("styles.css must provide a poster-specific compact tablet layout through 1100px");
  }
  const shortPhoneFinale = /@media\s*\(max-width:\s*380px\)\s*and\s*\(max-height:\s*700px\)\s*\{[\s\S]*?\.poster-universe\s*\{[^}]*height:\s*calc\(2240px - max\(92svh, 620px\) - max\(108svh, 700px\)\);[^}]*\}[\s\S]*?\.poster-controls\s*\{[^}]*top:\s*calc\(100svh - 345px\);/s;
  if (!shortPhoneFinale.test(styles)) {
    failures.push("styles.css must retain terminal runway for the short-phone finale");
  }
  if (!/(?:^|\n)\.poster-controls\s*\{[^}]*pointer-events:\s*none;/s.test(styles)) {
    failures.push("Poster Universe overlay wrapper must be pointer-transparent");
  }
  if (!/(?:^|\n)\.poster-controls\s*\{[^}]*visibility:\s*hidden;[^}]*opacity:\s*0;/s.test(styles)) {
    failures.push("Poster Universe controls must wait for the universe phase");
  }
  if (!/(?:^|\n)\.poster-controls button\s*\{[^}]*pointer-events:\s*auto;/s.test(styles)) {
    failures.push("Poster Universe semantic buttons must remain pointer-interactive");
  }
  const appHeader = app.includes("initPersistentHeader")
    && app.includes("site-header--scene")
    && app.includes("site-header--paper");
  if (!appHeader) failures.push("app.js missing persistent header orchestration");
  if (!app.includes("function trapDialogFocus") || !app.includes('dialog.addEventListener("keydown", trapDialogFocus)')) {
    failures.push("app.js missing poster dialog focus containment");
  }
  if (!html.includes('id="posters" aria-labelledby="posters-title" inert')) {
    failures.push("Poster Universe must begin outside the sequential focus order");
  }
  const sceneFocus = read("scene-focus.js");
  for (const symbol of [
    'hero.toggleAttribute("inert"',
    'posterSection.toggleAttribute("inert"',
    'phase !== "dormant"',
    'phase !== "universe"',
    "intersectsViewport(posterControls",
    'shell.dataset.universeView === "wide"',
    'attributeFilter: ["data-phase", "data-universe-view", "data-intro-phase"]',
    'page.addEventListener("scroll", refresh',
  ]) {
    if (!sceneFocus.includes(symbol)) failures.push("scene-focus.js missing " + symbol);
  }

  for (const file of ["app.js", "page-lifecycle.js", "scene-focus.js", "scene-state.js", "three-scene.js"]) {
    try {
      execFileSync(process.execPath, ["--check", resolve(root, file)], { stdio: "pipe" });
    } catch (error) {
      failures.push(file + " has invalid module syntax");
    }
  }
}

if (existsSync(resolve(root, "intro-scene.js"))) {
  try {
    const THREE = await import(new URL("../vendor/three/three.module.min.js", import.meta.url));
    const { createIntroScene } = await import(new URL("../intro-scene.js", import.meta.url));
    const expect = (condition, message) => {
      if (!condition) failures.push("intro-scene module smoke: " + message);
    };
    const materialUsesTexture = (material, texture) => material?.map === texture
      || Object.values(material?.uniforms ?? {}).some((uniform) => uniform?.value === texture);

    for (const constrained of [false, true]) {
      let sharedTextureDisposals = 0;
      const makeSharedTexture = (name) => {
        const texture = new THREE.Texture();
        texture.name = name;
        texture.dispose = () => { sharedTextureDisposals += 1; };
        return texture;
      };
      const sharedTextures = {
        poster: makeSharedTexture("poster"),
        slides: makeSharedTexture("slides"),
        web: makeSharedTexture("web"),
        video: makeSharedTexture("video"),
      };
      const scene = new THREE.Scene();
      const intro = createIntroScene({
        THREE,
        scene,
        registerTexture: (texture) => texture,
        textures: sharedTextures,
        compact: constrained,
        saveData: constrained,
      });
      const genesis = scene.getObjectByName("Information Genesis");
      const inputs = scene.getObjectByName("Multimodal IN");
      const outputs = scene.getObjectByName("Multimodal OUT artifact constellation");
      expect(Boolean(genesis && inputs && outputs), "missing named genesis input/output groups");

      const points = [];
      inputs?.traverse((object) => {
        if (object.isPoints) points.push(object);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          Object.values(sharedTextures).forEach((texture) => {
            expect(!materialUsesTexture(material, texture), "input system uses a real artifact texture");
          });
        });
      });
      const pointCount = points.reduce((count, object) => count + object.geometry.getAttribute("position").count, 0);
      expect(pointCount <= (constrained ? 640 : 1600), "particle budget exceeded");
      expect(genesis?.userData.pointCount === pointCount, "point-count metadata does not match geometry");

      const glyph = scene.getObjectByName("Glyph dust input");
      const imageSheets = scene.getObjectByName("Image light sheets input");
      const codeNodes = scene.getObjectByName("Data-code coral amber nodes");
      const latticeEdges = scene.getObjectByName("Data-code lattice edges");
      const temporalRibbons = scene.getObjectByName("Temporal blue wave ribbons");
      const frameTrails = scene.getObjectByName("Temporal frame trails");
      expect(Boolean(glyph && imageSheets), "missing glyph or image-sheet system");
      expect(imageSheets?.material?.userData?.abstractProcedural === true, "image sheets are not procedural abstract material");
      expect(codeNodes?.userData?.nodePalette?.join(",") === "coral,amber", "data/code nodes do not expose coral-amber palette");
      expect(latticeEdges?.isLineSegments === true && latticeEdges.material.color.getHex() === 0xf2c14e, "data/code needs amber lattice-edge geometry");
      expect(temporalRibbons?.children?.some((child) => child.isLine)
        && temporalRibbons.children[0].material.color.getHex() === 0x7894ff, "temporal input needs blue ribbon geometry");
      expect(frameTrails?.isLineSegments === true && frameTrails.material.color.getHex() === 0x8bc7ff, "temporal input needs blue frame-trail geometry");

      const poster = scene.getObjectByName("Poster dominant artifact");
      const slides = scene.getObjectByName("Slides satellite group");
      const web = scene.getObjectByName("Web satellite group");
      const video = scene.getObjectByName("Video satellite group");
      expect(poster?.userData.shape === "poster" && poster.userData.aspect === 2, "poster shape metadata is invalid");
      expect(slides?.userData.shape === "page-stack" && slides.userData.pageCount >= 3, "slides are not a separated page stack");
      expect(slides?.userData.target?.y < 0, "slides target must remain left-bottom");
      expect(web?.userData.shape === "long-page" && Math.abs(web.userData.sourceAspect - (900 / 4257)) < 1e-6, "web artifact must retain 900x4257 aspect metadata");
      expect(video?.userData.shape === "temporal-frame", "video temporal shape metadata is invalid");
      expect(Boolean(video?.getObjectByName("Video temporal trail") && video?.getObjectByName("Video playhead")), "video needs temporal trail and playhead");
      const pageDepths = slides?.children
        .filter((child) => child.name.startsWith("Slides stack page"))
        .map((child) => child.position.z) ?? [];
      expect(new Set(pageDepths).size >= 3, "slide pages are not spatially separated");
      for (const texture of Object.values(sharedTextures)) {
        let usedByOutput = false;
        outputs?.traverse((object) => {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          if (materials.filter(Boolean).some((material) => materialUsesTexture(material, texture))) usedByOutput = true;
        });
        expect(usedByOutput, `output does not use shared ${texture.name} texture`);
      }

      const ring = scene.getObjectByName("Design Singularity orbital ring 1");
      intro.update(
        { arrival: 1, charge: 0.35, shockwave: 0, expansion: 0, assembly: 0, portal: 0 },
        { time: 1200, width: 1440, height: 900, reducedMotion: false },
      );
      const sheetMatricesBefore = Array.from(imageSheets.instanceMatrix.array);
      intro.update(
        { arrival: 1, charge: 0.35, shockwave: 0, expansion: 0, assembly: 0, portal: 0 },
        { time: 1200, width: 1440, height: 900, reducedMotion: false },
      );
      expect(genesis?.userData.pointerStrength === 0, "default pointer must not disturb the intro scene");
      expect(sheetMatricesBefore.every((value, index) => value === imageSheets.instanceMatrix.array[index]), "default pointer moved image sheets");
      const ringBefore = { ...ring?.userData.pointerResponse };
      intro.setPointer(0.75, -0.4);
      intro.update(
        { arrival: 1, charge: 0.35, shockwave: 0, expansion: 0, assembly: 0, portal: 0 },
        { time: 1200, width: 1440, height: 900, reducedMotion: false },
      );
      expect(ring?.userData.pointerResponse?.x !== ringBefore.x
        || ring?.userData.pointerResponse?.y !== ringBefore.y, "pointer does not change orbital-ring response state");
      const activePointerStrength = genesis.userData.pointerStrength;
      for (let time = 1300; time <= 2600; time += 100) {
        intro.update(
          { arrival: 1, charge: 0.35, shockwave: 0, expansion: 0, assembly: 0, portal: 0 },
          { time, width: 1440, height: 900, reducedMotion: false },
        );
      }
      expect(genesis.userData.pointerStrength < activePointerStrength * 0.1, "pointer disturbance does not decay back toward orbit");

      intro.setPointer(-0.8, 0.6);
      intro.update(
        { arrival: 1, charge: 0.5, shockwave: 0, expansion: 0, assembly: 0, portal: 0 },
        { time: 2600, width: 1440, height: 900, reducedMotion: false },
      );
      expect(genesis.userData.pointerStrength > 0.9, "pointer setup for replay reset did not activate");
      intro.setVisible(false);
      intro.setVisible(true);
      intro.update(
        { arrival: 0, charge: 0, shockwave: 0, expansion: 0, assembly: 0, portal: 0 },
        { time: 0, width: 1440, height: 900, reducedMotion: false },
      );
      expect(genesis.userData.pointerStrength === 0, "replay inherited pointer disturbance from the prior run");

      intro.update(
        { arrival: 1, charge: 1, shockwave: 0, expansion: 0, assembly: 0, portal: 0 },
        { time: 2800, width: 1440, height: 900, reducedMotion: false },
      );
      const worldCenter = (object) => {
        object.geometry.computeBoundingBox();
        const center = object.geometry.boundingBox.getCenter(new THREE.Vector3());
        return object.localToWorld(center);
      };
      const latticeWorldCenter = worldCenter(latticeEdges);
      const ribbonWorldCenter = worldCenter(temporalRibbons.children[0]);
      expect(latticeWorldCenter.length() < 0.08, `data lattice misses the singularity: ${latticeWorldCenter.length()}`);
      expect(ribbonWorldCenter.length() < 0.12, `temporal ribbons miss the singularity: ${ribbonWorldCenter.length()}`);

      intro.update(
        { arrival: 1, charge: 1, shockwave: 1, expansion: 1, assembly: 1, portal: 0.75 },
        { time: 3250, width: constrained ? 390 : 1440, height: constrained ? 844 : 900, reducedMotion: false },
      );
      expect(genesis?.userData.engineOverlap === true, "engine overlap must begin before portal completion");
      expect(poster?.visible === true
        && poster.userData.portalState.dissolve > 0
        && poster.userData.portalState.dissolve < 1, "portal handoff must overlap a partially dissolved visible poster");
      expect(poster?.scale.x > 1, "portal poster must already be expanding during overlap");

      intro.update(
        { arrival: 1, charge: 1, shockwave: 1, expansion: 1, assembly: 1, portal: 1 },
        { time: 3600, width: constrained ? 390 : 1440, height: constrained ? 844 : 900, reducedMotion: false },
      );
      expect(poster?.visible === true, "portal poster must remain present through final dissolve");
      expect(poster?.userData.portalState?.dissolve === 1, "portal poster does not finish its dissolve");
      expect(poster?.scale.x >= poster?.userData.portalState?.fillScale * 0.99, "portal poster does not fill the viewport");
      expect(genesis?.userData.engineOverlap === true, "portal does not expose engine-overlap handoff state");

      const twinScene = new THREE.Scene();
      const twin = createIntroScene({
        THREE,
        scene: twinScene,
        registerTexture: (texture) => texture,
        textures: sharedTextures,
        compact: constrained,
        saveData: constrained,
      });
      const firstGlyphPositions = Array.from(glyph.geometry.getAttribute("position").array.slice(0, 24));
      const twinGlyph = twinScene.getObjectByName("Glyph dust input");
      const twinGlyphPositions = Array.from(twinGlyph.geometry.getAttribute("position").array.slice(0, 24));
      expect(JSON.stringify(firstGlyphPositions) === JSON.stringify(twinGlyphPositions), "seeded geometry is not deterministic");
      twin.dispose();

      const geometries = new Set();
      const materials = new Set();
      genesis?.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
      });
      expect(geometries.size > 0 && materials.size > 0, "owned resource audit did not find resources");
      let geometryDisposals = 0;
      let materialDisposals = 0;
      geometries.forEach((geometry) => geometry.addEventListener("dispose", () => { geometryDisposals += 1; }));
      materials.forEach((material) => material.addEventListener("dispose", () => { materialDisposals += 1; }));
      intro.dispose();
      intro.dispose();
      expect(geometryDisposals === geometries.size, "not every owned geometry was disposed exactly once");
      expect(materialDisposals === materials.size, "not every owned material was disposed exactly once");
      expect(sharedTextureDisposals === 0, "shared textures were disposed");
      expect(scene.getObjectByName("Information Genesis") === undefined, "disposed root remains attached to scene");
    }
  } catch (error) {
    failures.push("intro-scene module smoke failed to execute: " + error.message);
  }
}

for (const asset of [
  "assets/fonts/fraunces-latin-ext.woff2",
  "assets/fonts/inter-tight-latin-ext.woff2",
  "assets/figures/agent-architecture.webp",
]) {
  if (existsSync(resolve(root, asset))) failures.push("unused generated asset remains " + asset);
}

const promotionalAssets = [
  "assets/studies/longcat-next-poster.webp",
  "assets/studies/longcat-next-slide-cover.webp",
  "assets/studies/longcat-next-slide-method.webp",
  "assets/studies/longcat-next-slide-results.webp",
  "assets/studies/longcat-next-web.webp",
  "assets/studies/ddpm-conference-poster.webp",
  "assets/studies/ddpm-conference-teaser.mp4",
  "assets/studies/ddpm-conference-video-6min.mp4",
  "assets/studies/ddpm-conference.en.vtt",
  "artifacts/slides/longcat-next/index.html",
  "artifacts/web/longcat-next/index.html",
];

const assets = [
  "assets/fonts/fraunces-latin.woff2",
  "assets/fonts/inter-tight-latin.woff2",
  ...posterSlugs.flatMap((slug) => [
    "assets/posters/" + slug + "-640.webp",
    "assets/posters/" + slug + "-1600.webp",
  ]),
  ...["00", "01", "02", "03", "04"].map((id) => `assets/evolution/evolution-${id}.webp`),
  ...promotionalAssets,
];

for (const asset of assets) {
  const file = resolve(root, asset);
  if (!existsSync(file)) {
    failures.push("missing " + asset);
    continue;
  }

  const size = statSync(file).size;
  if (size === 0) failures.push("empty " + asset);
  if (asset.includes("-640.webp") && size > 60000) failures.push("oversized card image " + asset);
  if (asset.includes("-1600.webp") && size > 250000) failures.push("oversized inspector image " + asset);
  if (asset.endsWith("-teaser.mp4") && size >= 6 * 1024 * 1024) failures.push("oversized teaser " + asset);
  if (promotionalAssets.includes(asset) && size >= 25 * 1024 * 1024) failures.push("oversized promotional artifact " + asset);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("research-site static contract: OK");
