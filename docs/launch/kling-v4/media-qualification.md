# Kling V4 — qualification and owned-media publication

Prepared 2026-10-22. This is the execution procedure for a later authorized batch. No paid attempt, render, upload or public playlist edit has been performed. The ten scenarios in `films.json` are unrendered creative proposals; `films.md` explains them in French.

## Before a render

For the initial fal-first integration, establish fal V4 account access and certify the actual four-mode create/status/result path. Direct Kling entitlement and its exact create/poll/callback contract remain separate later work. Neither an HTTP200 public schema nor a working legacy account query proves V4 execution permission. Qualify each provider independently; do not send V3-shaped requests to an inferred V4 route.

Use the existing Camgraph admin generation/library workflow once the actual App, Studio or MCP controls are certified. Bind each reference to its owned asset identity and exact original. Validate dimensions, bytes, duration and FPS from server-resolved metadata. The 30-second video-reference budget includes element videos; the provider's mixed fifteen-asset counting and fractional source billing still need confirmation. Per-element voices need provider-specific provenance and ownership; a fal voice ID is not automatically portable to Kling direct.

Record the exact prompt or shot plan, model/mode, references in authored order, duration/resolution, provider and immutable quote. Obtain the user's approval of the actual bounded quote before the first paid attempt. Existing FLUX spending approvals do not cover Kling V4. A retry or fallback must preserve the quoted request and obey its authorized attempt/spend limits.

## Qualification matrix

| Mode | Evidence required |
| --- | --- |
| Text to video | Prompt-only and actual multishot scenes, 720p/1080p, valid total duration, framing and native audio checked in the entire result |
| Image to video | Owned start image and optional end image, composition/identity continuity, geometry inherited correctly from frames |
| References to video | Ordered images, optional start, reference videos and elements; seven-subject and max-three voiced/video-element boundaries; cross-shot identity and reference influence inspected |
| Edit | Exact owned source, image references/elements, explicit and inherited duration behavior, source-audio/edit semantics and measured billable duration |
| Provider recovery | Known non-acceptance, accepted job followed by persistence error, timeout/missing task ID, poll/callback replay, failure/refund and fallback portability |

Fault/replay cases should use deterministic fixtures first. Never create a second paid task merely to test whether an ambiguously accepted first task exists. Preserve provider task identity and the existing attempt/ledger owner. Direct-first routing must remain unavailable until these cases and the verified direct transport are implemented; the branch's conservative fallback predicate alone is not that integration.

## Accepting and delivering media

Inspect every complete output with audio, not just its poster. Record actual duration, dimensions, bytes, codec, audio and provider job evidence; mark incoherent outputs rejected/private. Criterion scores must cite the evaluated clips and method, distinguish vendor claims from observations and disclose the sample size. Do not infer scores from the model name, publicity or another model's output.

Keep the canonical owned original in MaxVideoAI media storage and retain its generation/job/library ownership. Generate a representative image thumbnail and a short silent card preview through the established media pipeline. Verify projections in `app_jobs`, `job_outputs`, `media_assets` and any legacy `user_assets`; preserve the original URL for downloads, editing and schema.

