# Seven-Locale Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Korean, Japanese, Spanish, French, German, Russian, and Italian to the single-page AutoDesign research site through a compact, accessible language menu.

**Architecture:** `locales.js` remains the canonical locale registry and catalog source, while `i18n.js` continues to resolve and apply locales. A focused `language-menu.js` module owns menu disclosure, selection, dismissal, and keyboard behavior. Existing dynamic renderers continue to consume `t()` and receive locale-change events.

**Tech Stack:** Static ES modules, semantic HTML, CSS, Node.js contract tests, Playwright browser QA, Cloudflare Pages.

## Global Constraints

- Locale order is `en`, `zh-CN`, `ko`, `ar`, `ja`, `es`, `fr`, `de`, `ru`, `it`.
- Arabic is RTL; every other locale is LTR.
- Keep AutoDesign, PosterHarness, Meta-Harness, AutoPosterBench, Designer, Optimizer Code Agent, model names, metrics, formats, and benchmark identifiers in English.
- Keep dense research-record, metric, optimization-state, and harness-stage details in English as professional content; localize their surrounding headings and controls.
- Preserve `?lang=` precedence, persisted choice, browser-language detection, and English fallback.
- Do not translate text embedded inside image, slide, poster, or video assets.

---

### Task 1: Locale Contract

**Files:**
- Modify: `scripts/check-i18n.mjs`
- Modify: `locales.js`
- Modify: `i18n.js`

**Interfaces:**
- Produces: `SUPPORTED_LOCALES`, `LOCALES`, and `MESSAGES` entries for ten locales.
- Produces: `normalizeLocale(value: string): string | null` support for regional tags.

- [ ] Add failing assertions for the ten-locale order, LTR/RTL metadata, regional normalization, catalog parity, native labels, interpolation, and preserved technical terms.
- [ ] Run `node scripts/check-i18n.mjs` and verify failure reports missing locales.
- [ ] Add the seven locale definitions and translated catalogs while preserving the full English key surface.
- [ ] Extend `normalizeLocale()` for `ko`, `ja`, `es`, `fr`, `de`, `ru`, and `it` regional variants.
- [ ] Run `node scripts/check-i18n.mjs` and verify it passes.

### Task 2: Compact Language Menu

**Files:**
- Create: `language-menu.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `scripts/build-production.mjs`
- Modify: `scripts/check-production.mjs`
- Modify: `scripts/check-site.mjs`

**Interfaces:**
- Consumes: `LOCALES`, `SUPPORTED_LOCALES`, `getLocale()`, and `setLocale()`.
- Produces: `bindLanguageMenu()` returning a cleanup function.

- [ ] Add static-contract failures requiring one trigger, ten ordered options, and the new runtime module in the production package.
- [ ] Run `npm test` and verify failure reports missing compact-menu markup or runtime.
- [ ] Replace the segmented buttons with a trigger and menu using `aria-haspopup`, `aria-expanded`, `role="menu"`, and `role="menuitemradio"`.
- [ ] Implement click selection, ArrowUp/ArrowDown/Home/End navigation, Escape dismissal, outside-click dismissal, focus return, active-label synchronization, and locale-change synchronization.
- [ ] Add responsive menu styling and CJK/system font stacks without changing the site's visual language.
- [ ] Run `npm test` and verify static and locale contracts pass.

### Task 3: Browser Behavior and Responsive QA

**Files:**
- Modify: `scripts/check-browser.mjs`

**Interfaces:**
- Verifies the public behavior of the locale runtime and compact menu.

- [ ] Add browser assertions for opening the menu, ordered options, Korean selection, persistence after reload, Arabic RTL, keyboard navigation, Escape, outside click, and representative translated dynamic content.
- [ ] Add 390x844 checks for menu bounds and German/Russian label fit.
- [ ] Run `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` and verify the new checks fail before menu behavior is complete.
- [ ] Complete any minimal menu or CSS fixes required by the failing browser checks.
- [ ] Re-run the browser suite and verify WebGL, artifact viewers, fallback, reduced-motion, and mobile checks all pass.

### Task 4: Production and Release

**Files:**
- Modify: `package.json` only if a test command needs wiring.
- Modify: cache-version references in `index.html`, `app.js`, `artifact-showcase.js`, `three-scene.js`, and `scripts/check-site.mjs`.

**Interfaces:**
- Produces: deployable `dist/` containing every runtime module and locale.

- [ ] Run `npm test`, `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, `npm run test:production`, and `git diff --check`.
- [ ] Inspect desktop and mobile screenshots for Korean, Japanese, German, Russian, and Arabic; verify nonblank Three.js pixels and no overlap.
- [ ] Commit and push `codex/add-seven-locales`, create a PR, wait for CI, and merge to `main`.
- [ ] Wait for Cloudflare Pages and verify representative `?lang=` URLs, translated copy, locale metadata, WebGL draw calls, overflow, and console errors on the production domain.
