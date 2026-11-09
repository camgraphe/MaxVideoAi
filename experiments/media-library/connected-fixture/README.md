# Connected Library verification fixture

This fixture exports an explicit committed product revision, initializes a disposable
PostgreSQL 17 database through the application's schema owners and authored migrations,
and serves the real Next application. It never starts or controls a browser. Browser
verification belongs to Codex IAB; no Playwright, Chromium, CDP attachment or CLI renderer
is launched by these commands.

Run from the repository root with its installed Node 22 dependencies:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/connected-fixture/verify-storage.ts
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/connected-fixture/runtime.ts <full-committed-sha> <absolute-evidence-directory>
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/connected-fixture/verify-connected.ts
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/connected-fixture/verify-readonly.ts
```

The runner prints only the path to its private connection document under the ignored
`.superpowers/sdd/2026-11-09-media-library-integration/` workspace. That file contains
one-use synthetic session entry and local control capability. Never publish it. The
exported temporary snapshot alone receives `/api/fixture-session`; no production
route, middleware, Supabase client, authorization hook or storage constructor is changed.
The bootstrap supports only fixed ordinary synthetic accounts A/B/empty and guest,
consumes each random capability once and preserves production Secure cookie policy.
The normal Library/HeaderBar, APIs, ownership/signing and SQL paths remain real.

`runtime-manifest.json` is redacted evidence: exact product revision, lock hashes,
Node/PG qualification, seed hash and fixture file hashes. `seed.json` contains only
synthetic rows. Media bytes derive from the checked-in public prototype corpus,
whose source hashes and extract/static-video limitations are retained. The seed has
135 visible owned source identities (132 ordinary plus three independent legacy),
three foreign controls, one proven legacy mirror, same-original distinct outputs,
unsaved siblings and measured image/video/audio facts. The seed never invokes a
provider or uses customer data. Core schema initialization precedes serving GETs.
Migrations 32 **and 34**, 35–37, 43–44 provide the genuine content-addressed producer
and fence chain; migration 34 is necessary for 35's media-kind index. The ordinary
profile/legal/receipt/admin/settings schemas are initialized, with no admin grants.

Storage is a loopback HTTP S3 protocol fixture using fake credentials. Existing
application SDK constructors select it through `AWS_ENDPOINT_URL_S3`; canonical
identities retain the recognized HTTPS media authority with a synthetic bucket.
The service verifies SigV4 (headers and presigned queries), expiry, payload hashes
and CRC32, conditional creation, bounded PUT, exact GET/HEAD, single Range/206/416
and idempotent DELETE. Only the selected ordinary object commands are supported;
AWS chunked streaming, native S3 multipart, ListObjects and AWS IAM are not emulated.
The application video uploader's own chunk routes use ordinary PUT/GET/DELETE and
remain the actual production routes. No storage aliases or SQL URL-policy changes
are installed.

The public byte manifest lists exact keys, local byte paths, MIME, role, size and
hash. `publicResource=true` authorizes **only** scoped IAB Image/Media fulfillment
of that exact canonical URL. `requiresGrant=true` means a stored upload references
it and private signed transport must be observed. When projections overlap, private
wins: never fulfill its canonical URL. Unknown keys fail closed. Refresh these flags
through the control endpoint after Save/import; they derive from real local SQL,
not a prefix assumption. IAB supplies public response bodies from the manifest;
this is distinct from the real HTTP private transport and is not CDN evidence.

Controls require the private bearer capability and exact loopback Host; they accept
no cross-origin request. They are on the separate control server, outside Next:

- `POST /session/mint {account: "a"|"b"|"empty"|"guest"}` returns a one-use entry.
- `POST /manifest/refresh {}` recalculates public/private flags from current SQL.
- `POST /storage/fail-next-upload {kind:"image"|"video"|"audio"}` refuses exactly one
  authenticated/checksummed PUT of that kind in fixed owner A’s content-addressed
  original namespace with403, before persistence. Other owners/kinds/thumbnails do
  not consume it. The next explicit retry uses the real route/SDK/SQL and succeeds
  normally; reset clears the arm. This is a controlled refusal, not cloud outage evidence.
- `POST /storage/control {key,action:"expire-last"|"fail"|"restore"|"delay",ms?}`
  changes only an already registered object. Expiry invalidates one observed grant
  fingerprint; a later refreshed grant must be genuinely distinct and usable.
- `POST /source/control {id,action:"unavailable"|"restore"|"replace"}` changes only
  an explicitly seeded owner-A asset. Actual route ownership and revision validation
  still run. Restore returns its exact seeded source.
- `POST /source/add-late {}` adds one deterministic ordinary upload after a snapshot
  was created, for testing that frozen selection excludes later arrivals.
- `POST /reset {}` clears only this owned disposable database and replays actual
  bootstrap plus deterministic seed, removes only post-seed fixture objects and clears
  forced storage failures; reload the browser afterward.
- `POST /app/stop {}` and `POST /app/start {mode:"development"|"production"}` control
  only the spawned process group. Auth, storage, database and origins remain stable.
- `POST /stop {}` stops all owned listeners/processes/PG and removes the exact
  temporary product snapshot. Evidence remains. SIGINT/SIGTERM has the same cleanup.

After functional verification and heavy validation, coordinate with the IAB operator
before running the optimized command. It stops the owned dev app, runs normal
`npm run build` including prebuild/lint/type/postbuild gates, then starts that output:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/connected-fixture/optimize-snapshot.ts
```

