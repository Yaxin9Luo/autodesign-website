import { t } from "./i18n.js?v=20260722a";

const VIDEO_CAPTIONS_SRC = "./assets/studies/ddpm-conference.en.vtt";
const ARTIFACT_ESCAPE_MESSAGE = "autodesign:artifact-viewer:escape";

const viewerTypes = {
  image: "viewer.image",
  iframe: "viewer.iframe",
  slides: "viewer.slides",
  video: "viewer.video",
};

export function bindArtifactShowcase({
  root = document,
  page = window,
  navigatorObject = navigator,
} = {}) {
  const tabs = [...root.querySelectorAll("[data-artifact-tab]")];
  const panels = [...root.querySelectorAll("[data-artifact-panel]")];
  const triggers = [...root.querySelectorAll("[data-open-artifact]")];
  const section = root.querySelector("#artifact-studies");
  const viewer = root.querySelector("#artifact-viewer");
  const stage = root.querySelector("#artifact-viewer-stage");
  const title = root.querySelector("#artifact-viewer-title");
  const type = root.querySelector("#artifact-viewer-type");
  const external = root.querySelector("#artifact-viewer-external");
  const closeButton = viewer?.querySelector(".artifact-viewer__close");
  const videoPanel = panels.find((panel) => panel.dataset.artifactPanel === "video");
  const teaser = videoPanel?.querySelector("video");
  const teaserSource = teaser?.querySelector("source[data-preview-src]");
  const reducedMotion = page.matchMedia("(prefers-reduced-motion: reduce)");
  const dataConnection = navigatorObject.connection;
  const documentObject = root.ownerDocument ?? root;
  const documentElement = documentObject.documentElement;
  const cleanupListeners = [];
  let sectionVisible = !page.IntersectionObserver;
  let opener = null;
  let viewerCleanup = [];
  const carouselRenderers = [];

  const listen = (target, eventName, handler) => {
    target?.addEventListener(eventName, handler);
    cleanupListeners.push(() => target?.removeEventListener(eventName, handler));
  };

  const teaserAllowed = () => !reducedMotion.matches && dataConnection?.saveData !== true;

  const unloadVideo = (video) => {
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.querySelectorAll("source[src], track[src]").forEach((element) => element.removeAttribute("src"));
    video.load();
  };

  const syncTeaser = () => {
    if (!teaser || !teaserSource) return;
    const videoSelected = !videoPanel.hidden;
    if (!videoSelected || !sectionVisible || !teaserAllowed()) {
      unloadVideo(teaser);
      return;
    }
    if (!teaserSource.hasAttribute("src")) {
      teaserSource.src = teaserSource.dataset.previewSrc;
      teaser.load();
    }
    teaser.play().catch(() => {});
  };

  const select = (name, focus = false) => {
    tabs.forEach((tab) => {
      const selected = tab.dataset.artifactTab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.artifactPanel !== name;
    });
    syncTeaser();
  };

  tabs.forEach((tab, index) => {
    listen(tab, "click", () => select(tab.dataset.artifactTab));
    listen(tab, "keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      select(tabs[next].dataset.artifactTab, true);
    });
  });

  const slideSource = (template, index) => template.replace("{index}", String(index).padStart(2, "0"));

  root.querySelectorAll("[data-slide-carousel]").forEach((carousel) => {
    const image = carousel.querySelector("[data-slide-current-image]");
    const current = carousel.querySelector("[data-slide-current]");
    const previous = carousel.querySelector("[data-slide-prev]");
    const next = carousel.querySelector("[data-slide-next]");
    const count = Number(carousel.dataset.slideCount);
    const template = carousel.dataset.slideTemplate;
    let index = 1;

    const render = () => {
      image.src = slideSource(template, index);
      image.alt = t("suite.slideAlt", { index, count });
      current.textContent = String(index).padStart(2, "0");
      previous.disabled = index === 1;
      next.disabled = index === count;
    };

    listen(previous, "click", () => {
      index = Math.max(1, index - 1);
      render();
    });
    listen(next, "click", () => {
      index = Math.min(count, index + 1);
      render();
    });
    carouselRenderers.push(render);
  });

  let visibilityObserver = null;
  if (page.IntersectionObserver && section) {
    visibilityObserver = new page.IntersectionObserver(([entry]) => {
      sectionVisible = entry.isIntersecting;
      syncTeaser();
    });
    visibilityObserver.observe(section);
  }
  listen(reducedMotion, "change", syncTeaser);
  listen(dataConnection, "change", syncTeaser);

  const clearStage = () => {
    viewerCleanup.splice(0).forEach((cleanup) => cleanup());
    unloadVideo(stage.querySelector("video"));
    const iframe = stage.querySelector("iframe");
    if (iframe) iframe.src = "about:blank";
    stage.replaceChildren();
    stage.classList.remove(
      "artifact-viewer__stage--poster",
      "artifact-viewer__stage--html",
      "artifact-viewer__stage--slides",
      "artifact-viewer__stage--video",
    );
  };

  const finishClose = () => {
    clearStage();
    documentElement?.classList.remove("dialog-open");
    opener?.focus();
    opener = null;
  };

  const closeViewer = () => {
    if (viewer.open) viewer.close();
    finishClose();
  };

  const createSlideViewer = (sourceTemplate, count, artifactTitle) => {
    const wrapper = documentObject.createElement("div");
    wrapper.className = "artifact-slide-viewer";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("aria-label", t("viewer.slidesAria", { title: artifactTitle, count }));

    const toolbar = documentObject.createElement("div");
    toolbar.className = "artifact-slide-viewer__toolbar";
    const viewport = documentObject.createElement("div");
    viewport.className = "artifact-slide-viewer__viewport";
    const image = documentObject.createElement("img");
    image.dataset.viewerSlideImage = "";
    image.width = 1920;
    image.height = 1080;
    image.draggable = false;
    viewport.append(image);

    const makeButton = (label, text, dataName) => {
      const button = documentObject.createElement("button");
      button.type = "button";
      button.ariaLabel = label;
      button.title = label;
      button.textContent = text;
      button.dataset[dataName] = "";
      return button;
    };

    const previous = makeButton(t("suite.previousSlide"), "‹", "viewerSlidePrev");
    const next = makeButton(t("suite.nextSlide"), "›", "viewerSlideNext");
    const zoomOut = makeButton(t("viewer.zoomOut"), "−", "viewerSlideZoomOut");
    const reset = makeButton(t("viewer.zoomReset"), "100%", "viewerSlideReset");
    const zoomIn = makeButton(t("viewer.zoomIn"), "+", "viewerSlideZoomIn");
    const status = documentObject.createElement("span");
    status.className = "artifact-slide-viewer__status";
    status.setAttribute("aria-live", "polite");
    toolbar.append(previous, status, next, zoomOut, reset, zoomIn);
    wrapper.append(toolbar, viewport);

    let index = 1;
    let zoom = 1;
    const updateGeometry = () => {
      const fitWidth = Math.min(viewport.clientWidth, viewport.clientHeight * (16 / 9));
      if (fitWidth > 0) image.style.width = `${Math.round(fitWidth * zoom)}px`;
      reset.textContent = `${Math.round(zoom * 100)}%`;
    };
    const render = () => {
      image.src = slideSource(sourceTemplate, index);
      image.alt = t("viewer.slideAlt", { index, count, title: artifactTitle });
      status.textContent = `${String(index).padStart(2, "0")} / ${count}`;
      previous.disabled = index === 1;
      next.disabled = index === count;
      viewport.scrollTo({ left: 0, top: 0, behavior: "auto" });
    };
    const changeSlide = (delta) => {
      index = Math.max(1, Math.min(count, index + delta));
      render();
    };
    const changeZoom = (delta) => {
      zoom = Math.max(0.5, Math.min(2.5, zoom + delta));
      updateGeometry();
    };

    const viewerListen = (target, eventName, handler) => {
      target.addEventListener(eventName, handler);
      viewerCleanup.push(() => target.removeEventListener(eventName, handler));
    };
    viewerListen(previous, "click", () => changeSlide(-1));
    viewerListen(next, "click", () => changeSlide(1));
    viewerListen(zoomOut, "click", () => changeZoom(-0.25));
    viewerListen(zoomIn, "click", () => changeZoom(0.25));
    viewerListen(reset, "click", () => {
      zoom = 1;
      updateGeometry();
      viewport.scrollTo({ left: 0, top: 0, behavior: "auto" });
    });
    viewerListen(wrapper, "keydown", (event) => {
      if (event.key === "ArrowLeft") changeSlide(-1);
      else if (event.key === "ArrowRight") changeSlide(1);
      else return;
      event.preventDefault();
    });
    viewerListen(image, "load", updateGeometry);
    viewerListen(page, "autodesign:localechange", () => {
      wrapper.setAttribute("aria-label", t("viewer.slidesAria", { title: artifactTitle, count }));
      for (const [button, key] of [
        [previous, "suite.previousSlide"],
        [next, "suite.nextSlide"],
        [zoomOut, "viewer.zoomOut"],
        [reset, "viewer.zoomReset"],
        [zoomIn, "viewer.zoomIn"],
      ]) {
        button.ariaLabel = t(key);
        button.title = t(key);
      }
      render();
    });

    if (page.ResizeObserver) {
      const observer = new page.ResizeObserver(updateGeometry);
      observer.observe(viewport);
      viewerCleanup.push(() => observer.disconnect());
    }
    render();
    stage.classList.add("artifact-viewer__stage--slides");
    return wrapper;
  };

  const createViewerArtifact = (kind, source, artifactTitle, options = {}) => {
    if (kind === "image") {
      const image = documentObject.createElement("img");
      image.src = source;
      image.alt = artifactTitle;
      stage.classList.add("artifact-viewer__stage--poster");
      return image;
    }
    if (kind === "iframe") {
      const iframe = documentObject.createElement("iframe");
      iframe.src = source;
      iframe.title = artifactTitle;
      iframe.setAttribute("sandbox", "allow-scripts allow-popups");
      stage.classList.add("artifact-viewer__stage--html");
      return iframe;
    }
    if (kind === "slides") {
      return createSlideViewer(options.sourceTemplate, options.count, artifactTitle);
    }
    if (kind === "video") {
      const video = documentObject.createElement("video");
      video.src = source;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.poster = "./assets/studies/ddpm-conference-poster.webp";
      const captions = documentObject.createElement("track");
      captions.kind = "captions";
      captions.label = "English";
      captions.srclang = "en";
      captions.src = VIDEO_CAPTIONS_SRC;
      captions.default = true;
      video.append(captions);
      stage.classList.add("artifact-viewer__stage--video");
      return video;
    }
    return null;
  };

  const openViewer = (trigger) => {
    if (typeof viewer.showModal !== "function") return;
    const {
      artifactKind,
      artifactSrc,
      artifactSrcTemplate,
      artifactCount,
      artifactTitle,
      artifactNewTab,
    } = trigger.dataset;
    clearStage();
    opener = trigger;
    title.textContent = artifactTitle;
    type.textContent = t(viewerTypes[artifactKind] ?? "viewer.artifact");
    external.href = artifactNewTab;
    const artifact = createViewerArtifact(artifactKind, artifactSrc, artifactTitle, {
      count: Number(artifactCount),
      sourceTemplate: artifactSrcTemplate,
    });
    if (!artifact) return;
    stage.append(artifact);
    viewer.showModal();
    documentElement?.classList.add("dialog-open");
    closeButton.focus();
  };

  triggers.forEach((trigger) => listen(trigger, "click", () => openViewer(trigger)));
  listen(closeButton, "click", closeViewer);
  listen(viewer, "click", (event) => {
    if (event.target === viewer) closeViewer();
  });
  listen(viewer, "cancel", (event) => {
    event.preventDefault();
    closeViewer();
  });
  listen(viewer, "close", finishClose);
  listen(page, "autodesign:localechange", () => {
    carouselRenderers.forEach((render) => render());
    if (viewer.open && opener) {
      type.textContent = t(viewerTypes[opener.dataset.artifactKind] ?? "viewer.artifact");
    }
  });
  listen(page, "message", (event) => {
    const iframe = stage.querySelector("iframe");
    if (!viewer.open || event.data !== ARTIFACT_ESCAPE_MESSAGE || event.source !== iframe?.contentWindow) return;
    closeViewer();
  });
  listen(viewer, "keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...viewer.querySelectorAll(
      'a[href], button:not([disabled]), iframe, video[controls], [tabindex]:not([tabindex="-1"])',
    )];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && documentObject.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && documentObject.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  syncTeaser();

  return () => {
    if (viewer.open) viewer.close();
    finishClose();
    cleanupListeners.forEach((cleanup) => cleanup());
    visibilityObserver?.disconnect();
    unloadVideo(teaser);
  };
}
