# Dashboard Route Guide

This route is a signed-in app surface. Prefer client ergonomics and stable UI behavior over SEO concerns.

## Responsibilities

- `page.tsx`: compose dashboard sections and client-side state wiring.
- `_components`: dashboard panels, cards, lists, and presentational UI.
- `_lib`: route-local copy, formatting, media defaults, and browser storage helpers.

## Rules

- Keep browser storage access isolated in `_lib` helpers.
- Keep panels self-contained and pass narrow props.
- Do not move dashboard-only UI into shared components unless another route needs it.
- Use the existing SWR setup for server data. Introduce global UI state only when several independent dashboard/workspace surfaces need the same state.
- Preserve loading, empty, error, and unauthenticated states when extracting UI.

## Checks

Verify the signed-in dashboard route after changes:

```txt
/dashboard
```
