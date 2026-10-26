# Private launch-media operator

This is an operator-only local tool. It has no route, provider POST, application
job, database write, wallet, pricing, import, curation or publication operation.
`stage` uploads bytes; it does **not** create a generation job.

The exact batch is supplied privately. Reference/dependency counts and ordering
are pinned by the registration and manifest, not by a five-image/three-video
limit. The offline lot A fixture uses 2/2/1 references; another fixture covers nine
videos, a different reference count, and shared references. Resource limits are
0–64 references, 1–32 video dependencies, 20 MiB per local file and 40 million decoded
pixels per image. PNG, JPEG and single-frame WebP originals are supported.

## Private registration

Create the operational directory **outside every Git checkout and OUTREACH**,
owned by the current operator with mode `0700`. Registration, manifest, journal,
command inputs and grant output files must have mode `0600`, the current uid,
one hard link and no symlink leaf. The helper reads no `.env` files and discovers
no credentials. The future operator must explicitly provide the already qualified
S3 process configuration; never copy credentials into these documents or argv.

The private registration JSON has this shape (placeholders are not identities):

```json
{
  "schemaVersion": 1,
  "registration": {
    "account": "Camgraph",
    "ownerId": "<actual private Camgraph owner ID>",
    "ownerToken": "<32 lowercase hex characters, privately reserved for this owner>",
    "batchId": "<lowercase letters, digits and hyphens>",
    "targetFingerprintSha256": "<qualified target SHA256>",
    "manifestSha256": "<SHA256 of JSON.stringify(parsed manifest), preserving property order>",
    "referenceCount": 1,
    "dependencyCount": 1
  },
  "manifestPath": "<absolute private manifest path>",
  "statePath": "<absolute private journal path; absent only for a new batch>"
}
```

The registration is the trusted local ownership approval. Its owner ID/token,
batch and target must match the exact manifest. Do not reconstruct a missing
journal or edit created/uncertain states to get past a hold. A manifest change
requires explicit requalification of the registration and its existing journal;
it cannot silently reuse an old inventory. No owner/account lookup or new account
is performed. Camgraph ownership must be established by the existing owner.

The target fingerprint is SHA256 of
`JSON.stringify([trimmed S3_BUCKET, trimmed S3_REGION])`. The 25 October policy
qualification recorded target fingerprint
`27c13be8062ce5f848c01bde9484747f21d0555745a7a29c59a5c7d25466de4c`
and policy SHA256
`0cf2b9fdf43aca2b84f5b3e7debd11c6d68981c5c0c277b6fdd5fa3c938b1b4f`.
Reuse that qualified target/signing principal and the existing Deny on
`editorial/drafts/*`; this tool does not read or alter IAM/policy. Target matching
alone does not establish the current signing identity or object delivery.

## Manifest

`Manifest` and `Registration` in `manifest.ts` define the full typed format.
The manifest contains `schemaVersion: 1`, `batchId`, `ownerId`, `ownerToken`,
`targetFingerprintSha256`, an exact `references` array, and `dependencies`.

Each reference has a unique stable `id`, an explicit `role` slug (for example
`identity`, `location`, `world`), absolute local `sourcePath`, byte
`sha256`, `size`, decoded `mime`, `width`, `height`, `disposition` (`create` or
explicitly approved `preexisting`), and `provenance`:

```json
{
  "provider": "vertex",
  "model": "gemini-nano-banana-2.1",
  "nativeResponsePath": "<absolute private native-response file>",
  "nativeResponseSha256": "<SHA256 of exact native response bytes>",
  "promptSha256": "<approved English prompt SHA256>"
}
```

Its exact `key` must be:
`editorial/drafts/launch-media/<batchId>/<ownerToken>/<id>-<sha256>.<extension>`.
Extensions are `png`, `jpg`, `webp`, selected from the decoded MIME. Every image
is fully decoded, not just inspected for a valid header. All local originals and
native evidence are validated before any storage call. The helper hashes native
evidence; the operator still reviews actual provider/model/settings/usage and
prompt lineage in that evidence. It does not infer provenance or charges from an
upload. Keep original masters, native parts, usage and prompt records private.

Each dependency is `{ "sceneId": "<unique video/attempt ID>", "referenceIds": [...] }`.
The array defines exact provider-reference order; every entry must name a known
reference once. An empty array explicitly represents a video with no staged image
input; zero images are valid if the entire declared batch needs none. Several
dependencies may share a reference. Declare every video
and approved attempt up front, including planned but unsubmitted holders. Counts
must equal registration counts. The helper neither chooses the nine final prompts
nor authorizes paid attempts. Unused references can remain in the batch for review.

