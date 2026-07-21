const VIDEO_CAPTIONS_SRC = "./assets/studies/ddpm-conference.en.vtt";

const viewerTypes = {
  image: "Poster",
  iframe: "Interactive artifact",
  video: "Conference video",
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
    unloadVideo(stage.querySelector("video"));
    const iframe = stage.querySelector("iframe");
    if (iframe) iframe.src = "about:blank";
    stage.replaceChildren();
    stage.classList.remove(
      "artifact-viewer__stage--poster",
      "artifact-viewer__stage--html",
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

  const createViewerArtifact = (kind, source, artifactTitle) => {
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
  };

  const openViewer = (trigger) => {
    if (typeof viewer.showModal !== "function") return;
    const { artifactKind, artifactSrc, artifactTitle, artifactNewTab } = trigger.dataset;
    clearStage();
    opener = trigger;
    title.textContent = artifactTitle;
    type.textContent = viewerTypes[artifactKind] ?? "Artifact";
    external.href = artifactNewTab;
    stage.append(createViewerArtifact(artifactKind, artifactSrc, artifactTitle));
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
