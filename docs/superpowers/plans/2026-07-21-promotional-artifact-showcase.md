# Promotional Artifact Showcase Implementation Plan

> **For implementation agents:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current three-format study with a polished, lazy-loaded Poster, Slides, Web, and Video showcase using the approved LongCat-Next and DDPM artifacts.

**Architecture:** Keep the existing tabbed section, but move its tab/viewer behavior into a focused `artifact-showcase.js` module. Homepage previews remain lightweight; full standalone HTML and the narrated video are copied into the production package and instantiated only after the user opens the shared full-screen viewer.

**Tech Stack:** Semantic HTML, CSS, ES modules, native `<dialog>`, Playwright 1.61.1, FFmpeg, WebP, Cloudflare Pages.

## Global Constraints

- Present exactly four tabs in this order: Poster, Slides, Web, Video.
- Make Poster the selected tab and visible panel on initial page load.
- Use LongCat-Next for Poster, Slides, and Web; use DDPM for Video.
- Describe Poster as the validated PosterHarness output and the other formats as exploratory.
- Do not change the Three.js opening, Poster Universe, Meta-Harness, benchmark, or resource sections.
- Do not fetch full HTML artifacts or the six-minute video during initial page load.
- Preserve reduced-motion, save-data, keyboard, focus, and narrow-screen behavior.

---

### Task 1: Add Reproducible Promotional Assets And Production Contracts

**Files:**
- Create: `scripts/prepare-promotional-assets.mjs`
- Create: `artifacts/slides/longcat-next/index.html`
- Create: `artifacts/web/longcat-next/index.html`
- Create: `assets/studies/longcat-next-poster.webp`
- Create: `assets/studies/longcat-next-slide-cover.webp`
- Create: `assets/studies/longcat-next-slide-method.webp`
- Create: `assets/studies/longcat-next-slide-results.webp`
- Create: `assets/studies/longcat-next-web.webp`
- Create: `assets/studies/ddpm-conference-poster.webp`
- Create: `assets/studies/ddpm-conference-teaser.mp4`
- Create: `assets/studies/ddpm-conference-video-6min.mp4`
- Create: `assets/studies/ddpm-conference.en.vtt`
- Modify: `scripts/check-site.mjs`
- Modify: `scripts/build-production.mjs`
- Modify: `scripts/check-production.mjs`

**Interfaces:**
- Consumes: `AUTODESIGN_PROMO_ROOT` and `AUTODESIGN_POSTER_SOURCE` environment variables when regenerating assets.
- Produces: stable asset URLs used by homepage markup and the artifact viewer.

- [ ] **Step 1: Make the static contract require the new asset set**

Replace the old study entries in `scripts/check-site.mjs` with:

```js
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
```

Append `promotionalAssets` to the existing `assets` array and assert that teaser files stay below 6 MiB and each full artifact stays below Cloudflare's 25 MiB per-file limit.

- [ ] **Step 2: Run the contract and verify it fails before assets exist**

Run: `npm test`

Expected: FAIL with `missing assets/studies/longcat-next-poster.webp` and the remaining new paths.

- [ ] **Step 3: Create the asset preparation script**

Implement `scripts/prepare-promotional-assets.mjs` so it:

```js
const sourceRoot = process.env.AUTODESIGN_PROMO_ROOT;
const posterSource = process.env.AUTODESIGN_POSTER_SOURCE;
if (!sourceRoot || !posterSource) {
  throw new Error("Set AUTODESIGN_PROMO_ROOT and AUTODESIGN_POSTER_SOURCE");
}
```

The script must copy the two standalone HTML files and VTT file, transcode the LongCat-Next poster and landing preview with `cwebp`, capture slide 1, 4, and 7 locators from the standalone deck with Playwright, extract a strong DDPM poster frame, and create a muted teaser from four six-second excerpts at 30, 90, 210, and 330 seconds. Use H.264, `yuv420p`, 1280x720, CRF 24, and `+faststart` for the teaser. Copy the original H.264/AAC six-minute MP4 without re-encoding.

- [ ] **Step 4: Generate the selected artifacts**

Run:

```bash
AUTODESIGN_PROMO_ROOT="/Users/yaxinluo/Desktop/AutoDesign论文/AutoDesign宣传素材-20260721" \
AUTODESIGN_POSTER_SOURCE="/Users/yaxinluo/Desktop/AutoDeisgn-PosterBench/benchmark/autodesign codex gpt5.5 xhigh_full_data/006-ai-arxiv2026-longcat-next.png" \
node scripts/prepare-promotional-assets.mjs
```

Expected: the script prints every generated path and exits 0.

- [ ] **Step 5: Include standalone artifacts in production builds**

