import { POSTER_COMPACT_MAX_WIDTH } from "./scene-state.js";

function intersectsViewport(element, topInset, viewportHeight) {
  const bounds = element.getBoundingClientRect();
  return bounds.bottom > topInset && bounds.top < viewportHeight;
}

export function applySceneFocus({
  shell,
  header,
  hero,
  posterSection,
  posterControls,
  viewportHeight,
  viewportWidth,
}) {
  const phase = shell.dataset.phase;
  const introComplete = shell.dataset.introPhase === "complete";
  const topInset = header.offsetHeight;
  const heroVisible = intersectsViewport(hero, topInset, viewportHeight);
  const wideControlsHidden = viewportWidth > POSTER_COMPACT_MAX_WIDTH
    && shell.dataset.universeView === "wide";
  const posterControlsVisible = intersectsViewport(posterControls, topInset, viewportHeight)
    && !wideControlsHidden;

  hero.toggleAttribute("inert", !introComplete || !heroVisible || phase !== "dormant");
  posterSection.toggleAttribute("inert", !introComplete || !posterControlsVisible || phase !== "universe");
}

export function bindSceneFocus({
  page,
  shell,
  header,
  hero,
  posterSection,
  posterControls,
  Observer = MutationObserver,
}) {
  const refresh = () => applySceneFocus({
    shell,
    header,
    hero,
    posterSection,
    posterControls,
    viewportHeight: page.innerHeight,
    viewportWidth: page.innerWidth,
  });
  const observer = new Observer(refresh);

  observer.observe(shell, {
    attributes: true,
    attributeFilter: ["data-phase", "data-universe-view", "data-intro-phase"],
  });
  page.addEventListener("scroll", refresh, { passive: true });
  page.addEventListener("resize", refresh, { passive: true });
  refresh();

  return {
    refresh,
    destroy() {
      observer.disconnect();
      page.removeEventListener("scroll", refresh);
      page.removeEventListener("resize", refresh);
    },
  };
}
