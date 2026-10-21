# Adopt a real external Fal result

The operator CLI is `frontend/scripts/import-external-fal-results.ts`. Its strict
manifest currently supports FLUX 3 Max video modes through the same canonical
request builder as application execution. It recovers an already accepted Fal
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