Add this copy operation to `scripts/build-production.mjs`:

```js
await cp(resolve(root, "artifacts"), resolve(output, "artifacts"), { recursive: true });
```

Add representative poster, HTML, teaser, full video, and caption paths to `scripts/check-production.mjs`'s `required` list.

- [ ] **Step 6: Verify asset and production contracts**

Run: `npm test && npm run build && node scripts/check-production.mjs`

Expected: `research-site static contract: OK` and a production package below 500 files with no file above 25 MiB.

- [ ] **Step 7: Commit the asset boundary**

```bash
git add scripts assets/studies artifacts
git commit -m "Add LongCat and DDPM promotional artifacts"
```

---

### Task 2: Build The Four-Format Homepage Structure

**Files:**
- Modify: `index.html`
- Modify: `scripts/check-site.mjs`

**Interfaces:**
- Consumes: stable asset paths from Task 1.
- Produces: four `[data-artifact-tab]` controls, four `[data-artifact-panel]` panels, `[data-open-artifact]` triggers, and `#artifact-viewer` markup.

- [ ] **Step 1: Add failing structural assertions**

In `scripts/check-site.mjs`, assert the ordered tab sequence and viewer hooks:

```js
const html = read("index.html");
const tabOrder = [...html.matchAll(/data-artifact-tab="([^"]+)"/g)].map((match) => match[1]);
expect(JSON.stringify(tabOrder) === JSON.stringify(["poster", "slides", "web", "video"]), "artifact tab order is invalid");
for (const token of ["artifact-viewer", "data-open-artifact", "data-artifact-src", "Validated PosterHarness output"]) {
  expect(html.includes(token), "artifact showcase missing " + token);
}
```

- [ ] **Step 2: Verify the structure test fails**

Run: `npm test`

Expected: FAIL with `artifact tab order is invalid`.

- [ ] **Step 3: Replace the three-tab markup with four formats**

Update the section heading to describe one validated poster instantiation plus three emerging formats. Add Poster as tab `01` and default panel, then renumber Slides, Web, and Video to `02`, `03`, and `04`.

Use this status copy exactly:

```text
Poster: Validated PosterHarness output
Slides: Exploratory generalization study
Web: Exploratory generalization study
Video: Exploratory generalization study
```

Every panel must include one `button[data-open-artifact]` with `data-artifact-kind`, `data-artifact-src`, `data-artifact-title`, and `data-artifact-new-tab` attributes. The DDPM teaser uses `data-preview-src` rather than a populated `<source src>`.

- [ ] **Step 4: Add a shared native dialog**

Add `dialog#artifact-viewer` after the existing poster dialog with:

```html
<button type="button" class="artifact-viewer__close" aria-label="Close artifact viewer">×</button>
<p class="artifact-viewer__type" id="artifact-viewer-type"></p>
<h2 id="artifact-viewer-title"></h2>
<div id="artifact-viewer-stage" class="artifact-viewer__stage"></div>
<a id="artifact-viewer-external" target="_blank" rel="noreferrer">Open in new tab</a>
```

- [ ] **Step 5: Run structural tests**

Run: `npm test`

Expected: PASS through `research-site static contract: OK`.

- [ ] **Step 6: Commit semantic markup and claims**

```bash
git add index.html scripts/check-site.mjs
git commit -m "Present four AutoDesign artifact formats"
```

---

### Task 3: Implement Lazy Tabs And The Full Artifact Viewer

**Files:**
- Create: `artifact-showcase.js`
- Modify: `app.js`
- Modify: `scripts/build-production.mjs`
- Modify: `scripts/check-site.mjs`
- Modify: `scripts/check-browser.mjs`

**Interfaces:**
- Produces: `bindArtifactShowcase({ root, page, navigatorObject }) -> () => void`.
- Consumes: the markup hooks from Task 2 and returns one cleanup function called during non-persisted `pagehide`.

- [ ] **Step 1: Add browser assertions for lazy behavior**

Extend `runDesktop` in `scripts/check-browser.mjs` to assert:

```js
assert.equal(await page.locator("[data-artifact-tab]").count(), 4);
assert.equal(await page.locator("#artifact-panel-poster").isVisible(), true);
assert.equal(await page.locator("#artifact-panel-video source").getAttribute("src"), null);
await page.locator("#artifact-tab-video").click();
await page.waitForFunction(() => document.querySelector("#artifact-panel-video source")?.src.endsWith("ddpm-conference-teaser.mp4"));
```

Open each trigger and verify that its full asset appears only inside `#artifact-viewer-stage`; close with `Escape`, assert the stage becomes empty, and assert focus returns to the trigger.

