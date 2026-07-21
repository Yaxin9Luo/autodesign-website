# AutoDesign Research Site

This repository contains the standalone static site for `autodesign.designanything.ai`. It does not use the DesignAnything Workbench API or Python runtime.

The opening experience is the Artifact Engine: a scroll-driven Three.js scene that ingests source records, exposes the PosterHarness modules, assembles a real poster artifact, returns diagnostic evidence, and retains one accepted system update. The poster index and inspector remain semantic HTML, so the artifact path is usable when motion is reduced or WebGL is unavailable.

## Local Preview

Run from the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory .
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/).

Run the deterministic scene-state and static-contract checks before publishing:

```bash
npm test
npm run test:browser
```

The Three.js runtime and postprocessing modules are vendored under `vendor/three/`; the public site does not depend on a CDN. Browser verification should confirm that `canvas[data-scene]` reaches `running` or `static` with no console errors. Reduced-motion, save-data, narrow-screen, and WebGL-fallback paths intentionally remove or simplify continuous rendering.

Release QA covers `1440x900`, `1280x800`, `768x1024`, `430x932`, and `320x667`. At each size, verify the engine states, focused poster view, all four artifact tabs and viewer modes, evidence transition, horizontal overflow, local asset responses, and console output. Also exercise reduced motion, save-data, WebGL fallback, scene visibility pause/resume, both dialogs' keyboard focus, DDPM video narration/captions, and compact previous/next controls.

The browser smoke check covers the primary automated release paths. Manual release review should still cover:

1. Follow **System**, **Artifacts**, and **Evidence**; confirm `#optimization`, poster `01 / 08`, and `#evidence` respectively, with the full optimization copy and paper evidence header visible. After following **Artifacts** with the keyboard, continue tabbing through **Evidence** and **Open DesignAnything**; focus must reach the visible poster inspector/index without returning to the offscreen hero or changing the universe scene phase.
2. Select a non-default poster, open the inspector, and follow **Return to artifact index**; confirm the same poster remains selected. Confirm `Tab`, `Shift+Tab`, and `Escape` keep focus inside the dialog and restore it to **Inspect poster**.
3. With reduced motion enabled, scroll within one authored beat and confirm the canvas does not interpolate or idle-animate; select a poster and confirm that discrete state still updates.
4. Dispatch persisted `pagehide` then `pageshow` events in DevTools and confirm `canvas[data-scene]` remains `running` or `static`. A non-persisted unload should destroy the scene.
5. At a touch viewport, dispatch `pointermove` with `pointerType: "touch"`, then tap the active poster. Confirm no parallax response, the inspector opens, the document does not overflow horizontally, the console is clean, and the Network panel contains no `/api` request.

## Curated Assets

The checked-in assets are publication-ready derivatives of approved AutoDesign outputs. The showcase uses LongCat-Next for the poster, slide, and web specimens, and Denoising Diffusion Probabilistic Models (DDPM) for the conference-video specimen. The LongCat-Next poster is validated PosterHarness output; the slide deck, research page, and DDPM video remain exploratory generalization studies rather than validated product claims.

Source selection remains in the private AutoDesign development workspace. To regenerate the checked-in derivatives, set `AUTODESIGN_PROMO_ROOT` to the source bundle containing the standalone LongCat-Next slide/web exports and DDPM video/captions, and set `AUTODESIGN_POSTER_SOURCE` to the approved LongCat-Next poster image. The poster, slide HTML, web HTML and preview PNG, DDPM MP4, and captions are SHA-256 gated before any generated file is written:

```bash
AUTODESIGN_PROMO_ROOT=/absolute/path/to/promotion-sources \
AUTODESIGN_POSTER_SOURCE=/absolute/path/to/approved-longcat-next-poster.png \
node scripts/prepare-promotional-assets.mjs
```

The deployment repository retains only the generated files required by the public site.

## Production Deployment

Generate and verify the allowlisted production package under the ignored `dist/` directory:

```bash
npm test
npm run test:production
git diff --check
```

Pull requests run the deterministic and browser release checks without touching production. A successful push to `main` deploys the verified `dist/` package to the existing `autodesign` Cloudflare Pages project through GitHub Actions. The workflow reads `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` from repository Actions secrets.

For an emergency deployment from an authenticated local machine:

```bash
npm run deploy
```

Production is served at [https://autodesign.designanything.ai/](https://autodesign.designanything.ai/), with [https://autodesign.pages.dev/](https://autodesign.pages.dev/) retained as the Pages hostname. `_headers` carries the CSP, response hardening, and cache policy. Custom-domain and DNS configuration remain account-level Cloudflare state rather than repository files.
