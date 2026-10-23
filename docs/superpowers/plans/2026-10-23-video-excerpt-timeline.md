# Visual excerpt timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox syntax.

**Goal:** Replace disconnected sliders with a polished shared video timeline.

**Architecture:** Keep the existing selector contract and all prepared-media and quote owners. Add a shared visual timeline plus bounded optional browser frame capture, consumed by the selector.

**Tech Stack:** Existing React/TypeScript/CSS tokens/lucide/HTMLVideo/Canvas.

**Spec:** docs/superpowers/specs/2026-10-23-video-excerpt-timeline-design.md

## Global Constraints

- Work only in the existing isolated codex/marketing-media worktree; preserve unrelated files.
- No push, deployment, production mutation or paid render.
- No backend, model, upload, storage, pricing or owned-asset contract changes.
- Exact fractional whole-source identity and current model validation remain intact.
- EN/FR/ES, keyboard/touch, accessible modal and no source fetch before explicit preview intent.

## Review Focus

- Very short interval within a 60/180-second source: handles and precise editing remain usable on mobile.
- Fractional full range: reset and dragging to source end restore exact duration, never an unnecessary derivative.
- Failed/CORS-blocked filmstrip: time track/preview remain usable and capture is bounded/cleaned up.
- Source replacement/cancel: no stale capture, playback or callbacks escape the dialog session.
- Actual touch and keyboard: resize, move, scrub and zoom do not trap focus, page-scroll or cross endpoints.

### Task 1: Visual timeline, selector integration and demo

**Files:** Modify frontend/components/media/VideoExcerptSelector.client.tsx and frontend/lib/video-excerpt-copy.ts. Add frontend/components/media/VideoExcerptTimeline.client.tsx, a colocated bounded filmstrip hook and dedicated styles as appropriate. Update tests/video-excerpt-selector-dom.test.ts and tests/video-excerpt-browser.test.ts; add focused pure timeline/capture tests where needed. Update docs/engineering/media-delivery.md and docs/qa/video-excerpt-timeline-2026-10-23.md. Local demo/evidence under output/marketing-demo and output/video-excerpt-timeline only.

**Interfaces:** Preserve VideoExcerptSelectorProps, onApply({startSec,endSec}) and onCancel. Timeline consumes source duration, current range/time, disabled, localized labels and range/seek callbacks. Frame capture consumes preview URL plus explicit activation and yields bounded data/blob thumbnails or an empty usable fallback.

- [x] Write focused failing tests for single dual-handle track, pointer/touch/keyboard resizing and movement, seek/zoom, exact full reset, invalid current-model range, optional capture cancellation/failure and no eager network.
- [x] Implement coherent media stage/transport/timeline/compact numeric row/actions using existing tokens; never duplicate the old sliders visually. Preserve loop playback and all existing Apply/focus/price contracts.
- [x] Run affected selector/browser/workspace lifecycle/architecture tests, full frontend TypeScript and scoped lint, exposure and diff checks. Do not rerun unchanged backend/encoder/full fast suites.
- [x] Rebuild local demo and exercise real phone/minute at desktop and mobile, capture accepted screenshots, report exact verification and any fallback limitations; commit only scoped source/tests/docs.
