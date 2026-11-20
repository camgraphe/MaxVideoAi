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

## Existing-model migrations

Seedance 2.5 and FLUX 3 Max opt into the same renderer. Their optional `highlights`
and `specialty` fields explain actual model differences (native Draft/final versus
timed keyframes); they do not enable composer capabilities. The original SEO metadata,
localized URLs, technical details, useful prompt recipes and comparison links remain
owned by the existing route/content helpers.

The opening visual owns its prompt drawer: `ModelCinematicHero` renders the compact
`ModelCinematicOverview` trigger on the image, never in the specification table.
The original prompt, provenance and reuse actions remain server-rendered in the
closed dialog. Additional prompt recipes live inside the prompt-writing disclosure,
clearly labelled as prompts to adapt; exact public-example links stay with their recipe.

- `model-cinematic-public-proofs.json` records selected **already-public** jobs,
  exact prompts, original video URLs, measured dimensions/audio and immutable posters.
  A new bundle is explicit in `model-page-cinematic-media.ts`; there is no fallback
  to Flash or another family member. Public-job reuse uses `from=<jobId>` and the
  existing shared-video/settings reader, not a newly authored preset or a submitted
  prompt in the URL. This is an alternative to preset registration for existing jobs.
- `ModelCinematicSpecialty.tsx` accepts the existing validated keyframe-demo view
  model. It preserves reference order, indices, public ownership checks and reuse
  destinations. Without a validated result it renders only an explanatory setup.
- Native Draft uses `ModelCinematicDraftWorkflow.client.tsx`: a compact image path,
  illustrative 1080p/4K selector and localized Create → Library → finalization steps.
  `model-draft-workflow-illustration.json` records the exact model, three immutable
  ImageGen camera-angle illustrations and the initial selection. Localized angle IDs
  must match the manifest. Selecting an angle updates the final preview with that exact
  frame; only the selected frame repeats. The caption identifies ImageGen illustrations,
  never actual Seedance outputs or a measured quality comparison.
  No blur/sharpening, paid requests, video downloads or VideoObject evidence are
  attached to the selector. Keep the explanatory source and inherited-setting facts
  in server-rendered HTML. Illustrations are not gallery jobs. A real quality comparison requires
  a verified native Draft/final lineage and measured original outputs first.
- `model-cinematic-workspace-previews.json` records locale-specific desktop/mobile
  captures of the **real Create components**, with illustrative settings. Recreate
  them with `pnpm exec tsx --tsconfig frontend/tsconfig.json
  scripts/capture-model-workspace-previews.ts`. This local fixture never submits a
  generation or requests a price. Static responsive images avoid mounting the
  authenticated composer on a marketing route; the facts remain readable HTML.
- Optional `specsReviewedAt` is an explicit editorial verification date, displayed
  with the canonical source and carried through HTML/Markdown/CSV exports. Update
  it when verifying model settings; it is not a live price timestamp.
- Public jobs already used as dedicated proofs (including the selected keyframe
  result) are omitted from the compact gallery rail, without altering playlist
  membership or the full examples page.
- Database-free local review can capture a public video's strict `keyframeRecipe`
  alongside the anonymous examples snapshot. It must match the card's job, model,
  prompt and duration. Production continues to use the original database reader
  and public-visibility validator; the snapshot remains development-only.

Additional contracts: `model-cinematic-migration.test.ts`,
`model-keyframe-demo.test.ts`, `flux-3-max-prompting.test.ts` and
`model-decision-content-contract.test.ts`.

## Compact workflow coverage

An optional exact-locale `cinematic.capabilities` block explains all the modes a
model exposes, separately from its reviewed video proofs. Do not add an unproved
Modify/Extend film to `workflows.items` just to document a supported workflow.
`ModelCinematicCapabilities.client.tsx` renders every explanation in server HTML
and selects one panel at a time, with tab/arrow/Home/End keyboard navigation.
The block sits inside the Create proof section and replaces redundant specialty
note cards. Without an authored illustration it keeps the text-only workflow guide.

The optional `capabilities.items[].proof` adds a visual explanation: two references
and one scene, a full-frame reveal comparator, or an extendable filmstrip. Its copy
and prepared prompt live in each locale; media identities and immutable display
hashes live separately in `model-capability-illustrations.json`. The builder admits
only the manifest's model and matching workflow. Illustrations have explicit captions
and prompt-drawer provenance; they never become native model outputs or VideoObjects.
The complete uses and limits stay in SSR HTML inside a compact disclosure. Reference
labels sit beneath the images, and the comparator starts at 50%, with pointer and
native range-keyboard input. The filmstrip respects reduced motion.

