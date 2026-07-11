# Image Workspace Performance Design

## Goal

Reduce the initial JavaScript work on `/app/image` without changing its layout, generation controls, upload behavior, routes, or SEO metadata.

## Baseline

The production build reports `/app/image` at roughly 353 kB of first-load JavaScript. Closed library/auth modals and the expanded body of advanced settings are part of the eager dependency graph.

## Design

- Keep the image preview, engine selector, prompt, compact settings, reference inputs, generate action, and gallery immediately available.
- Load the image Library modal only when a Library/character picker is opened.
- Load the image authentication gate only when generation requests it.
- Keep the Advanced settings toggle visible and stable, but load its form fields only after expansion.
- Preserve modal copy, supported formats, selected references, return targets, advanced values, and handlers exactly.

## Guardrails

- No route, metadata, canonical, sitemap, or localization changes.
- No generation, pricing, persistence, query hydration, or upload contract changes.
- No visual redesign or new loading placeholder in the first viewport.
- Add an architecture contract that prevents interaction-only image modules from becoming eager imports again.
- Compare the production build metrics before and after implementation.
