import { createArtifactScene } from "./three-scene.js?v=20260721a";
import { bindArtifactShowcase } from "./artifact-showcase.js?v=20260721c";
import { bindPageLifecycle } from "./page-lifecycle.js";
import { bindSceneFocus } from "./scene-focus.js";

const {
  evolution,
  harnessStages,
  metrics,
  posters,
  researchRecord,
  transferResults,
} = window.AutoDesignSiteData;
const byId = (id) => document.getElementById(id);
const dialog = byId("poster-dialog");
const posterButtons = [];

let controller = null;
let activePosterIndex = 0;
let opener = null;
let previousPosterButton = null;
let nextPosterButton = null;
let posterCaptionMeta = null;
let posterCaptionTitle = null;

function posterImage(slug, width) {
  return `./assets/posters/${slug}-${width}.webp`;
}

function renderResearchRecord() {
  const root = byId("research-record");

  for (const [number, title, detail] of researchRecord) {
    const item = document.createElement("article");
    item.className = "record-item";

    const index = document.createElement("p");
    const heading = document.createElement("h3");
    const body = document.createElement("span");

    index.textContent = number;
    heading.textContent = title;
    body.textContent = detail;
    item.append(index, heading, body);
    root.append(item);
  }
}

function renderMetrics() {
  const root = byId("metric-grid");

  for (const metric of metrics) {
    const item = document.createElement("div");
    const value = document.createElement("dt");
    const detail = document.createElement("dd");
    const label = document.createElement("strong");
    const scope = document.createElement("span");

    value.textContent = metric.value;
    label.textContent = metric.label;
    scope.textContent = metric.scope;
    detail.append(label, scope);
    item.append(value, detail);
    root.append(item);
  }
}

function renderEvolution() {
  const rail = byId("evolution-rail");
  const image = byId("evolution-image");
  const patchView = byId("patch-view");
  const buttons = [];

  const selectState = (index) => {
    const state = evolution[index];
    image.classList.add("is-changing");
    const nextSource = `./assets/evolution/${state.image}.webp`;
    const preload = new Image();
    preload.onload = () => {
      image.onload = () => image.classList.remove("is-changing");
      image.src = nextSource;
    };
    preload.src = nextSource;

    byId("evolution-frame-index").textContent = `State ${state.id}`;
    byId("evolution-frame-status").textContent = state.status;
    byId("evolution-frame-status").dataset.status = state.status;
    byId("evolution-signal").textContent = state.signal;
    byId("evolution-component").textContent = `${state.phase} / ${state.component}`;
    byId("evolution-state-title").textContent = state.title;
    byId("evolution-state-detail").textContent = state.detail;
    patchView.replaceChildren();
    state.patch.forEach((line, lineIndex) => {
      const row = document.createElement("span");
      row.textContent = line;
      row.style.setProperty("--line-index", lineIndex);
      row.className = line.startsWith("-") ? "patch-line patch-line--negative" : "patch-line";
      patchView.append(row);
    });

    buttons.forEach((button, buttonIndex) => {
      button.setAttribute("aria-current", buttonIndex === index ? "step" : "false");
    });
  };

  evolution.forEach((state, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `evolution-node evolution-node--${state.status}`;
    button.innerHTML = `<span>${state.id}</span><strong>${state.phase}</strong><small>${state.component}</small>`;
    button.setAttribute("aria-label", `Show ${state.phase} state ${state.id}: ${state.component}`);
    button.addEventListener("click", () => selectState(index));
    buttons.push(button);
    rail.append(button);
  });

  selectState(0);
}

function renderHarness() {
  const root = byId("harness-stage-list");
  const buttons = [];

  const selectStage = (index) => {
    const stage = harnessStages[index];
    byId("harness-detail-index").textContent = `${stage.id} / ${stage.name}`;
    byId("harness-detail-title").textContent = stage.summary;
    byId("harness-detail-input").textContent = stage.input;
    byId("harness-detail-output").textContent = stage.output;
    buttons.forEach((button, buttonIndex) => {
      button.setAttribute("aria-pressed", buttonIndex === index ? "true" : "false");
    });
  };

  harnessStages.forEach((stage, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "harness-stage";
    button.innerHTML = `<span>${stage.id}</span><strong>${stage.short}</strong><small>${stage.name}</small>`;
    button.setAttribute("aria-label", `Inspect ${stage.name}`);
    button.addEventListener("click", () => selectStage(index));
    buttons.push(button);
    root.append(button);
  });

  selectStage(0);
}

