# Cinematic model templates and Flash gallery — local release preparation

Reviewed 2026-11-16. This is a local candidate review, not a production release.

## Delivered in this worktree

- Four new, unchanged Seedance 2.5 Flash outputs, each requested at 8 seconds / 720p with native ambience: The salt run and The rising sea in 16:9; Above the city and The glass garden in 9:16. All are cinematic sequences with three motivated shots, not UGC.
- Four video assets, four separately selected WebP poster assets and four short silent preview assets imported privately into the verified Camgraph account. No native app jobs, payment rows or public publications were fabricated.
- Gallery presentation uses the existing model-selected membership. One horizontal strip, natural frame proportions at equal height, no filters, no duplicated provider-documentation link. The centered plus on each poster opens the existing accessible prompt drawer. A separate discreet Play starts the full film inside its thumbnail, using the shared manual playback owner and preload="none"; captions retain native watch links.
- Drawers retain full original English prompts and Use this prompt / Copy video prompt / Refine with Milo. The four exact T2V recipes restore 8 s, 720p, aspect ratio and audio through the existing editorial handoff. No automatic generation, assistant submission or private reference import.
- Gallery presets enrich only already selected cards: an empty managed curation stays empty.
- Milo's request types once when the bar enters view. Full SSR text reserves its geometry. Reduced motion and no-JavaScript retain the complete static text.
- Existing model and family gallery readers supply the local model strip, /examples/seedance and watch pages. Review IDs are local-only, not production video identities.

## Evidence and limits

The contact sheets show the three-shot progression in all four outputs. Visual review used sampled frames; it does not certify perfect adherence to every requested detail or a human listening review of the sound. All four MP4 files contain audio streams. Native media: 1280×720 or 720×1280, 24 fps; video duration 8.041667 s, container duration 8.064 s. Originals were not retimed or re-encoded. Supplier LIST cost calculated from returned completion tokens totals USD 4.8636, within the USD 5.80 authorized reserve; this is not a customer retail quote or supplier invoice.

The private evidence directory is outside the repository:
`model-page-integration/gallery-cinema-20261116` under this chat's visualization directory. It contains the approved prompts, request hashes, immutable attempt receipts, journals, measured outputs, imports and `gallery-private-manifest.json`. Do not copy account IDs, provider execution records, source access URLs or cost records into public recipes.

`frontend/.local-review/public-examples.json` explicitly identifies its source as `local-generated-review`. It is gitignored and only readable in isolated development with `MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT=1`, no application database and no Vercel runtime. Production and Preview cannot activate that fallback. Local watch pages remain noindex. This review feed is not evidence that production playlists are populated.

## Two opt-in templates

Exactly Seedream 5.5 (image) and Seedance 2.5 Flash (video) opt in via top-level `cinematic` content in EN, FR and ES. Existing models keep the legacy layout. The shared route keeps metadata, registry identity, capability/pricing projections and native gallery selection. The cinematic renderer owns visual sections only.

For the next model, first follow model-registry policy, then supply exact-locale `cinematic`, `examples.cinematic` and prompt-guide content with reviewed, unique media. Extend the authored asset catalog with the new model's actual sources; do not point a new model at these pilot proofs. Do not enable the renderer globally. Keep public curation responsible for gallery membership, and qualify the model's own Create/Modify/Extend capabilities before offering those actions.

## Validation

- Focused suite: 78 tests passed for model layout/registry, curated gallery preservation, original proof media, recipe handoffs, example view models and local snapshot isolation.
- Additional existing focused suite: 46 tests passed for image presets, prompt prices, spec exports, clipboard, assistant, analytics and publication/content contracts.
- Frontend TypeScript passed. Frontend lint: zero errors; seven pre-existing warnings outside this scope.
- Exposure checks, registry projections, launch-asset projections and diff whitespace check passed.
- Browser check passed for all six localized pilot routes (canonical, hreflang, JSON-LD and semantic specs), three unchanged legacy model layouts, four prompt drawers, horizontal mobile scrolling and local watch noindex. Gallery controls are geometrically centered (0 px offset on both axes), first Play advances the actual original, and no MP4 is requested before interaction on the model page.
- Separate gallery-preview check confirms the family page selects a short preview and requests no full original incidentally. The four silent derivatives use existing server/video-preview.ts defaults (4 s, 480 px maximum, 12 fps, CRF 32), weigh 38–57 KB each, preserve aspect ratio and decode successfully. Originals remain unchanged.
- After the Play addition: 29 focused tests, TypeScript, targeted ESLint and diff check passed.
- Browser verification and screenshots are in `evidence/20261116-gallery/`; see the current JSON result rather than treating a screenshot as proof of interaction.
- Earlier Milo browser check passed at 1113 and 390 px, including one-time entry, stable height, reduced-motion and no-JS behavior.

## Remaining release gates

1. Integrate the explicit BytePlus-to-marketing import contract from the coordinated integration branch. Its four real dry-runs now passed without mutation; the versioned report was inspected in that worktree (`docs/model-launch/seedance-2-5-flash-marketing-adoption-20261116.json`). It records original/poster/preview ownership and hashes, plus the exact native poster normalization. Delivery commits are `b27c8aa60` and `23ef8a303`, alongside that branch's earlier provider corrections. These commits are not yet integrated here. A private MP4 upload alone still does not create a marketing publication. Never relabel these as Fal or as an already public export.
2. Review the exact import dry-run and fingerprint. Populate the private marketing library first, then apply reviewed visibility, model playlist/family ordering and watch-page editorial approval when publishing is authorized. Replace local review IDs with real returned publication identities.
3. Preserve the selected originals, separate posters and safe replay recipes. Qualify public HTTP HEAD/Range, first Play, poster-only initial loading, media ownership and public rendition policy before activation.
4. Reconcile the combined Seedream / Flash / page candidate with current main. At this check this worktree HEAD was `f6556ac33d8c604a62143bd3a5d2780cee9400d1`, 23 commits ahead and 18 behind fetched main, with the active design changes still uncommitted. This is not a merge-ready source snapshot.
5. Run required Quality CI on the final combined commit and the deployment/Preview parity gates from `docs/deployment/github-vercel.md`. Verify models, Create, Milo, Studio, prices, classic MCP, SEO routes, aliases and both production domains after the authorized Git deployment.
6. Leave the separate OpenAI Review runtime, submitted plugin package, manifests, schemas, OAuth and review branch unchanged through 5 December, per the user's instruction relayed by the integration chat. Its availability is not a site-launch gate. No resubmission or Review synchronization.

Local browser logs also include existing shared-header popover casing warnings and a 500 from /api/legal/cookies/version in the database-free review environment. These are not proof of a production failure; verify the endpoint on the actual Preview before release. The cinematic workflow list-key warning found during review was corrected.

No production merge, deployment, gallery publication or OpenAI Review change was performed here.

## Final template audit follow-up

See [the comparative audit](./cinematic-final-audit-20261116.md) for the current
verdict, fixes, GSC baseline and checks. The template now isolates registered video
media by model, removes pilot asset IDs from renderers, supports subsets of the
three workflows and preserves the locale in gallery recipe links. Future model
onboarding is documented in `docs/engineering/cinematic-model-pages.md`.
