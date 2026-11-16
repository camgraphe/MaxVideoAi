# Cinematic model pages

The image and video compositions are opt-in presentations of the existing model
detail route. They do not own model publication, pricing, provider capabilities or
gallery membership. The pilots are Seedream 5.5 and Seedance 2.5 Flash.

## Ownership

- `content/models/{en,fr,es}/{slug}.json`: exact-locale `cinematic`,
  `examples.cinematic` and `prompting` copy. An absent opt-in keeps the legacy page;
  a malformed opt-in fails validation instead of borrowing another locale/model.
- Model route `_lib/model-page-cinematic-content.ts`: content schemas.
- `_lib/model-page-cinematic-data.ts`: validated presentation, asset attribution,
  unique media placement, prompt-guide/details proofs and localized actions.
- `_lib/model-page-editorial-images.ts`: reviewed image-model originals, display
  copies and source/edit relationships. Add new models through their own authored
  asset owner, not through a Seedream identity alias.
- `_lib/model-page-cinematic-media.ts`: explicit video-model media registration.
  Each bundle owns its Create film, optional Modify pair, optional motion focus,
  illustrated boards and prompt-guide/specification films. Unknown models have no
  fallback. Start-frame image attribution remains separate from the video model.
- `frontend/lib/image/editorial-presets.ts` and
  `frontend/lib/video/editorial-presets.ts`: public recipe lookup shared with Create.
  Register new recipes explicitly; components use example IDs, not copied prompts
  in URL parameters. Reuse/Milo entry never submits or spends automatically.
- `_lib/model-page-cinematic-gallery.ts`: enriches selected gallery cards only;
  forwards the current locale to Create/Milo. Public playlist readers still own
  membership. An empty managed playlist must never be filled by a media registry.
- `_lib/model-page-cinematic-specs.ts`: displayed and exported spec rows from the
  existing runtime projections. Commercial schema/price helpers remain shared with
  legacy pages. Unavailable customer prices are not replaced by provider costs.

## Adding another model

1. Follow `model-registry.md` and verify the model's actual composer/provider
   capabilities. Do not infer Modify, Extend, transparency or references from the
   template. Video content accepts one to three unique workflows; each offered
   workflow must have one matching visible proof panel. Hero navigation adapts to
   that count without changing the pilot's three-card layout.
2. Supply all three locales. Retain useful definitions, limits, FAQ, comparisons
   and prompting advice. Keep the primary actions on MaxVideoAI and provider
   citations factual. Do not claim example selections are controlled benchmarks.
3. Register reviewed model-owned media and its original/display provenance. Hero
   derivatives use `model-cinematic-hero-displays.json` and its preparation script.
   Retain unique visual placements; a comparison may reuse its exact source chain.
   Mark illustrations as illustrations, not successful generated video proofs.
4. Register every displayed recipe with the relevant shared preset helper. Preserve
   exact prompts. Attach output settings only when recorded; explain required user
   references for planned workflows. Preserve login/draft restoration precedence.
5. Populate the existing public curation through the authorized native import and
   review flow. A private library upload or a development snapshot is not a public
   watch page. Follow `media-delivery.md` for original/poster/preview ownership.
6. Verify desktop and mobile anchors, drawer keyboard/focus behavior, copy and
   export, reuse/Milo model and language, canonical/hreflang/JSON-LD, image alt text,
   pricing parity and legacy isolation. Compare initial loading and real first Play;
   below-fold manual readers retain `preload="none"`, fixed geometry and posters.

Relevant contracts: `model-page-cinematic.test.ts`,
`model-cinematic-media-architecture.test.ts`, `model-cinematic-spec-exports.test.ts`,
`video-editorial-presets.test.ts`, `image-editorial-presets.test.ts`,
`model-examples-view-model.test.ts`, `model-page-template-registry.test.ts`, and
`local-public-examples.test.ts`. Run release CI on the reconciled combined commit,
not only these focused checks. This template is reusable, not automatic model
onboarding: each model still needs truthful content, media and recipe registration.
