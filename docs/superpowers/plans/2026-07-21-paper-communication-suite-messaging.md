# Paper Communication Suite Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AutoDesign research homepage clearly communicate that one paper can become a poster, slides, a research webpage, and a narrated conference video with synchronized subtitles while preserving the validated-versus-exploratory evidence boundary.

**Architecture:** Extend the existing Hero and Artifact Studies sections rather than adding a separate product-marketing section. Keep all messaging in semantic HTML, add one restrained workflow line styled within the current report visual system, and lock the copy and responsive behavior into the existing static and Playwright checks.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js contract checks, Playwright browser QA, Cloudflare Pages.

## Global Constraints

- Poster is the validated PosterHarness instantiation with autonomous optimization and human-guided refinement.
- Slides, Web, and Video remain exploratory meta-harness generalization studies.
- Video must visibly state generated narration and synchronized subtitles.
- Preserve the existing four artifact tabs and every viewer interaction.
- Do not add feature cards, decorative icons, or a product-style marketing section.
- Preserve square geometry, ruled metadata, serif display typography, and restrained green accents.

---

### Task 1: Lock the Research Messaging Contract

**Files:**
- Modify: `scripts/check-site.mjs`
- Modify: `scripts/check-browser.mjs`

**Interfaces:**
- Consumes: Existing `index.html` semantic section IDs and artifact tab selectors.
- Produces: Static copy requirements and responsive browser assertions used by the implementation and deployment checks.

- [ ] **Step 1: Add failing static copy checks**

Add required phrases to the `index.html` contract in `scripts/check-site.mjs`:

```js
for (const phrase of [
  "complete research communication suite",
  "Poster · Slides · Web · Narrated Video",
  "human-guided refinement",
  "Exploratory meta-harness generalization",
  "generated narration",
  "synchronized subtitles",
]) {
  expect(html.includes(phrase), `paper communication suite messaging missing: ${phrase}`);
}
```

- [ ] **Step 2: Add failing layout checks**

In `runDesktop`, assert that the new workflow line exists between the Artifact Studies heading and tabs. In `runMobile`, assert that it stays within the viewport and does not overflow:

```js
const suiteFlow = page.locator(".artifact-suite-flow");
await suiteFlow.waitFor({ state: "visible" });
const flowBounds = await suiteFlow.boundingBox();
assert.ok(flowBounds && flowBounds.width <= page.viewportSize().width,
  `artifact suite workflow overflows: ${JSON.stringify(flowBounds)}`);
```

- [ ] **Step 3: Run checks and verify they fail**

Run:

```bash
npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

Expected: static check fails because the suite copy is absent; browser check fails because `.artifact-suite-flow` does not exist.

### Task 2: Implement the Suite Narrative and Visual Hierarchy

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `scripts/check-site.mjs`
- Modify: `scripts/check-browser.mjs`

**Interfaces:**
- Consumes: `.hero-copy`, `.hero-dek`, `.artifact-studies__heading`, `.artifact-tabs`, and `.artifact-study__copy`.
- Produces: `.hero-suite`, `.artifact-suite-flow`, revised Artifact Studies heading, and evidence-aware artifact metadata.

- [ ] **Step 1: Add the Hero suite sentence**

Insert after `.hero-dek`:

```html
<p class="hero-suite">From one paper to a complete research communication suite: an editable poster, presentation slides, a research webpage, and a narrated conference video with synchronized subtitles.</p>
```

Style it as compact supporting evidence rather than a second headline:

```css
.hero-suite {
  max-width: 32rem;
  margin: -12px 0 28px;
  color: rgba(244, 247, 245, 0.62);
  font-family: var(--mono);
  font-size: 0.68rem;
  line-height: 1.55;
  text-transform: uppercase;
}
```

- [ ] **Step 2: Replace the Artifact Studies framing**

Use the approved copy:

```html
<p class="eyebrow">Paper communication suite / research generalization</p>
<h2 id="artifact-studies-title">One paper.<br>A complete communication suite.</h2>
<p>AutoDesign's validated PosterHarness produces source-grounded academic posters through autonomous optimization and human-guided refinement. We further study how the same meta-harness optimization framework generalizes to slides, research webpages, and narrated videos.</p>
<p class="artifact-suite-flow"><span>Paper</span><span aria-hidden="true">→</span><span>Poster · Slides · Web · Narrated Video</span></p>
```

Place `.artifact-suite-flow` after the heading grid and before `.artifact-tabs`.

- [ ] **Step 3: Refine artifact use cases and evidence status**

Update visible metadata without changing viewers:

```html
<!-- Poster -->
<dt>Use</dt><dd>Conference presentation</dd>
<dt>Status</dt><dd>Validated PosterHarness output</dd>

