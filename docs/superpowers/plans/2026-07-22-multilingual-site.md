# Multilingual Research Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent English, Simplified Chinese, and Arabic language switching to the single-page AutoDesign research site.

**Architecture:** `locales.js` stores locale metadata and message catalogs; `i18n.js` resolves and applies locale state. Existing HTML receives stable translation keys, while dynamic renderers request localized copy from the same runtime. Arabic changes document direction but preserves LTR technical and directional surfaces.

**Tech Stack:** Static HTML, CSS, vanilla ES modules, Three.js, Node contract tests, Playwright browser tests.

## Global Constraints

- Keep one page and one implementation; do not copy HTML by language.
- Preserve AutoDesign terminology, model names, paper titles, metrics, and file formats in English.
- Do not replay or rebuild the Three.js scene on a language switch.
- Future locales must require only locale registration and a message catalog.

---

### Task 1: Define Locale Contracts

**Files:**
- Create: `locales.js`
- Create: `i18n.js`
- Modify: `scripts/check-site.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `SUPPORTED_LOCALES`, `normalizeLocale(value)`, `resolveLocale({ search, stored, languages })`, `t(key, params)`, `setLocale(locale)`, `initI18n()`.

- [ ] Add failing checks for three locale catalogs, fallback behavior, URL precedence, and protected terminology.
- [ ] Run `npm test` and confirm failure because the locale modules are absent.
- [ ] Implement locale metadata, catalogs, and pure locale-resolution helpers.
- [ ] Run `npm test` and confirm locale checks pass.

### Task 2: Localize Static and Dynamic Interfaces

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `artifact-showcase.js`
- Modify: `three-scene.js`

**Interfaces:**
- Consumes: `t`, `setLocale`, `initI18n`, and the `autodesign:localechange` event.
- Produces: translated static DOM, localized generated content, and the header language control.

- [ ] Add browser assertions for switching text, `lang`, `dir`, query state, and storage.
- [ ] Run the browser test and confirm it fails because no switcher exists.
- [ ] Annotate static DOM with translation keys and localize runtime-generated labels.
- [ ] Connect the switcher and refresh dynamic surfaces on locale changes.
- [ ] Run browser tests and fix only localization regressions.

### Task 3: Add RTL and Responsive Styling

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: `html[dir="rtl"]` and `.language-switcher` markup.
- Produces: stable desktop/mobile header controls and readable Arabic layout.

- [ ] Add browser overflow checks at 1440x1000 and 390x844 in Arabic.
- [ ] Add compact switcher styles, Chinese and Arabic font stacks, RTL text alignment, and explicit LTR technical surfaces.
- [ ] Verify no overlap, clipping, or horizontal overflow in every locale.

### Task 4: Build and Release Verification

**Files:**
- Modify: `scripts/check-browser.mjs`
- Modify: `scripts/check-production.mjs` only if the build manifest requires the new modules.

**Interfaces:**
- Produces: reproducible production evidence for localization and existing site behavior.

- [ ] Run `npm test`.
- [ ] Run `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`.
- [ ] Run `npm run test:production`.
- [ ] Inspect English, Chinese, and Arabic screenshots at desktop and mobile sizes.
- [ ] Commit, push, merge the PR, and verify the custom domain serves the new version.