function renderTransferResults() {
  const root = byId("transfer-chart");

  transferResults.forEach((result) => {
    const row = document.createElement("div");
    row.className = "transfer-row";
    const gain = (result.after - result.before).toFixed(2);
    row.innerHTML = `
      <p><span>${result.name}</span><strong>+${gain}</strong></p>
      <div class="transfer-track" aria-label="${result.name}: ${result.before.toFixed(2)} to ${result.after.toFixed(2)}">
        <span class="transfer-before" style="width:${result.before}%"></span>
        <span class="transfer-gain" style="left:${result.before}%;width:${result.after - result.before}%"></span>
        <i style="left:${result.after}%">${result.after.toFixed(2)}</i>
      </div>`;
    root.append(row);
  });
}

function updatePosterCaption(index) {
  activePosterIndex = Math.max(0, Math.min(posters.length - 1, index));
  const poster = posters[activePosterIndex];
  posterCaptionMeta.textContent = `${String(activePosterIndex + 1).padStart(2, "0")} / ${String(posters.length).padStart(2, "0")} · ${poster.discipline} · ${poster.year}`;
  posterCaptionTitle.textContent = poster.title;

  posterButtons.forEach((button, buttonIndex) => {
    if (buttonIndex === activePosterIndex) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  previousPosterButton.disabled = activePosterIndex === 0;
  nextPosterButton.disabled = activePosterIndex === posters.length - 1;
}

function selectPoster(index) {
  const selected = Math.max(0, Math.min(posters.length - 1, index));
  updatePosterCaption(selected);
  controller?.goToState("poster", selected);
}

function renderPosterControls() {
  const root = byId("poster-index");
  const steps = document.createElement("div");
  steps.className = "poster-index__steps";

  previousPosterButton = document.createElement("button");
  previousPosterButton.type = "button";
  previousPosterButton.className = "poster-index__nav poster-index__previous";
  previousPosterButton.textContent = "Previous";
  previousPosterButton.setAttribute("aria-label", "Show previous poster");
  previousPosterButton.addEventListener("click", () => selectPoster(activePosterIndex - 1));

  nextPosterButton = document.createElement("button");
  nextPosterButton.type = "button";
  nextPosterButton.className = "poster-index__nav poster-index__next";
  nextPosterButton.textContent = "Next";
  nextPosterButton.setAttribute("aria-label", "Show next poster");
  nextPosterButton.addEventListener("click", () => selectPoster(activePosterIndex + 1));

  posters.forEach((poster, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "poster-index__button";
    button.textContent = String(index + 1).padStart(2, "0");
    button.setAttribute("aria-label", `Show ${poster.title}`);
    button.title = poster.title;
    button.addEventListener("click", () => selectPoster(index));
    posterButtons.push(button);
    steps.append(button);
  });

  root.append(previousPosterButton, steps, nextPosterButton);

  const captionRoot = byId("poster-caption");
  posterCaptionMeta = document.createElement("p");
  posterCaptionMeta.className = "poster-caption__meta";

  const row = document.createElement("div");
  row.className = "poster-caption__row";

  posterCaptionTitle = document.createElement("p");
  posterCaptionTitle.className = "poster-caption__title";

  const inspect = document.createElement("button");
  inspect.type = "button";
  inspect.className = "text-link text-link--light poster-caption__inspect";
  inspect.textContent = "Inspect poster ↗";
  inspect.addEventListener("click", () => openPoster(posters[activePosterIndex], inspect));

  row.append(posterCaptionTitle, inspect);
  captionRoot.append(posterCaptionMeta, row);
  updatePosterCaption(0);
}

export function openPoster(poster, trigger) {
  opener = trigger;
  byId("dialog-image").src = posterImage(poster.slug, 1600);
  byId("dialog-image").alt = poster.alt;
  byId("dialog-title").textContent = poster.title;
  byId("dialog-discipline").textContent = `${poster.discipline} / ${poster.year}`;

  const metadata = byId("dialog-metadata");
  metadata.replaceChildren();
  for (const [term, detail] of [
    ["Source", poster.source],
    ["Artifact", poster.format],
  ]) {
    const title = document.createElement("dt");
    const value = document.createElement("dd");
    title.textContent = term;
    value.textContent = detail;
    metadata.append(title, value);
  }

  if (typeof dialog.showModal !== "function") return;
  dialog.showModal();
  document.documentElement.classList.add("dialog-open");
  dialog.querySelector(".dialog-close").focus();
}

function closePoster() {
  if (dialog.open) dialog.close();
}

function trapDialogFocus(event) {
  if (event.key !== "Tab") return;
  const focusable = [...dialog.querySelectorAll("button:not([disabled]), a[href]")];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function bindDialog() {
  dialog.querySelector(".dialog-close").addEventListener("click", closePoster);
  dialog.querySelector(".text-link").addEventListener("click", (event) => {
    event.preventDefault();
    closePoster();
    history.replaceState(null, "", "#posters");
    controller?.goToState("poster", activePosterIndex);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePoster();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePoster();
  });
  dialog.addEventListener("keydown", trapDialogFocus);
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("dialog-open");
    opener?.focus();
    opener = null;
  });
}

function initArtifactEngine() {
  controller = createArtifactScene({
    canvas: byId("artifact-canvas"),
    shell: byId("scene-shell"),
    posters,
    onPosterChange: updatePosterCaption,
    onPosterActivate: (index) => openPoster(posters[index], posterButtons[index]),
  });
}

function bindIntroControls() {
  const sound = byId("intro-sound");
  const replay = byId("intro-replay");
  const enter = byId("intro-enter");

  const syncSound = () => {
    const enabled = controller?.getIntroSound?.() === true;
    sound.setAttribute("aria-pressed", String(enabled));
    sound.textContent = `Sound / ${enabled ? "On" : "Off"}`;
  };
  const toggleSound = () => {
    controller?.setIntroSound?.(controller?.getIntroSound?.() !== true);
    syncSound();
  };
  const replayIntro = () => controller?.replayIntro?.();
  const enterSite = () => controller?.completeIntro?.();

  sound.addEventListener("click", toggleSound);
  replay.addEventListener("click", replayIntro);
  enter.addEventListener("click", enterSite);
  syncSound();

  return () => {
    sound.removeEventListener("click", toggleSound);
    replay.removeEventListener("click", replayIntro);
    enter.removeEventListener("click", enterSite);
  };
}

function initPersistentHeader() {
  const header = document.querySelector(".site-header");
  const sceneShell = byId("scene-shell");
  const artifactStudies = byId("artifact-studies");
  const evolutionSection = byId("evolution");
  const harnessSection = byId("harness");
  const evidence = byId("evidence");
  const resources = byId("resources");
  let frame = 0;

  const update = () => {
    frame = 0;
    const sceneBounds = sceneShell.getBoundingClientRect();
    const sampleLine = header.offsetHeight + 24;
    const isOver = (element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.top <= sampleLine && bounds.bottom > header.offsetHeight;
    };
    const overPaper = isOver(artifactStudies) || isOver(harnessSection) || isOver(evidence) || isOver(resources);
    const overScene = !overPaper && (
      (sceneBounds.top < -8 && sceneBounds.bottom > header.offsetHeight)
      || isOver(evolutionSection)
    );
    header.classList.toggle("site-header--scene", overScene);
    header.classList.toggle("site-header--paper", overPaper);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();

  return {
    refresh: update,
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    },
  };
}

function bindSemanticNavigation(focusController) {
  const targetByHash = new Map([
    ["#hero", "hero"],
    ["#optimization", "system"],
    ["#posters", "artifacts"],
    ["#evidence", "evidence"],
    ["#results", "results"],
    ["#resources", "resources"],
  ]);

  const navigate = (target) => {
    if (target === "hero") controller?.goToState("hero");
    if (target === "system") controller?.goToState("system");
    if (target === "artifacts") controller?.goToState("artifacts");
    if (target === "evidence") byId("evidence").scrollIntoView({ behavior: "instant" });
    if (target === "results") byId("results").scrollIntoView({ behavior: "instant" });
    if (target === "resources") byId("resources").scrollIntoView({ behavior: "instant" });
    focusController.refresh();
  };

  const handleLink = (event) => {
    const link = event.currentTarget;
    const target = link.dataset.sceneTarget;
    if (!target) return;
    event.preventDefault();
    history.pushState(null, "", link.hash);
    navigate(target);
  };
  const handleHashChange = () => navigate(targetByHash.get(location.hash));
  const links = [...document.querySelectorAll("[data-scene-target]")];
  links.forEach((link) => link.addEventListener("click", handleLink));
  window.addEventListener("hashchange", handleHashChange);
  if (targetByHash.has(location.hash)) requestAnimationFrame(handleHashChange);

  return () => {
    links.forEach((link) => link.removeEventListener("click", handleLink));
    window.removeEventListener("hashchange", handleHashChange);
  };
}

renderResearchRecord();
renderMetrics();
renderEvolution();
renderHarness();
renderTransferResults();
const unbindArtifactShowcase = bindArtifactShowcase();
renderPosterControls();
bindDialog();
initArtifactEngine();
const unbindIntroControls = bindIntroControls();
const headerController = initPersistentHeader();
const sceneFocusController = bindSceneFocus({
  page: window,
  shell: byId("scene-shell"),
  header: document.querySelector(".site-header"),
  hero: byId("hero"),
  posterSection: byId("posters"),
  posterControls: document.querySelector(".poster-controls"),
});
const unbindSemanticNavigation = bindSemanticNavigation(sceneFocusController);
bindPageLifecycle({
  page: window,
  controller,
  headerController,
  focusController: sceneFocusController,
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    unbindSemanticNavigation();
    unbindIntroControls();
    unbindArtifactShowcase();
  }
});