- [ ] **Step 2: Run the browser check and verify it fails**

Run: `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`

Expected: FAIL because the Poster tab and viewer do not exist.

- [ ] **Step 3: Move showcase behavior into a focused module**

Create `artifact-showcase.js` exporting:

```js
export function bindArtifactShowcase({
  root = document,
  page = window,
  navigatorObject = navigator,
} = {}) {
  // bind four-tab roving focus, teaser lifecycle, viewer, and cleanup
}
```

The module must:

- preserve ArrowLeft, ArrowRight, Home, and End tab navigation;
- load and play the teaser only for the visible Video panel when motion and data preferences allow it;
- create an `<img>` for Poster, sandboxed `<iframe>` for Slides/Web, or controlled `<video>` with a default English `<track>` for Video;
- trap focus inside the dialog;
- close on backdrop click, close button, or `cancel`/Escape;
- pause videos, blank iframe sources, clear the stage, and restore trigger focus on close;
- unregister every listener in the returned cleanup function.

- [ ] **Step 4: Integrate the module**

Import `bindArtifactShowcase` from `app.js`, replace `bindArtifactStudies()`, and invoke its cleanup during non-persisted `pagehide`. Add `artifact-showcase.js` to `runtimeFiles` in `scripts/build-production.mjs` and to source-module checks.

- [ ] **Step 5: Verify interaction behavior**

Run: `npm test && PLAYWRIGHT_CHANNEL=chrome npm run test:browser`

Expected: deterministic tests pass; desktop viewer lazy-load, cleanup, and focus restoration pass.

- [ ] **Step 6: Commit interaction behavior**

```bash
git add artifact-showcase.js app.js scripts
git commit -m "Add lazy full artifact viewer"
```

---

### Task 4: Polish The Four-Format Presentation And Complete Release QA

**Files:**
- Modify: `styles.css`
- Modify: `scripts/check-browser.mjs`
- Modify: `README.md`
- Delete: replaced files under `assets/studies/` only after `rg` proves they are unreferenced.

**Interfaces:**
- Consumes: final four-panel markup and viewer behavior.
- Produces: responsive visual treatment and release evidence.

- [ ] **Step 1: Add mobile and reduced-motion assertions**

Extend browser QA to verify no horizontal overflow at 430x932 and 320x667, the four tab labels remain readable, the viewer fills the mobile viewport, the DDPM teaser stays paused under reduced motion, and the full video includes a captions track.

- [ ] **Step 2: Implement the final styling**

Change `.artifact-tabs` to four equal columns on desktop and a horizontally scrollable stable-width control row on narrow screens. Add focused styles for:

```text
.artifact-study__stage--poster
.poster-specimen
.artifact-study__action
.artifact-viewer
.artifact-viewer__stage
.artifact-viewer__stage--poster
.artifact-viewer__stage--html
.artifact-viewer__stage--video
```

Keep the current green editorial palette, square geometry, 1px rules, serif headings, and mono metadata. Do not introduce nested cards, decorative gradients, or rounded text pills.

- [ ] **Step 3: Remove replaced SAM 2 study assets**

Run:

```bash
rg -n "SAM2-motion-explainer|video-poster|slide-01|slide-03|slide-05|webpage.webp" . --glob '!dist/**'
```

Expected: no runtime references. Remove only those six replaced assets, then run `npm test`.

- [ ] **Step 4: Document the showcase sources and release workflow**

Update `README.md` to identify LongCat-Next and DDPM as the selected specimens, document `AUTODESIGN_PROMO_ROOT` and `AUTODESIGN_POSTER_SOURCE`, and retain the distinction between validated poster output and exploratory formats.

- [ ] **Step 5: Run complete release verification**

Run:

```bash
npm test
npm run test:production
git diff --check
```

Expected: every command exits 0; browser console is clean; production contains the two standalone HTML files, poster, teaser, full DDPM video, and VTT captions.

- [ ] **Step 6: Perform visual review**

Serve the repository over loopback HTTP and inspect 1440x900, 768x1024, 430x932, and 320x667. Capture screenshots of all four selected tabs and the full viewer. Verify crop quality, typography, tab stability, modal focus, LongCat page scrolling, DDPM narration/captions, and that the Three.js opening remains unchanged.

- [ ] **Step 7: Commit, push, and validate CI**

```bash
git add README.md styles.css scripts assets artifacts index.html app.js artifact-showcase.js
git commit -m "Polish multimodal artifact showcase"
git push -u origin codex/promotional-artifacts
```

Open a pull request against `main`, require the `Validate and deploy` workflow to pass, merge, and verify `https://autodesign.designanything.ai/` plus representative artifact URLs return 200/206.
