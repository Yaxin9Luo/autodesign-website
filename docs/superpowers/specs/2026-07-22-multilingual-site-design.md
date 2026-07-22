# Multilingual Research Site Design

## Goal

Add English, Simplified Chinese, and Arabic to the existing AutoDesign research site without duplicating pages or changing its research-first positioning.

## Architecture

The site remains one HTML document and one interaction layer. A small `i18n.js` runtime owns locale detection, translation lookup, URL and local-storage persistence, DOM translation, and the document `lang`/`dir` attributes. A separate `locales.js` language pack contains all translated copy, so a future language is added by registering one locale and one message object.

The locale priority is explicit `?lang=` URL state, then `localStorage`, then the browser language, then English. Switching language updates the page in place and writes both the URL and storage without replaying the Three.js introduction.

## Translation Boundary

Visible prose, navigation, controls, dialogs, status labels, accessibility labels, and generated interface copy are translated. AutoDesign, DesignAnything, MetaHarness, PosterHarness, AutoPosterBench, Designer, Optimizer Code Agent, Code Agent, model names, benchmark values, file formats, and paper titles remain in English. Small English labels rendered into the Three.js cards remain technical interface marks; the surrounding DOM labels are localized.

## Arabic Layout

Arabic sets `dir="rtl"` on the document and uses an Arabic-capable system font stack. Reading copy and section metadata align RTL. Data visualizations, model names, metrics, URLs, slide navigation, and the Three.js canvas keep their authored left-to-right direction so their meaning and controls do not reverse.

## Language Control

The header contains a compact segmented language control with `EN`, `中文`, and `العربية`. It remains available on desktop and mobile, exposes pressed state to assistive technology, and never obscures the existing DesignAnything action.

## Verification

- Unit/static checks cover locale normalization, priority, fallback, message completeness, terminology, and required markup.
- Browser checks switch among all three languages, verify persistence, verify Arabic RTL, and confirm no horizontal overflow at desktop and mobile widths.
- Existing intro, Three.js, artifact viewer, slide viewer, lifecycle, build, and production checks remain green.
- Desktop and mobile screenshots are inspected for English, Chinese, and Arabic.
