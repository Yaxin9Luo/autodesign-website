# Promotional Artifact Showcase Design

## Goal

Replace the current exploratory Slides, Web, and Video specimens with the approved promotional artifacts while preserving the site's research-first narrative and first-load performance.

The selected artifacts are:

- Slides: LongCat-Next, 12-slide standalone HTML deck.
- Web: LongCat-Next, responsive standalone HTML landing page.
- Video: DDPM, six-minute 1920x1080 conference video with narration and English captions.

## Design Boundary

The generated artifacts remain evidence of AutoDesign's output. Refinement therefore applies to presentation, loading, cropping, and interaction. It does not rewrite paper claims or restyle the complete generated artifacts unless QA identifies a concrete rendering defect.

The existing Three.js opening, poster universe, Meta-Harness sections, benchmark evidence, and resource links remain unchanged.

## Homepage Experience

The existing `Slides / Web / Video` tabbed section remains the single multimodal showcase.

### Slides

The stage presents a composed filmstrip using the LongCat-Next cover, method, and results slides. It replaces the current SAM 2 images and states that the complete artifact contains 12 editable HTML slides. The primary action opens the complete deck.

### Web

The stage presents the LongCat-Next landing page inside a restrained browser frame. A curated long-page preview communicates depth without rendering the full embedded page during normal scrolling. The primary action opens the complete responsive page.

### Video

The stage uses a short muted DDPM teaser assembled from representative portions of the full conference video. The teaser loads only when the Video tab is active, the section is visible, reduced motion is disabled, and data-saving mode is not requested. The primary action opens the complete narrated video with native controls and English captions.

## Full Artifact Viewer

A shared full-screen dialog opens all three artifact types without navigating away from the AutoDesign site.

- Slides and Web lazily create sandboxed iframes only after activation.
- Video lazily loads the full MP4 and VTT caption track.
- The viewer provides a clear close control and an `Open in new tab` fallback.
- `Escape` closes the viewer, focus remains trapped while open, and focus returns to the invoking button.
- Closing the viewer pauses video and removes iframe content so hidden artifacts consume no runtime resources.
- On narrow screens the viewer fills the viewport without horizontal page overflow.

## Assets

Public assets use stable, descriptive paths:

```text
artifacts/slides/longcat-next/index.html
artifacts/web/longcat-next/index.html
assets/studies/longcat-next-slide-*.webp
assets/studies/longcat-next-web.webp
assets/studies/ddpm-conference-poster.webp
assets/studies/ddpm-conference-teaser.mp4
assets/studies/ddpm-conference-video-6min.mp4
assets/studies/ddpm-conference.en.vtt
```

Preview images are resized and transcoded for the homepage. The full standalone HTML files retain their embedded figures. The full MP4 remains H.264/AAC with `preload="metadata"`; the teaser is a separate web-optimized derivative. Replaced SAM 2 showcase assets are removed once no references remain.

## Copy And Claims

The section continues to distinguish the validated poster domain from exploratory cross-format demonstrations. Copy describes the artifacts as research specimens generated through the source-to-artifact workflow. It does not claim that slides, web, or video have undergone the same optimization or benchmark validation as PosterHarness.

## Verification

Automated checks cover:

- all new production assets and links;
- tab keyboard behavior and selected-panel state;
- lazy loading of iframes and the full video;
- dialog focus trap, `Escape`, focus restoration, and cleanup;
- video captions and reduced-motion behavior;
- production allowlist and file-size limits;
- desktop and mobile overflow;
- clean browser console and successful local asset responses.

Manual review covers:

- visual hierarchy and crop quality for all three homepage specimens;
- legibility of representative LongCat-Next slides;
- landing-page framing and full-page interaction;
- DDPM teaser rhythm, full-video playback, narration, and captions;
- continuity with the existing editorial and Three.js visual language.

## Acceptance Criteria

1. LongCat-Next is the only Slides and Web specimen shown in the section.
2. DDPM is the only Video specimen shown in the section.
3. Each homepage specimen has a polished lightweight preview and a working full-artifact action.
4. Full artifacts are not downloaded during initial page load.
5. The complete test and production deployment workflow passes before merging to `main`.
