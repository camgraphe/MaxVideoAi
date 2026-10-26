# Adopt a real external Fal result

The operator CLI is `frontend/scripts/import-external-fal-results.ts`. Its strict
manifest supports FLUX 3 Max through its canonical request builder and an explicit
Kling V4 adapter through the four-mode Kling validator. The engine discriminant
selects these separate contracts; renaming a Kling request as FLUX is rejected. It recovers an already accepted Fal
request and adopts an already owned durable Camgraph upload; it never submits a
provider generation, uploads media, creates a receipt or debits a wallet.

Use the infrastructure release in `external-fal-provenance.md` first. The
application's existing gallery, playlists, visibility and SEO rules remain the
publication owners. Import is private and non-indexable by default. Publishing
accepted media is part of the authorized editorial delivery, subject to the
repository's deployment and curation steps; this tool adds no separate content
approval step.

## Manifest and read-only verification

Keep manifests and reports in a private ignored local directory. A manifest binds
owner UUID, engine/mode, endpoint and real provider request ID, exact submitted
provider input, uploaded video public asset ID, original video SHA256, raw attempt
journal SHA256 and ordered reference URL/asset/digest mappings. Requested duration,
resolution and aspect belong to the creative settings. Measured dimensions,
container/video/audio duration and original bytes belong to media facts. Preserve
requested and resolved provider seeds separately. Do not insert a supplier estimate
as an observed bill or customer price.

The raw journal must contain exactly one `submission_started` and one `accepted`
entry matching the input, endpoint and request ID, plus recorded `recovered`
`COMPLETED` results with identical model output data. Verification requires live
Fal GET status `COMPLETED` with `request_id` strictly equal to the accepted ID.
Recovery permits only the exact owner/app/request-ID status and result GET URLs,
with redirects disabled. A provided `response_url` must match the exact result URL;
its observed null value does not replace transport verification. The SDK result's
nonempty `requestId` must also match. SDK 1.7.0 derives this field only from the
`x-fal-request-id` response header and returns an empty string when absent. That
absence is admitted only with the verified status identity, bound GET and output
data exactly matching every completed result in the original hashed journal.