## Explicit operations

From the repository root, use:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/launch-media/cli.ts validate "$PRIVATE_REGISTRY"
```

`validate` performs local validation only and prints counts. Other commands are
future operational steps, to be used only within the approved production batch:

| Command | Optional third argument | Effect |
| --- | --- | --- |
| `stage` | none | conditional exact-key PUT for `create`; verify existing bytes/MIME for `preexisting` |
| `sign` | private input JSON | issue bounded GET grants, write only to a new explicit private output file |
| `check-grants` | private grant output JSON | check exact minted URLs, method, reference order, time and remaining lifetime |
| `record` | private receipt-event JSON | record an actual external request ID/status/review; no provider call |
| `cleanup` | none | delete only acknowledged newly created keys after every dependency and review is final |

All commands acquire an exclusive journal lock. State writes use an fsynced private
temporary file, atomic rename and directory fsync. A crashed process may leave a
lock: confirm that operator stopped and preserve the journal before manually
removing **only that lock**. Never run parallel operators for one batch.

`stage` uses the existing `uploadFileBufferToKey` with `conditionalCreate:true`,
`acl:null`, `cacheControl:'private, no-store'`. It persists uncertain intent before
PUT. A 412 becomes `collision`; a lost/failed response remains `uncertain`. Neither
is adopted, retried or deleted. Stop and reconcile the exact object explicitly
outside this helper; no automatic uncertainty-to-created conversion exists.
Successful PUT acknowledgement is not proof of anonymous denial or delivered bytes.

The `sign` input is `{sceneId, expiresInSeconds, credentialsValidUntil, outputPath}`.
TTL is explicitly required, integer 1–86400 seconds, and cannot exceed the supplied
credential-valid-until time. That time is an operator attestation, not a live
credential-lifetime check. The adapter calls the low-level exact-key GET signer;
the generic owned-media wrapper continues to clamp to 3600 seconds. Only exact
regional AWS URLs for the configured bucket are accepted; no public alias is chosen.
No grants are logged, put into public DTOs, recipes or receipts. The private journal
stores URL digests and issue/expiry metadata. Grant output is a secret private file.

Sign close to submission. Before the external POST, call `check-grants` (or the
same `assertGrants` API in that operator process); it requires more than 60 seconds
remaining by default. It checks the issued URL digest and metadata, not S3's SigV4
cryptography. Only S3 establishes actual signature/delivery validity. The helper
never makes a provider POST. Immediately record the real receipt, even if the grant
has since expired. Once accepted, that dependency cannot receive replacement grants
or a replacement request ID. New URLs never renew an accepted payload silently.

`record` input is `{sceneId,event:{status,requestId?,review?}}`. Status progression:
`not-submitted → accepted → queued → running → succeeded|failed|cancelled` (queue or
running observations may be skipped). A never-submitted dependency may become
`abandoned`. Real request IDs are immutable. Terminal states cannot regress; final
review is `complete` (including adoption/hash/provenance checks) or `abandoned`
(explicit final abandonment). An ambiguous POST must be retained/recovered using its
actual receipt, never described as unsubmitted or retried automatically.

Cleanup holds the **entire batch** while any dependency is planned, accepted,
queued, running or awaiting final review. Grant expiry does not change that guard.
Only `created` keys may be deleted; preexisting, collided, uncertain and local files
are excluded. A missing exact remote key is idempotent. Retain masters, manifests
and journal after cleanup. No prefix listing, purge, lifecycle rule or master unlink
exists in the storage adapter.

## Remaining live gates

Implementation and tests make no storage/provider request or real signature. At
future authorized execution, verify the actual objects: global/regional/concerned
public aliases reject anonymous GET and Range; signed GET/Range delivers the exact
bytes/MIME/hash; a separate short grant for the same object really expires. Resolve
the previously observed public-base-URL discrepancy explicitly. Confirm signer
identity and credential lifetime, queue needs and runtime before dependent POSTs.
Keep objects through terminal jobs and adoption/review; stop new submissions if
expiry threatens an accepted queue. No resubmission, import or publication is implied.

Offline verification:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/launch-media-private-staging.test.ts tests/storage-conditional-create.test.ts tests/owned-media-read-access.test.ts
```

CLI failures print a static `LAUNCH_*` code only. Successful output contains counts
only. Keep detailed operational records and secret grants in the private directory;
OUTREACH receives only redacted code/test/integration evidence.