`capability-create`, `capability-modify` and `capability-extend` are explicit Seedance
2.5 recipes in the shared video preset lookup. Reuse and Milo keep the exact model,
locale and workflow, require the visitor's own references, and never import a mockup
asset, invent recorded settings, submit a prompt or start a paid render. Replacing
these illustrations with real films must use the existing reviewed public proof and
manual comparison-player owners; do not relabel the stills or borrow Flash results.

`_lib/model-page-capabilities.ts` validates each action against the actual engine's
modes and constructs locale-preserving Create links. A cross-model action must name
its destination. Seedance 2.5 documents Create (text, images and multimodal), Modify
and Extend; FLUX 3 Max documents text, opening image, first/last frames and keyframes.
Max's extension/editing links explicitly target FLUX 3 and Seedance 2.5 respectively;
they must never imply those modes exist in Max. These examples explain uses and
limits, not additional rendered proof or new provider capabilities.

The pricing harness executes both the legacy commercial boundary and the cinematic
page/details composition. It checks the visible formatted offer, scenario repricing
and JSON-LD together; a renderer migration must not remove that parity coverage.

### Optional opening motion

A cinematic video model gets background playback when its named hero asset has a reviewed clip. Image models and video heroes awaiting their own film retain the poster. `ModelCinematicHeroMotion.client.tsx` consumes the exact
hero clip and the shared `usePublicVideoPlayback` rendition/fallback owner. The
existing responsive, priority poster stays in SSR; no video element or source is
mounted before playback intent. Desktop autoplay waits for confirmed visibility,
page load and a short defer, and remains muted/looping. Mobile, reduced motion,
Save-Data and crawlers retain the still until explicit Play. Hidden/offscreen playback
pauses, and explicit user pause survives visibility changes. The two small controls
leave the hero text and its existing mask intact. Future opt-ins require source review
and real loading checks; this local design trial does not establish production CWV.

## Closing a cinematic video page

Use the Seedance 2.5 and FLUX 3 Max closing layout for new video model pages.
Set `cinematic.alternatives` in each locale with a section title and up to three
published video model slugs. Give each choice a reason tied to a different
visitor need. Register a still from that exact model in `model-page-cinematic-discovery.ts`.
The shared section displays the current model’s pricing and Create action,
then illustrated choices, published comparisons and directory links. The
existing FAQ follows. Keep model prices in the pricing projection and supply the
model-specific pricing anchor through the localized decision copy. The model’s
benchmark review belongs next to its specifications.

For FLUX 3 Max, the opening-image and first/last-frame panels use the actual
submitted image files alongside a manual player. Each result has its own
poster, measured dimensions and submitted prompt. The model page applies its
temporary timed-keyframe publication hold in `model-page-flux-release.ts`.
App modes and the prepared observatory storyboard keep their source data.

## Kling 4.0 and Kling Image 4.0

- The video page uses the owned concert and tram films from the accepted
  Kling V4 launch pack. The original watch pages and Range responses were
  checked on 20 November 2026. Both originals are 1280 × 720 H.264 SDR with
  AAC audio. The 4K SDR publishing settings describe app capabilities. The
  two filmed examples retain their recorded 720p settings and exact prompts.
  Opening motion is manually triggered for the concert. The tram film uses
  the shared manual player with `preload="none"`.
- The compact capability guide covers text, opening image, mixed references
  and source-video edit. Optional Prompt Guide and Specifications visuals
  may be omitted when the available reviewed clips already have a placement.
  Prompt instructions and specifications still render as HTML.
- Kling Image 4.0 uses its own five editorial ImageGen illustrations. The
  source and display checksums and exact prompts are in
  `frontend/config/model-kling-image-4-illustrations.json`. The page captions
  identify the illustration source and link to fal's actual Kling Image 4.0
  examples. Reuse opens a prompt-only 2K still recipe on the correct image
  model with no image reference attached. The user can configure image
  references and ordered Image Sets in Create.
- The public prices on both pages use the shared current quote and offer
  owners. Video scenarios specify three 5-second text-to-video settings.
  Image scenarios specify a single still at 2K, 4K or 8K. Image Set totals
  come from the actual count in Create.