`providerResultSha256` hashes canonical `result.data`, not the SDK wrapper or
variable recovery headers. The import plan separately binds endpoint, accepted
generation ID and original journal. This digest definition changed before any
adoption; regenerate and review dry-run plan fingerprints before applying. Local
reports preserve the raw status, SDK request ID, raw SDK-result digest and each
actual GET URL/status/header value/raw HTTP-body digest. They never manufacture
a provider header or rewrite the original journal. This follows the official
[queue recovery contract](https://fal.ai/docs/documentation/model-apis/inference/queue)
and [SDK response handler](https://github.com/fal-ai/fal-js/blob/main/libs/client/src/response.ts).

Verification also requires identical SHA256 for the provider video and owned
durable copy, a readable durable poster, and matching
provider/durable bytes for every reference. If the official image-upload owner
re-encoded a PNG, the manifest must explicitly bind its separate durable SHA256
and `canonical-png-normalization-v1`. Verification then requires the exact current
`decodeImageUpload` PNG output and exact decoded RGBA dimensions/channels/pixels
on both copies. It performs no resize or similarity comparison. Both byte hashes,
the transform and the decoded pixel digest remain in immutable provenance; the
historical Fal input stays unchanged while replay uses the durable same-content
image. A changed pixel is rejected. It probes the durable video bytes with
`ffprobe` from PATH. Media downloads have size/time bounds and reject redirects.
The database transaction is explicitly `BEGIN READ ONLY`; no schema bootstrap runs.

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-external-fal-results.ts \
  --mode plan --manifest /absolute/private/film.json

pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-external-fal-results.ts \
  --mode dry-run --manifest /absolute/private/film.json \
  --journal /absolute/private/film.jsonl \
  --env-file /absolute/explicit-target.env \
  --actor-user-id ADMIN_UUID --out /absolute/private/dry-run.json
```

The explicit target file supplies DATABASE_URL and required S3 configuration.
Fal credentials may come from that file or from an explicit `--fal-env-file`
(reading only FAL_API_KEY/FAL_KEY). Nearby env files are never loaded implicitly.
Reports include stable database/plan fingerprints, durable original URLs (never
signed access grants), measured facts and resolved seed; protect stdout as well
as the mode0600 create-only `--out` file. This command is an operator CLI with
explicit database access, not a public user authentication endpoint. The actor
must be in the canonical admin roster: `user_roles` has precedence, with legacy
`app_admins` used only when no role admins exist.

Dry-run can verify media before migration 76. `migrationReady: false` is
informative and does not alter the plan fingerprint. The write path still refuses
an unready database. Migration readiness alone does not attest that the deployed
runtime includes the required readers, audit labels and resync guards.

## Kling V4 offline preparation

The Kling contract lives in `frontend/server/external-fal-import/kling-v4.ts`.
It accepts only `engineId: kling-v4` and exact `kling/v4` endpoints for `t2v`,
`i2v`, `ref2v` and `v2v`. It preserves the exact submitted provider input,
including multi-shot prompts and omitted edit duration; it adds no FLUX controls,
FPS, audio switch, seed or billing defaults. Omitted generation duration/resolution/framing use the documented defaults for validation and replay without modifying the journal-bound raw input; Edit may inherit source duration. Request validation is offline and
never establishes account access or provider execution readiness.

Kling references additionally require `kind` (`image`/`video`) and an exact
`slotId`. Manifest order is: `start_image_url`, `end_image_url`, `video_url`,
`image_urls.N`, `video_urls.N`, then each `elements.N.frontal_image_url`,
`elements.N.reference_image_urls.N`, `elements.N.video_url` in authored order.
Every used URL must have its own mapping occurrence, even when an asset is reused.
The same owned originals populate reusable settings and elements; immutable
provenance keeps the historical provider URLs. Video references are hash-checked
byte for byte and locally probed, with a combined measured duration ceiling of
30 seconds in reference generation. An Edit source uses the documented individual 30.05-second media tolerance; output settings still require integer 3–30 seconds. PNG normalization is admitted only for image references.

External voiced elements fail closed with
`IMPORT_KLING_OWNED_VOICE_EVIDENCE_REQUIRED`: this operator importer has no
owner-certified provider voice resolver and must not convert a raw voice ID into
an ownership claim. Use the certified native workflow when that capability is
available, or extend this contract with independently verified binding evidence
before adopting a voiced external request. Direct Kling results are unsupported.

Kling also requires `media.poster` and `media.preview`, each with a canonical
owned durable URL and SHA256. They must match the video's existing owned
`media_assets.thumb_url` / `preview_url`, and all three role URLs must differ.
The poster must fully decode as one JPEG/PNG/WebP image. The preview is probed
from verified bytes, must have no audio stream, last at most six seconds and be
no longer than the original (100 ms container tolerance). Bounds are 300 MiB for
Kling originals/video references, 30 MiB for image references, 8 MiB for posters
and 20 MiB for previews. These are importer safety bounds, not a model promise.
Full content acceptance, cadence/codec review and browser playback remain operator
qualification steps. No derivative is generated or uploaded by this importer.

Plan and inventory need only a real manifest and have no database/provider access:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-external-fal-results.ts \
  --mode inventory --manifest /absolute/private/real-kling-result.json
```

Inventory lists candidate roles, exact prompt/settings, pending model/family/SEO
destinations and prerequisites. `verified:false` and `currentCuration:null` are
intentional: it does not invent media readiness or an order snapshot. The existing
`dry-run` mode is a separate read-only **live** check and still requires real
accepted/completed provider evidence, owned uploads, admin credentials and the
explicit target env. Nothing in a fixture or offline inventory substitutes for it.

Kling apply uses the same migration/admin/owner/advisory-lock/manifest/payment
boundary as FLUX and stores the short preview in `app_jobs.preview_video_url` and
`job_outputs.preview_url` while preserving the owned upload's preview. Replay
also rechecks output original, poster and preview identities. Original and display
hashes remain immutable provenance. Imports stay private/non-indexable and do not
change curation. See the dated [qualification and placement handoff](../launch/kling-v4/media-qualification.md).

## Transactional adoption

After the runtime guards and migration are released, use the exact fingerprints
from a successful dry-run. The CLI redoes live read-only verification before the
write transaction, then rechecks the admin roster, migration, asset ownership,
asset facts and conflicts under a provider-request advisory lock:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-external-fal-results.ts \
  --mode apply --manifest /absolute/private/film.json \
  --journal /absolute/private/film.jsonl --env-file /absolute/explicit-target.env \
  --actor-user-id ADMIN_UUID --expect-database-sha256 DATABASE_SHA256 \
  --approve-plan-sha256 PLAN_SHA256 --out /absolute/private/apply.json
```

It inserts one deterministic completed app job and one ready output, preserving
the existing upload asset's ID, owner, source and URL. The asset links to that
output; default library readers show one card. The immutable provenance retains
the original Fal input and request while the reusable snapshot refers to owned
durable images. No queue, provider-attempt, lifecycle event, receipt, price or
wallet state is fabricated. The database timing trigger skips this origin.

An exact replay returns `created:false`. A different owner, request binding,
manifest, asset state, output or existing native job fails closed. A failed
transaction rolls back all adoption changes. The CLI does not publish visibility,
change playlists, enroll watch pages or modify generation tariffs.

Tests use disposable PostgreSQL and a local real MP4 fixture; read-only production
checks are operator evidence, never a substitute for transaction regression tests.

## NINE-01 native evidence profile

Kling imports may explicitly select `evidenceProfile: nine01-native-v1`. It covers
the nine actual NINE-01 base operation IDs and the separately completed bank
operation `NINE-01-FAL-OPTION-01`. It is not a general S3 URL allowlist, another
generation route, or an automatic choice between base and retake. Each manifest
binds one real provider identity, candidate and result. The option uses canonical
scene `K4-JANITOR-US` and distinct dependency `K4-JANITOR-US-OPTION-01`; its proof
cannot borrow the base acceptance. No operation OPTION-02 is admitted by this
profile without a later explicit contract revision.

For this profile, `--journal` points to a private JSON evidence bundle rather than
a rewritten JSONL journal. `evidenceSha256` hashes the exact bundle bytes. The
strict bundle contains schemaVersion1, profile, ownerUserId, operationId, sceneId
(the staging dependency ID), and a `files` object of `{path,sha256}` proofs:

- journal: an exact immutable snapshot of the original hash-chained operator log;
- request, submissionStarted, accepted, acceptedResponse, status, result and validation:
  the original native files of exactly the selected operation;
- grants: the historical reference grant output;
- stagingRegistry, stagingManifest and stagingState: the authorized staging graph.

These are real existing private files, not fixture values or newly invented
accepted/recovered entries. The reader validates raw file hashes and original
event positions, one genuine submission/acceptance/result, endpoint/body identity,
COMPLETED native identity, exact reference order and the original master/result
hashes. Nano events cannot establish Kling evidence. Base native files retain
their original names and values. The bundle's compact summary records source
hashes/positions without putting source file paths, object keys or grants in the
new summary. It becomes part of immutable externalImport provenance and the exact
plan digest. A native profile without its verified native source proof is refused.

The source-only `loadNine01NativeEvidence` API accepts the actual identity subset
without library IDs. It can qualify local source evidence before uploads exist;
that does not replace a full manifest, DB ownership verification, live provider
GETs, dry-run, apply, playback or public acceptance.

### Explicit separate source storage

The private staging source bucket is independent of the owned media storage used
by `--env-file`. Native dry-run/apply requires `--native-source-config` pointing to
an existing private JSON configuration with bucket, region, accessKeyId and
secretAccessKey. Other producer metadata such as publicBases is not used as an
endpoint or URL authority. The source signer uses only these explicit credentials
and the derived HTTPS AWS regional endpoint; no process environment swap,
credential discovery or arbitrary endpoint is allowed. The source target's
fingerprint must match the authorized staging registration/manifest. Keep the
configuration private and do not copy its values into a report or command line.

For each selected image, the verifier reconstructs its exact content-hash key
under editorial/drafts/launch-media/nine-01 and the authorized owner token. The
app owner, registration owner, reference hash, local source master, native image
receipt hash, historical grant, staged object state and input slot must agree.
Current source recovery uses a new five-minute signed GET for that exact object;
it never fetches an arbitrary historical URL. The generated URL is independently
checked against the bound bucket, region, path, method/expiry signature shape and
current time before a bounded no-redirect GET. Original source reads are capped
at20MiB, matching the staging owner. Existing video/poster/preview limits and
owned durable byte/pixel checks continue unchanged.

Historical grants must have been valid at the recorded submission. Their later
expiry does not invalidate a completed generation if the exact retained object
can still be read and matches its original hash. The accepted provider input and
historical URL stay unchanged. A missing, substituted or prematurely deleted
source object refuses admission; there is no fallback to a new generation or to
an unverified copy. The ordinary fal.media source path retains its existing guard
and cannot opt into private storage merely by receiving a source configuration.

Keep temporary objects, native masters and all source snapshots through actual
source verification, dry-run/apply and acceptance of durable owned copies. Normal
library reads and recreation use those owned copies after adoption. Strict
operator re-verification/replay still reads the retained source evidence, so
cleanup needs an explicit owner decision documenting which checks will remain
possible. This code performs no cleanup, upload, paid generation, public curation,
tariff change or migration. The existing private-then-public playlist flow is
unchanged.