Prefer the certified native generation and library workflow. The external-fal importer now has an explicit `kling-v4` adapter, separate from FLUX, for already accepted fal results. It does not generate, upload or charge. Use the exact engine/mode/endpoint, owner UUID, provider request ID, original journal/input, owned asset identities and hashes; never rename a Kling request into a FLUX manifest or bypass the owner with SQL. All four modes and ordered image/video/element mappings are supported. External per-element voices remain blocked until this importer can independently resolve owner-certified fal voice evidence; a raw voice ID cannot satisfy that gate. See [the import contract](../../engineering/external-fal-import.md#kling-v4-offline-preparation).

For Kling, the import manifest must bind `media.poster` and `media.preview` URL/SHA256 pairs matching the existing owned video's stored thumbnail and preview, with role URLs distinct from the original. The preview must be silent, at most six seconds and no longer than its original. Exact-byte checks, poster decode and local ffprobe checks supplement the complete human review; they do not establish creative quality or access. Reusable snapshots retain owned originals and authored shot/element order; immutable provenance retains the submitted provider input. FPS/audio controls remain absent when undocumented, rather than inheriting FLUX defaults.

For every accepted original, poster and short preview, verify durable owned URLs, public HTTP200 when publication is authorized, byte range206 for videos, measured file hashes and playable output. For hero/full-duration display derivatives, use `public-video-sources.json` and the documented rendition preparation, review, publication and activation flow. Run the public-rendition check. Do not overwrite immutable hash URLs or equate a short card preview with a full hero rendition.

## Marketing placement after approval

1. At least two accepted landscape videos are required by the V4 launch-asset gate. Each needs its owned original, poster, short preview, prompt/settings and exact V4 attribution. More creative scenes can be selected for the model hero, prompt demo and family gallery only after review.
2. Add accepted clips to the exact V4 model playlist and existing Kling family through the dedicated admin module. Snapshot the current owner order and preserve it; add new entries deliberately without replacing historical Kling clips, URL, canonical or core family copy.
3. Enroll only selected complete videos through the dedicated video-SEO admin workflow, with accurate English descriptions, localized page copy where supported, transcript/audio facts, visible prompt/settings and useful model/family links. Do not bulk index every render or emit VideoObject without playable owned media.
4. Create the real source manifest at `docs/model-launch/kling-v4-video-example-pack.json` only after evidence exists. Run `pnpm model:launch-assets:generate` and `pnpm model:launch-assets:check`. A fabricated manifest, public flag, fallback demo or empty playlist cannot satisfy readiness.
5. Verify model/family/home readers select the approved exact source, preserve responsive geometry and poster priority, lazy card previews and manual `preload=none`. Test first Play and actual network transfers; measure comparable Core Web Vitals when changing initial-loading media.

No production placement or indexing flip belongs to this preparation branch. Existing owner-curated Kling/FLUX playlists, historical SEO pages and the completed FLUX launch stay intact.

## Offline inventory and later admin placement handoff

The following commands are preparation entry points, not evidence that any real
Kling result exists. Do not create a result manifest until the accepted request,
owned upload and hashed journal actually exist. Fixture objects remain test-only.

```sh
# Fully offline; no env, provider GET, storage or DB connection.
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-external-fal-results.ts \
  --mode inventory --manifest /absolute/private/real-kling-result.json

# Later, after access and approved generation/upload: live GET and BEGIN READ ONLY.
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-external-fal-results.ts \
  --mode dry-run --manifest /absolute/private/real-kling-result.json \
  --journal /absolute/private/original-attempt.jsonl --env-file /absolute/explicit-target.env \
  --actor-user-id ADMIN_UUID --out /absolute/private/kling-dry-run.json
```

The offline inventory lists proposed destinations with `pending-review`, no current
curation and no verification claim. Preserve its exact owner/model/mode and all
role hashes. The live dry-run later checks admin precedence, media ownership,
provider identity/completion, immutable journal/results and actual bytes. Review
its database/plan fingerprints before any separately authorized adoption. Apply
still requires migration 76 and the matching deployed guard runtime. An import
failure never authorizes a second generation or wallet mutation.

For each accepted job, maintain a placement row in private review notes:
`jobId`, `outputId`, owner, exact model/mode, original/poster/preview URLs+hashes,
measured duration/dimensions/codec/audio/cadence, full-review verdict/evidence,
model/family selection, SEO selection and unresolved blockers. Until real media
exists, leave these rows absent rather than filling them with proposed films.

| Surface | Existing owner and read/preview handoff | Later controlled action |
| --- | --- | --- |
| Normal model page `/models/kling-v4` | `/admin/playlists`, destination `model:kling-v4`, exact collection `examples-kling-v4`. Inspect `GET /api/admin/playlists`, then the selected ID's `GET /api/admin/playlists/{id}/curation`. | Add only accepted V4 IDs. Keep the page private/noindex until the independent launch gates pass. Do not substitute V3/FLUX clips. |
| Existing Kling family `/examples/kling` | Same admin, destination `family:kling`, collection `family-kling`. Capture its complete `initialIds`, existing `snapshot.config.orderedIds`, featured/preferred selections and `snapshot.revision`, including any inherited feed state. | Preserve all existing IDs in their relative order and existing selections; insert selected V4 IDs only at explicitly reviewed positions. Family curation can aggregate historical feeds, so never replace it with a guessed list. |
| Selected video SEO `/video/{id}` | `/admin/video-seo`, existing candidate/editor/status workflow. Inspect each eligible accepted public original and its current SEO record. | Create/edit a draft only for selected complete clips; review accurate English title/description, supported localized copy, prompt/settings, transcript/audio facts and model/family links. Index only after the existing readiness checks pass. |

For both playlist surfaces, use the admin's preview before Save. The curation
owner checks the current revision and preview token; a revision conflict means
reread and rebuild the proposal, never force an old full-list overwrite. Snapshot
the displayed before/after order and exact featured/preferred choices in private
notes. Resolve a missing V4 destination through the normal admin preparation
owner without changing public registry gates; an unavailable destination remains
a blocker, not a reason to publish the model early. Do not create a new family,
rename collections, replace historical URLs/canonical/core family copy or change
legacy SEO records.

No generic SQL, import flag or launch manifest publishes these placements. Use
existing visibility/indexability controls and the dedicated video-SEO owner after
individual content approval. Confirm the final readers select the same accepted
original/poster/preview and preserve original downloads/schema. A short preview is
not a full-duration hero rendition. Only then assemble the real launch asset pack,
run launch/rendition checks and verify HTTP200/Range206, first Play and localized
page output. The two accepted landscape videos remain an unsatisfied prerequisite
until real results and reviews exist.

### Offline coverage and unavailable runtime evidence

Contract tests cover four-mode identity, shot sums, unsupported FLUX controls,
strict role URLs and ordered image/video/element mappings. Real local MP4/image
fixtures exercise hashes, poster decode, silent preview probing and provider
GET-only evidence. Disposable PostgreSQL 17 exercises FLUX and Kling import,
parallel replay, owner/admin rejection, changed-display conflict and zero
wallet/receipt/provider-attempt/timing writes. These tests establish importer
behavior only. Live fal entitlement, paid acceptance/completion, real owned
uploads, human content/voice review, durable HTTP/Range delivery, actual admin
inventory/order, public placements and SEO enrollment have not been performed.
