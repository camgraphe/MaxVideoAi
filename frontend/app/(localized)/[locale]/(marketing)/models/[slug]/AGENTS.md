# Model Detail Route Guide

This route renders localized SEO pages for individual AI video models.

## Responsibilities

- `page.tsx`: route params, metadata/static params, redirects/not found, route-level data assembly.
- `_components`: section rendering only.
- `_lib`: route-local pure helpers for copy, specs, pricing, schema, media, and links.

## Rules

- Preserve localized paths for English, French, and Spanish.
- Preserve canonical, hreflang, metadata, and JSON-LD behavior.
- Make model identity, alias, family, category, publication, replacement, and tombstone changes only in `frontend/config/model-registry.json`; follow `docs/engineering/model-registry.md` and run `pnpm model:registry:check`.
- Treat `frontend/config/model-runtime.json`, `frontend/config/engine-catalog.json`, `frontend/config/model-roster.json`, and the roster files under `docs/` as generated projections; never edit them directly.
- Keep new model-page sections in `_components`.
- Keep route-only helper logic in `_lib`.
- Do not move helpers into shared `frontend/lib` unless another route actually reuses them.
- Keep safety, pricing, examples, and spec fallback copy localized when visible to users.
- Keep model-specific Prompt Lab editorial content only in `content/models/{locale}/{slug}.json#prompting`.
- Load Prompt Lab content through `getEngineLocalized`, validate it with `model-page-prompting-content.ts`, and derive runtime display state with `model-page-prompting-view-model.ts`.
- Never add English fallback, Prompt Lab fields under `custom`, model-slug copy branches, direct JSON imports, or workspace URL construction in Prompt Lab components.
- Keep generic Prompt Lab UI labels in `model-page-prompting-ui-copy.ts`; keep model-specific titles, prompts, notes, demos, and image examples in localized JSON.
- Keep the preserved Happy Horse/media-summary prompt-source compatibility rule isolated in `model-page-prompting-prompt-source.ts`; do not move model identity checks into the parser, pure view-model builder, or renderers.
- Keep model-specific Examples editorial copy only in `content/models/{locale}/{slug}.json#examples`.
- Load Examples from the exact requested locale. The parser, pure view-model builder, and renderers must not own model-specific editorial branches or an English fallback.
- Keep `examples.showWhenEmpty` explicit and structurally aligned across locales; final real/fallback items override an empty-state `false` value.
- Treat runtime gallery media, capability-derived presentation, link destinations, and poster selection as runtime policy, not localized editorial content.

## Checks

Smoke-test at least one representative model in each localized URL shape:

```txt
/models/seedance-2-0
/fr/modeles/seedance-2-0
/es/modelos/seedance-2-0
```
