# Model Registry Guide

`frontend/config/model-registry.json` is the only authored source for model identity, optional authoritative marketing label, aliases, family, category, lifecycle, successor, publication, replacement, and model-shaped tombstones.

The following files are generated projections and must not be edited directly:

- `frontend/config/model-runtime.json`
- `frontend/config/engine-catalog.json`
- `frontend/config/model-roster.json`
- `docs/model-roster.json`
- `docs/model-roster.csv`

`pnpm model:registry:check` validates the authored registry and then compares every generated projection exactly: runtime JSON, engine catalog, frontend roster, docs roster JSON, and docs roster CSV. Check mode is read-only; it never regenerates files or changes timestamps.

The browser-safe runtime projection omits the replacement graph. A retired replacement identity contains only an optional flattened `publicTargetId` for the final active model; active models need no extra field and resolve to themselves. Public-slug resolution uses that flattened target so middleware can send `/fr/models/*` and `/es/models/*` compatibility paths directly to the localized active canonical slug. Engine/input aliases still resolve to their original canonical product ID.

Lifecycle successors are separate from retirement replacements. `legacy` and `deep_legacy` records may point directly to a same-category `current` model with `successorId`; generated projections derive `successorSlug` from that canonical target. A successor never changes engine-input ownership, public-slug resolution, redirects, or `publicTargetId`.

## Change lifecycle

- `current`: recommended by default.
- `legacy`: still executable and public according to its publication fields, but not recommended by default.
- `deep_legacy`: may keep its historical model page, examples, and comparison identity, but must disable app publication, pricing publication, and current-example membership.
- `retired`: fully unpublished and governed by the existing direct `replacement` contract.

Always author `successorId` explicitly, using `null` when there is no successor. Do not infer lifecycle from engine definitions or author `successorSlug`; the runtime, engine catalog, and rosters derive those fields from the registry.

## Add a model

1. Add the provider/execution definition with its canonical `id` only. Keep provider-specific IDs in the adapter or mode definition.
2. Add one registry entry with canonical slug, family, category, empty alias arrays, and every publication field set explicitly.
3. Add `content/models/{en,fr,es}/{slug}.json` before publishing the model page. Review all
   three strict top-level `decision` blocks before publication, including the localized copy and
   hrefs, and verify that every `decision.modelSlug` exactly matches the new canonical slug.
4. Run `pnpm model:registry:generate`, `pnpm engine:catalog`, and `pnpm model:generate:write` to refresh the generated projections.
5. Run `pnpm model:registry:check` and the focused model/page tests.

`pnpm model:setup -- --from <source-slug> --slug <target-slug> --name "<Marketing Name>" --family <family-id>` can scaffold the localized content, provider/execution stub, registry entry skeleton, and optional presentation-only family stub.
The scaffold retargets `decision.modelSlug`, but its generated English, French, and Spanish
decision content still requires the manual review in the checklist above before publication.

## Add a presentation-only model page

Use `presentationOnly: true` only for a factual public model identity whose
provider execution contract is not yet available. This is a route state, not a
hidden engine.

A presentation-only entry must:

- publish only the model page with `indexable: false`
- keep app, pricing, examples, comparison, and sitemap publication disabled
- have no ranks, variant labels, comparison relationships, replacement, or
  executable aliases
- stay absent from raw engine definitions and `engine-catalog.json`
- use a dedicated `prelaunch` template and localized content that contains no
  generation or pricing destination

The validator rejects any presentation-only entry that enables an executable
or discovery surface. Its public slug resolves for the canonical page, but it
is deliberately absent from engine-input resolution. Promote it only in the
same reviewed change that adds a factual raw engine and removes
`presentationOnly`; keep public execution surfaces disabled until their
separate launch gates pass.

## Rename a public slug

Keep the old slug in `aliases.publicSlugs`, change `slug`, regenerate the projections, and verify the generated English, French, and Spanish 301 matrix. Never replace an old slug with a hand-authored redirect in Next.js config, middleware, or a route.

## Retire a model

Set `replacement` to the canonical ID of the active destination model. A replacement entry is a retained URL identity, not a published model: turn off every publication surface, clear comparison relationships and publication ranks/variant labels, and keep its canonical slug plus all historical public aliases in the entry. The replacement target must be `current`, publish a model page, and cannot itself have a replacement. Chains, cycles, missing targets, and source collisions fail validation.

An engine-catalog row remains mandatory for every `current`, `legacy`, and
`deep_legacy` identity. Only a fully unpublished `retired` replacement may omit
that executable owner. In that state, author a non-empty marketing `label` in
the registry; repository validation rejects an engine-less retired identity
without it. The label stays optional for catalog-backed identities. Do not use
or loosen `presentationOnly` for retirement: that contract remains a public
noindex prelaunch route with no replacement.

The runtime projection carries the authoritative label together with the
canonical ID, slug, category, lifecycle, and flattened `publicTargetId`; it
does not recreate provider capabilities, endpoints, prices, or public URLs.

The Next.js redirect projection sends both the retired canonical slug and all of its historical public aliases directly to the replacement's canonical localized slug in English, French, and Spanish. The middleware applies the same flattened destination to wrong-English localized compatibility paths such as `/fr/models/*` and `/es/models/*`, including dotted historical aliases, while preserving the query string. Every generated rule is an explicit HTTP 301 and is one hop. Use a registry tombstone with `destination: "models-index"` only when the final destination is the localized catalogue. A tombstone is for a retired model-shaped URL, not a general redirect.

## Change publication

Change only the registry `publication` object. Do not add surface overrides to engine modules, family configs, pricing code, sitemap code, middleware, or route files. Regenerate projections and run `pnpm model:registry:check` so content and cross-surface invariants are validated.

`publication.model.published` controls whether the model route renders. `publication.model.indexable` controls robots metadata, and `publication.sitemap.published` controls sitemap inclusion. A published model may intentionally be noindex and absent from the sitemap; it must still render. An unpublished model returns the hidden/not-found route decision.

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