For two retained snapshots, copy each private connection into a distinct ignored file.
`optimize-snapshot.ts <private-connection-path> --no-start` builds the selected export
without starting its app, so the other app can remain available for functional QA.
Stop the active app before starting the other for measurements. Build/start orchestration
options do not change seed, storage protocol, product configuration or cookie policy.

No timing conclusion follows from readiness or this command alone. Compare baseline
`5135e4e2b7ad04261d26b3f7669eb2ec8aded1db` and candidate in the same mode with equal
seed/bytes/transport and mutually supported saved/kind scopes. Use one app at a time,
warmup and at least three alternating measured passes per supported viewport/cache
condition. Keep actual requested item counts, image quality roles, active players,
response-body bytes and latency separate. The S3 journal records `bodyBytesQueued`
  and `completed`; queued bytes on an aborted response are not delivered-byte proof. Public fulfillment body bytes and HTTP
response bytes do not establish TCP/CDN transfer or field CWV. Desktop loopback and
repeated physical content are explicit limits. Generic `/api/download` correctly
refuses loopback under its SSRF policy; this fixture does not widen it or establish
native canonical Document/download connectivity. A navigation account switch is
not a retained-component live auth-event test.

Execution results, failures and browser observations belong in the dated
[verification report](VERIFICATION.md). A live harness alone is not completion of connected QA or comparative evidence.

[Connected import evidence](IMPORTS.md) documents the real failed-image/Retry run,
chunk cleanup, exact original/display hashes and read-only SQL/S3 verification.
[Optimized comparison](COMPARISON.md) records the completed alternating IAB passes,
public-safe measured projection, provenance hashes and offline analysis command.
[Final preview provenance](final-preview-provenance.json) distinguishes the later
Subtitle-corrected build from the measured source. The comparison guide also maps
the historical baseline to an exactly equal public frontend/root-lock commit.

The final retained preview uses the candidate's `/app/library?view=saved`: private
saved sources work through actual loopback S3 without an interception pump. Public
synthetic Recent resources require the documented IAB operator fulfillment; this is
a fixture transport limitation, not evidence of product unavailability. The baseline
app is stopped, while its control/auth/storage/PG remain available for review. Keep
the candidate running until review ends. To clean up, call each retained runtime's
authenticated `POST /stop` using its own ignored connection document (or stop its
owned runner with SIGINT). This removes only its exact temporary snapshot and owned
processes/database; investigation evidence remains. Never print or copy the bearer,
session entry or database URL into documentation, terminal evidence or a PR.

The bootstrap also completes the twelve existing synthetic `app_jobs` through the
real video/image/audio settings builders and actual migrations 47, 53 and 59. These
schemas are required by the existing jobs reader (poll state and Draft-link reads),
even for completed jobs. The complement creates no provider job, Draft link, quote,
wallet or payment. Mixed-kind output groups remain an explicit synthetic limitation;
the primary output defines the job surface/settings. `jobs-complement.json` records
input, builder and migration hashes separately from the unchanged media seed.

To apply exactly that complement to a retained baseline without replacing its ports
or build, run the guarded setup helper with its private connection path:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/connected-fixture/complete-jobs.ts <private-connection-path>
```

This accepts only an owned Unix-socket disposable `libqa-*` PostgreSQL instance and
updates only the twelve fixed, completed, synthetic owner-A jobs. It does not start
the app, change canonical media, output IDs, original bytes or organization state.

After starting an optimized snapshot, the bounded read-only HTTP check exercises
its actual list/audio/detail/workflow owners (ordinary non-Draft jobs return404):

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/connected-fixture/verify-jobs.ts <private-connection-path>
```

It mints a separate synthetic session, keeps cookies out of its report, and writes
sanitized `jobs-http.json`. For a retained baseline built with the original helper,
`/reset` replays that older bootstrap; rerun `complete-jobs.ts` after such a reset.
