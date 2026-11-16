# BytePlus results in the existing marketing library

`frontend/scripts/import-byteplus-marketing.ts` adopts an already completed
Seedance 2.5 Flash video into an independent **private, non-indexable** marketing
publication. It does not create `app_jobs`, `job_outputs`, provider attempts,
receipts, wallet entries, playlists or SEO approvals. It never generates, retries
or uploads to BytePlus. Image-model results keep their image-media owners.

The existing `marketing_media` table and public catalog overlay already support
independent publications. No new migration, gallery template or public MCP tool
is needed. `import-copy.ts` owns the shared copy lease, deadline, expected-byte
verification, immutable storage namespace, HTTP readiness and retry behavior.
`import-publication.ts` retains its separate already-public export contract;
a private BytePlus result must never masquerade as that export or as a Fal job.

## Private manifest

Keep manifests under an ignored private directory, never in Git or public assets.
The strict schema is in `server/marketing-media/byteplus/contract.ts`:

- `schemaVersion: "maxvideoai-byteplus-marketing/v1"`
- `ownerUserId`, `engineId: "seedance-2-5-flash"`, `mode` (`t2v`, `i2v`,
  `ref2v`, `v2v`, `extend`) and the real `providerTaskId`
- `videoAssetId` (an existing private owned upload) and `videoSha256`
- `poster`: `sha256`, `sizeBytes`, `mime`; optional `assetId` selects a separately
  imported editorial image, otherwise the video's recorded thumbnail is used
- optional `poster.source` preserves a normalized editorial image's original
  `data` (base64), `encoding: "base64"`, `sha256`, `sizeBytes`, `mime` and
  `transform: "canonical-image-upload-v1"`. Verification replays the native image
  normalizer and requires its output to equal the owned poster byte for byte.
  The main poster descriptor always describes the stored image. This proof is
  private and does not relax provider-reference equivalence.
- optional `preview` with its own `assetId`, digest, byte count and MIME; a preview
  must be silent and at most six seconds, no longer than the original
- `references`: one ordered mapping per non-text `content` occurrence, with exact
  `contentIndex`, `assetId`, `sha256`, `sizeBytes` and `mime`, including repeated uses
- `evidence.request`, `.journal`, `.receipt`: each contains the **unaltered**
  original `utf8` and its SHA-256. Envelope assembly does not manufacture a new
  contemporaneous log. The recorded receipt can contain supplier estimates;
  none become a customer price or accounting entry.

The reader binds the request hash, one submission, one accepted task, successful
responses, exact terminal result, model, owner and output digest across all three
original files. It rejects native-job receipts and unknown request/manifest fields.
The public recipe is derived from the actual provider input, retaining all ordered
reference roles, requested duration, framing, audio, format and optional controls.
Actual measured duration and requested duration remain distinct. The stable site
video ID is `mbp_` plus SHA-256 of `byteplus_modelark:` and the real task ID; it is
a marketing identity, never an invented provider or native application job.

## Verification and application

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-byteplus-marketing.ts \
  --mode plan --manifest /absolute/private/film.json

pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-byteplus-marketing.ts \
  --mode dry-run --manifest /absolute/private/film.json \
  --env-file /absolute/explicit-target.env --actor-user-id ADMIN_UUID \
  --provider-env-file /absolute/byteplus.env --out /absolute/private/verified.json
```

`plan` is offline and explicitly unverified. `dry-run` uses `BEGIN READ ONLY`,
canonical admin-roster precedence and owned, ready assets. It makes one exact-task
GET to the fixed ModelArk API origin, with redirects disabled, and compares the
complete result to the recorded response. It downloads the original and each
reference through the bounded, DNS-pinned public transport, comparing provider
and owned bytes, MIME and size; owned storage is signed through its existing
owner. It decodes the poster and probes the original and video references locally.
An expired provider URL, changed byte or re-encoded reference fails verification;
there is no similarity fallback or automatic resubmission. A normalized image
needs a separately implemented and tested pixel-equivalence proof before adoption.

The target file explicitly supplies DATABASE_URL and S3 configuration. BytePlus
credentials come only from that file or the explicit provider file. No nearby
environment is implicitly loaded. The OpenAI Review database and bucket are
explicitly excluded. Reports contain no credentials, provider signed URLs,
account IDs, task IDs or supplier costs; `--out` is create-only with mode 0600.

For a separately authorized import, use the exact database and plan fingerprints
from the reviewed dry run:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/import-byteplus-marketing.ts \
  --mode apply --manifest /absolute/private/film.json \
  --env-file /absolute/explicit-target.env --provider-env-file /absolute/byteplus.env \
  --actor-user-id ADMIN_UUID --permission-confirmed true \
  --expect-database-sha256 DATABASE_SHA --approve-plan-sha256 PLAN_SHA
```

Apply repeats live verification. Only an immutable in-process verified plan can
reach the writer. Admin/asset ownership and unchanged source facts are rechecked
under locks at claim and completion; stale plans, conflicting manifests, live
leases and retired identities fail closed. A matching ready import is idempotent.
Failures can retry the same manifest through this CLI; the admin library indicates
that source-specific path instead of trying the public-export importer.

Copied bytes use the existing publicly readable `marketing-media/` namespace,
even while the publication remains private. Apply is therefore a real media copy,
not an offline plan. Original personal assets remain untouched. Provenance,
receipts, source URLs, account and task IDs stay in private source records. Public
recipes contain only portable copied media and creative settings. Prices still
come from current canonical customer quotes, never supplier receipts.

## Existing placement owners

After import, use normal marketing review and visibility controls. Publication
and curation remain separate: `examples-seedance-2-5-flash` feeds model/VS readers,
`family-seedance` owns the existing Seedance family, and `examples` owns the main
gallery. A managed family playlist needs explicit placement; do not replace it
with a new gallery layout or assume automatic fallback will override curation.
Watch slugs, indexing, home/PAYG and authored model demonstrations retain their
existing owners and need their own applicable selections.

## OpenAI review freeze

On 16 November, the owner requested that the submitted OpenAI plugin and its
dedicated Review runtime remain unchanged through 5 December. This import changes
neither that package nor its tools, OAuth, deployment branch, domains or reviewer
data. Do not synchronize the release candidate into Review, rescan, cancel or
resubmit it as part of this model launch. New model availability in that frozen
channel is not a prerequisite for the site/classic MCP release.

Local checks cover raw evidence tampering, all five modes, exact GET recovery,
byte verification, ownership, immutable plans and SQL write isolation. Existing
marketing copy/import/catalog and admin-browser regressions remain required.
These checks do not constitute production adoption or publication.
