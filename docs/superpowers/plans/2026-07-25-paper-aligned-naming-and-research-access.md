# Paper-Aligned Naming and Research Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the public AutoDesign site with the latest paper terminology and evidence, and add a prominent, multilingual three-action research access area on the homepage.

**Architecture:** Keep `locales.js` as the single source of visible copy, retain `site-data.js` for runtime research data, and add the access controls as semantic hero markup styled by the existing site CSS. Use a disabled native button for the unpublished paper instead of inventing a URL. Bump the static module cache query consistently so returning visitors load the corrected terminology.

**Tech Stack:** Static HTML, CSS, ES modules, Three.js, Playwright CLI checks, Node assertion scripts, Cloudflare Pages through GitHub Actions.

## Global Constraints

- The website must use `DesignHarness` and `PosterBench` everywhere visible; it must not show `PosterHarness` or `AutoPosterBench`.
- Preserve the paper's evidence boundary: academic poster generation is the validated DesignHarness instantiation; slides, research webpages, and narrated video remain exploratory Meta-Harness generalization studies.
- Use only the current paper-backed public results: 100-paper PosterBench, 78.32 AutoDesign (Claude Code / Claude 4.8), 77.97 AutoDesign (Codex / GPT-5.5), 70.87 Claude Design, 69.45 OpenDesign, and the controlled attachment range +5.01 to +19.56 points.
- Add exactly three prominent hero actions: Open System (`https://designanything.ai`), View Code (disabled with a localized release-planned status until the private repository is public), and Read Paper (disabled, visible `Coming soon`, no fabricated URL).
- Professional terms remain in English across locale packs; surrounding UI labels are translated in all ten supported locales.
- Do not edit the Overleaf paper checkout or `/Users/yaxinluo/Desktop/AutoDesign`.
- Verify every modified behavior locally before pushing to `main`; do not claim deployment until the Cloudflare workflow succeeds.

---

### Task 1: Make terminology and evidence copy paper-aligned

**Files:**
- Modify: `locales.js`
- Modify: `site-data.js`
- Modify: `index.html`
- Modify: `scripts/check-i18n.mjs`
- Modify: `scripts/check-site.mjs`
- Modify: `scripts/check-browser.mjs`

**Interfaces:**
- Consumes: the current ten locale dictionaries, `window.AutoDesignSiteData`, and latest-paper terminology/results.
- Produces: no visible `PosterHarness`/`AutoPosterBench` terms, paper-consistent DesignHarness/PosterBench labels, and tests that reject stale terminology.

- [ ] **Step 1: Add failing terminology assertions**

Update the static and browser checks to require `DesignHarness` and `PosterBench`, and to reject `PosterHarness` and `AutoPosterBench` in rendered text.

- [ ] **Step 2: Run the static checks to verify the stale site fails**

Run: `npm test`

Expected: failure because current copy still contains the legacy terms.

- [ ] **Step 3: Replace visible terminology and retained data labels**

Update all ten locale dictionaries and visible static/data strings so poster-specific validated claims use `DesignHarness`, benchmark claims use `PosterBench`, and the existing paper-backed figures remain unchanged.

- [ ] **Step 4: Run terminology and locale checks**

Run: `npm test`

Expected: PASS with no missing locale keys and no legacy visible terminology.

- [ ] **Step 5: Commit the terminology task**

```bash
git add locales.js site-data.js index.html scripts/check-i18n.mjs scripts/check-site.mjs scripts/check-browser.mjs
git commit -m "fix: align website terminology with paper"
```

### Task 2: Add the three-action research access area

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `locales.js`
- Modify: `i18n.js`
- Modify: `language-menu.js`
- Modify: `app.js`
- Modify: `three-scene.js`
- Modify: `artifact-showcase.js`
- Modify: `scripts/check-site.mjs`
- Modify: `scripts/check-i18n.mjs`
- Modify: `scripts/check-browser.mjs`

**Interfaces:**
- Consumes: hero section markup, locale `data-i18n` bindings, and the site’s dark-scene/light-paper visual system.
- Produces: keyboard-accessible hero controls with a live system URL, a live public-code URL, and a disabled paper placeholder.

- [ ] **Step 1: Add failing access-area assertions**

Require a semantic `nav[aria-label]`/action group with exactly three controls, verified destination URLs, translated labels, and a non-focusable disabled paper control that never receives a fake `href`.

- [ ] **Step 2: Run the focused check to verify it fails before markup exists**

Run: `node scripts/check-site.mjs`

Expected: failure because the research access area is absent.

- [ ] **Step 3: Implement semantic markup, styling, and ten-locale labels**

Insert the access group below the hero’s system-entry link. Reuse the existing restrained system styling, use familiar text glyphs paired with labels, retain visible focus styles, and ensure the controls stack without clipping on mobile or RTL layouts. Replace the existing pending Research code resource with the same live GitHub URL so no public surface says the code is unreleased.

- [ ] **Step 4: Bump the import query versions**

Use `20260725b` for `styles.css`, `site-data.js`, `i18n.js`, `language-menu.js`, and `app.js` in `index.html`; for `locales.js` in `i18n.js`; for both `i18n.js` and `locales.js` in `language-menu.js`; for `three-scene.js`, `artifact-showcase.js`, and `i18n.js` in `app.js`; and for `i18n.js` in `three-scene.js` and `artifact-showcase.js`. Update all exact-version assertions in static and browser checks, including an assertion that `language-menu.js` imports versioned `i18n.js`.

- [ ] **Step 5: Run static and browser checks**

Run:

```bash
npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

Expected: PASS at desktop and mobile widths, including keyboard focus and all supported locale changes.

- [ ] **Step 6: Commit the access task**

```bash
git add index.html styles.css locales.js i18n.js language-menu.js app.js three-scene.js artifact-showcase.js scripts/check-site.mjs scripts/check-i18n.mjs scripts/check-browser.mjs
git commit -m "feat: add research access actions"
```

### Task 3: Review, package, and deploy

**Files:**
- Modify only if a review finds a concrete defect in Task 1 or Task 2.

**Interfaces:**
- Consumes: the complete local diff and the production branch’s existing GitHub Actions deployment workflow.
- Produces: reviewed, regression-checked production deployment.

- [ ] **Step 1: Run the complete local verification suite**

Run:

```bash
npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
npm run test:production
```

Expected: all checks pass; local production probe finds only current nomenclature and results.

- [ ] **Step 2: Capture desktop and mobile visual evidence**

Serve the website over loopback HTTP, use Playwright to capture the hero at 1440 x 900 and 390 x 844, and inspect that the actions read as a compact group, fit their containers, and preserve the Three.js scene framing.

- [ ] **Step 3: Perform final consistency review**

Review the full diff against the current paper terminology/results and confirm that paper, system, and code links have the required live/disabled states.

- [ ] **Step 4: Push to production**

```bash
git push origin main
```

- [ ] **Step 5: Verify the Cloudflare Pages deployment and live cache behavior**

Confirm the GitHub Actions Cloudflare deployment is successful, load the live site with a cache-busting query, and verify the three actions and current terms in English, Chinese, and Arabic.
