import { bindArtifactShowcase } from "./artifact-showcase.js?v=20260805a";
import { t } from "./i18n.js?v=20260805a";
import { createOpeningIntro } from "./opening-intro.js?v=20260805a";
import { bindPageLifecycle } from "./page-lifecycle.js";

const {
  evolution,
  metrics,
  researchRecord,
  transferResults,
} = window.AutoDesignSiteData;
const byId = (id) => document.getElementById(id);

let activeEvolutionIndex = 0;

function dataMessage(group, id, field, fallback) {
  const key = `${group}.${id}.${field}`;
  const value = t(key);
  return value === key ? fallback : value;
}

function renderResearchRecord() {
  const root = byId("research-record");
  root.replaceChildren();

  for (const [number, title, detail] of researchRecord) {
    const item = document.createElement("article");
    item.className = "record-item";

    const index = document.createElement("p");
    const heading = document.createElement("h3");
    const body = document.createElement("span");

    index.textContent = number;
    heading.textContent = dataMessage("record", number, "title", title);
    body.textContent = dataMessage("record", number, "detail", detail);
    item.append(index, heading, body);
    root.append(item);
  }
}

function renderMetrics() {
  const root = byId("metric-grid");
  root.replaceChildren();

  metrics.forEach((metric, index) => {
    const item = document.createElement("div");
    const value = document.createElement("dt");
    const detail = document.createElement("dd");
    const label = document.createElement("strong");
    const scope = document.createElement("span");

    value.textContent = metric.value;
    label.textContent = dataMessage("metric", index, "label", metric.label);
    scope.textContent = dataMessage("metric", index, "scope", metric.scope);
    detail.append(label, scope);
    item.append(value, detail);
    root.append(item);
  });
}

function renderEvolution() {
  const rail = byId("evolution-rail");
  const image = byId("evolution-image");
  const patchView = byId("patch-view");
  const buttons = [];
  rail.replaceChildren();

  const selectState = (index) => {
    activeEvolutionIndex = index;
    const state = evolution[index];
    image.classList.add("is-changing");
    const nextSource = `./assets/evolution/${state.image}.webp`;
    const preload = new Image();
    preload.onload = () => {
      image.onload = () => image.classList.remove("is-changing");
      image.src = nextSource;
    };
    preload.src = nextSource;

    const phase = dataMessage("evolutionData", state.id, "phase", state.phase);
    const component = dataMessage("evolutionData", state.id, "component", state.component);
    byId("evolution-frame-index").textContent = t("evolution.state", { id: state.id });
    byId("evolution-frame-status").textContent = dataMessage("evolutionData", state.id, "status", state.status);
    byId("evolution-frame-status").dataset.status = state.status;
    byId("evolution-signal").textContent = dataMessage("evolutionData", state.id, "signal", state.signal);
    byId("evolution-component").textContent = `${phase} / ${component}`;
    byId("evolution-state-title").textContent = dataMessage("evolutionData", state.id, "title", state.title);
    byId("evolution-state-detail").textContent = dataMessage("evolutionData", state.id, "detail", state.detail);
    patchView.replaceChildren();
    state.patch.forEach((line, lineIndex) => {
      const row = document.createElement("span");
      row.textContent = dataMessage("evolutionData", state.id, `patch${lineIndex}`, line);
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
    const phase = dataMessage("evolutionData", state.id, "phase", state.phase);
    const component = dataMessage("evolutionData", state.id, "component", state.component);
    button.innerHTML = `<span>${state.id}</span><strong>${phase}</strong><small>${component}</small>`;
    button.setAttribute("aria-label", t("evolution.showAria", { phase, id: state.id, component }));
    button.addEventListener("click", () => selectState(index));
    buttons.push(button);
    rail.append(button);
  });

  selectState(activeEvolutionIndex);
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

function initPersistentHeader() {
  const header = document.querySelector(".site-header");
  const sceneShell = byId("scene-shell");
  const evolutionSection = byId("evolution");
  const footer = byId("site-footer");
  let frame = 0;

  const update = () => {
    frame = 0;
    const sampleLine = header.offsetHeight + 24;
    const isOver = (element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.top <= sampleLine && bounds.bottom > header.offsetHeight;
    };
    const overScene = isOver(sceneShell) || isOver(evolutionSection) || isOver(footer);
    header.classList.toggle("site-header--scene", overScene);
    header.classList.toggle("site-header--paper", !overScene);
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

renderResearchRecord();
renderMetrics();
renderEvolution();
renderTransferResults();
const unbindArtifactShowcase = bindArtifactShowcase();
window.addEventListener("autodesign:localechange", () => {
  renderResearchRecord();
  renderMetrics();
  renderEvolution();
});
const headerController = initPersistentHeader();
const openingIntro = createOpeningIntro();
bindPageLifecycle({
  page: window,
  controller: openingIntro,
  headerController,
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    unbindArtifactShowcase();
  }
});
