# Model Registry Guide

`frontend/config/model-registry.json` is the only authored source for model identity, aliases, family, category, publication, replacement, and model-shaped tombstones.

The following files are generated projections and must not be edited directly:

- `frontend/config/model-runtime.json`
- `frontend/config/engine-catalog.json`
- `frontend/config/model-roster.json`
- `docs/model-roster.json`
- `docs/model-roster.csv`

## Add a model

1. Add the provider/execution definition with its canonical `id` only. Keep provider-specific IDs in the adapter or mode definition.
2. Add one registry entry with canonical slug, family, category, empty alias arrays, and every publication field set explicitly.
3. Add `content/models/{en,fr,es}/{slug}.json` before publishing the model page.
4. Run `pnpm model:registry:generate`, `pnpm engine:catalog`, and `pnpm model:generate:write` to refresh the generated projections.
5. Run `pnpm model:registry:check` and the focused model/page tests.

`pnpm model:setup -- --from <source-slug> --slug <target-slug> --name "<Marketing Name>" --family <family-id>` can scaffold the localized content, provider/execution stub, registry entry skeleton, and optional presentation-only family stub.

## Rename a public slug

Keep the old slug in `aliases.publicSlugs`, change `slug`, regenerate the projections, and verify the generated English, French, and Spanish 301 matrix. Never replace an old slug with a hand-authored redirect in Next.js config, middleware, or a route.

## Retire a model

Keep a canonical replacement ID in `replacement` when another model is the destination. Use a registry tombstone with `destination: "models-index"` only when the final destination is the localized catalogue. A tombstone is for a retired model-shaped URL, not a general redirect.

## Change publication

Change only the registry `publication` object. Do not add surface overrides to engine modules, family configs, pricing code, sitemap code, middleware, or route files. Regenerate projections and run `pnpm model:registry:check` so content and cross-surface invariants are validated.

## Provider identifiers

Provider IDs stay in provider adapters and mode definitions. Do not add them to registry aliases merely to make provider routing work. Registry `aliases.internal` are historical MaxVideoAI engine/app inputs; `aliases.publicSlugs` are historical public URL slugs, and the two namespaces may intentionally resolve the same token differently.

## Required commands

Run these commands after an authored registry change:

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
```

Commit the authored registry change and every refreshed generated projection together. If `pnpm model:registry:check` reports drift, regenerate instead of editing a projection by hand.