<!-- Slides -->
<dt>Use</dt><dd>Conference talk</dd>
<dt>Status</dt><dd>Exploratory meta-harness generalization</dd>

<!-- Web -->
<dt>Use</dt><dd>Research dissemination</dd>
<dt>Status</dt><dd>Exploratory meta-harness generalization</dd>

<!-- Video -->
<p>The DDPM conference video combines generated narration, synchronized subtitles, paper figures, and evaluation results in a timed visual sequence.</p>
<dt>Use</dt><dd>Narrated conference presentation</dd>
<dt>Status</dt><dd>Exploratory meta-harness generalization</dd>
```

- [ ] **Step 4: Style the workflow line responsively**

Add a ruled, unframed workflow label:

```css
.artifact-suite-flow {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 14px;
  align-items: center;
  margin: -38px 0 30px;
  padding: 12px 0;
  border-top: 1px solid #84968f;
  color: #0b4f44;
  font-family: var(--mono);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
}
```

At `max-width: 760px`, allow wrapping and remove the negative top margin:

```css
.artifact-suite-flow {
  flex-wrap: wrap;
  margin-top: -22px;
  line-height: 1.5;
}
```

- [ ] **Step 5: Run deterministic and browser checks**

Run:

```bash
npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
npm run test:production
```

Expected: all commands exit `0`; existing Poster, Slides, Web, and Video viewer checks remain green.

- [ ] **Step 6: Review desktop and mobile screenshots**

Capture `1440×900`, `1024×768` at 2x DPR, and `390×844` screenshots. Verify:

- Hero copy remains readable and the primary `AutoDesign` title dominates.
- The complete suite is visible without turning the Hero into a feature list.
- The workflow line fits without horizontal scrolling.
- Artifact heading and support paragraph do not overlap the decorative section number.
- Video visibly mentions narration and synchronized subtitles.

- [ ] **Step 7: Commit the implementation**

```bash
git add index.html styles.css scripts/check-site.mjs scripts/check-browser.mjs
git commit -m "Highlight the paper communication suite"
```

### Task 3: Deploy and Verify Production

**Files:**
- No source files beyond Tasks 1-2.

**Interfaces:**
- Consumes: Passing local and production-package checks.
- Produces: Merged GitHub PR and verified Cloudflare Pages deployment.

- [ ] **Step 1: Push and create a pull request**

```bash
git push -u origin codex/paper-communication-suite
gh pr create --base main --head codex/paper-communication-suite --title "Highlight the paper communication suite"
```

- [ ] **Step 2: Wait for CI and merge**

```bash
gh pr checks --watch --interval 10
gh pr merge --squash --delete-branch
```

Expected: `Validate site and deploy production` passes before merge.

- [ ] **Step 3: Verify the custom domain**

Use Playwright against `https://autodesign.designanything.ai/` and assert:

```js
await page.locator(".hero-suite").waitFor({ state: "visible" });
await page.locator(".artifact-suite-flow").waitFor({ state: "visible" });
assert.match(await page.locator("#artifact-panel-video").textContent(), /narration.*subtitles/i);
```

Capture final desktop and mobile screenshots and confirm no console or page errors.
