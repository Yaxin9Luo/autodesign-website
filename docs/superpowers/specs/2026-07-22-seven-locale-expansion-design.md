# Seven-Locale Expansion Design

## Goal

Extend the existing single-page AutoDesign research site from three to ten
languages without duplicating pages or weakening the site's research framing.
The new locales are Korean, Japanese, Spanish, French, German, Russian, and
Italian.

## Locale Order

The language menu uses this fixed order:

1. English (`en`)
2. Simplified Chinese (`zh-CN`)
3. Korean (`ko`)
4. Arabic (`ar`)
5. Japanese (`ja`)
6. Spanish (`es`)
7. French (`fr`)
8. German (`de`)
9. Russian (`ru`)
10. Italian (`it`)

This order is shared by the runtime metadata, menu, tests, and browser-language
resolution.

## Language Control

Replace the three-button segmented control with one compact button showing the
active language and a chevron. Clicking it opens a menu containing all ten
languages. Selecting an item updates the page immediately and closes the menu.

The menu must:

- work with pointer, keyboard, Escape, and outside-click dismissal;
- expose the active locale with `aria-current`;
- remain inside the viewport on desktop and mobile;
- preserve the existing `?lang=` URL behavior and `autodesign.locale` storage;
- use the native language name for every option.

## Translation Boundary

Translate navigation, the high-level research narrative, controls,
accessibility labels, artifact-viewer text, and metadata.

Keep established technical names in English where translation would make the
research taxonomy less precise, including AutoDesign, PosterHarness,
Meta-Harness, AutoPosterBench, Designer, Optimizer Code Agent, model names,
metrics, file formats, and benchmark identifiers.

Dense professional records under the research record, metric details,
optimization-state details, and harness-stage details remain in English. Their
surrounding headings and controls are localized, preserving readability without
weakening the project's technical vocabulary.

Each locale catalog must contain every English message key. Interpolated values
such as poster titles, counts, and system names must remain intact.

## Direction and Typography

Arabic remains the only RTL locale. All seven new locales are LTR. Japanese and
Korean receive system-font stacks suitable for CJK text; European and Russian
locales use the existing Latin UI typography with appropriate system fallbacks.
Technical diagrams and ordered process flows remain LTR in every locale.

## Runtime Behavior

Locale precedence remains:

1. `?lang=` query parameter;
2. persisted user choice;
3. browser language preferences;
4. English fallback.

Regional browser tags normalize to their supported base locale, for example
`ko-KR` to `ko`, `ja-JP` to `ja`, and `es-MX` to `es`.

## Verification

- Locale tests verify order, metadata, key parity, normalization, fallback,
  translated high-level copy, and the English professional-detail boundary.
- Browser tests open the compact menu, switch locales, verify persistence, and
  dismiss it with Escape and outside click.
- Desktop and mobile checks cover long German/Russian labels, Japanese/Korean
  typography, Arabic RTL, horizontal overflow, and menu bounds.
- Existing artifact viewers, Three.js draw-call checks, reduced-motion checks,
  fallback rendering, and Cloudflare production-host checks must continue to
  pass.
- Production verification confirms representative translated copy and WebGL
  rendering on the public domain.

## Scope

This change does not create separate localized routes, translate research
assets embedded inside images or videos, alter paper claims, or add a content
management system.
