# Model Detail Route Guide

This route renders localized SEO pages for individual AI video models.

## Responsibilities

- `page.tsx`: route params, metadata/static params, redirects/not found, route-level data assembly.
- `_components`: section rendering only.
- `_lib`: route-local pure helpers for copy, specs, pricing, schema, media, and links.

## Rules

- Preserve localized paths for English, French, and Spanish.
- Preserve canonical, hreflang, metadata, and JSON-LD behavior.
- Keep new model-page sections in `_components`.
- Keep route-only helper logic in `_lib`.
- Do not move helpers into shared `frontend/lib` unless another route actually reuses them.
- Keep safety, pricing, examples, and spec fallback copy localized when visible to users.

## Checks

Smoke-test at least one representative model in each localized URL shape:

```txt
/models/seedance-2-0
/fr/modeles/seedance-2-0
/es/modelos/seedance-2-0
```
