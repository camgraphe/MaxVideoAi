# MCP staging deployment

This runbook describes the disposable, public staging environment used to
validate the MaxVideoAI MCP integration with Claude Desktop and other remote
MCP clients. It is deliberately isolated from production.

## Supabase Auth project

| Setting | Staging value |
| --- | --- |
| Project | `MaxVideoAI Staging` |
| Project reference | `gecrywjztpbwbrlnomti` |
| Region | `us-east-1` |
| Plan | Free (`$0`) |
| Application origin | `https://maxvideoai-mcp-staging.vercel.app` |
| Supabase API origin | `https://gecrywjztpbwbrlnomti.supabase.co` |
| Site URL | `https://maxvideoai-mcp-staging.vercel.app` |
| Additional redirect URL | `https://maxvideoai-mcp-staging.vercel.app/**` |

Supabase is used for staging authentication only. Do not apply application
schema migrations, import production users, or add a production URL to this
project. The application database is hosted separately in an expiring Neon
branch.

The public publishable key is retrieved at deployment time and stored in the
dedicated Vercel staging project's environment. Do not commit a literal key.
Never expose or copy a Supabase secret key or legacy `service_role` key into a
client environment.

## OAuth 2.1 state

The staging project has the following Auth features enabled:

- OAuth 2.1 authorization code flow with PKCE
- authorization path `/oauth/consent`
- dynamic client registration for MCP-compatible clients
- ES256 (P-256) JWT signing, so `openid` ID tokens and public JWKS validation
  work without sharing a signing secret

The following endpoints must return HTTP `200`:

```text
https://gecrywjztpbwbrlnomti.supabase.co/.well-known/oauth-authorization-server/auth/v1
https://gecrywjztpbwbrlnomti.supabase.co/auth/v1/.well-known/jwks.json
```

Discovery must advertise authorization, token, registration, JWKS, and
UserInfo endpoints. The JWKS must expose an asymmetric `ES256` key. The known
production Supabase project's OAuth discovery endpoint must continue returning
HTTP `404` until a separately reviewed production rollout.

## Disposable user

The only manually provisioned staging user is
`mcp-staging@maxvideoai.test`. Its email is confirmed. The unique password is
stored outside this repository in the local macOS Keychain under the service
`MaxVideoAI Staging Supabase User`.

Do not import or reuse a production account. Rotate or recreate the disposable
user before a shared testing session if its credential may have been exposed.

## Free-plan operating constraint

Supabase may pause a Free project after roughly seven days of low activity.
Before an MCP validation session, confirm that the project is
`ACTIVE_HEALTHY` and resume it from the Supabase dashboard if necessary. A
paused Free project is restorable for up to 90 days. No paid upgrade is
authorized for this staging environment.

## Vercel staging project

The hosted application is isolated in the Vercel project
`maxvideoai-mcp-staging`. Its project root is `frontend`, it uses Node.js
22.x, and its stable public origin is:

```text
https://maxvideoai-mcp-staging.vercel.app
```

Vercel Authentication is disabled only for this dedicated project so MCP
clients can reach the application-level OAuth challenge anonymously. Git fork
protection and the normal skew-protection setting remain enabled. The project
serving `maxvideoai.com` is a different project and must stay read-only during
staging operations.

Because MCP protected-resource discovery is now publicly published, an
unaliased deployment candidate returns the same stable resource metadata as the
permanent staging host. The deployment wrapper validates that exact metadata
before promotion. The candidate transport itself remains closed: `/api/mcp`
must return `404` until the deployment is promoted to the exact staging host.
After promotion, the unauthenticated MCP challenge must use the current
transport cache policy `private, no-store, no-transform`.

The foundation application variables below belong in the staging project's
Production target:

```text
DATABASE_URL
MCP_API_HOST
MCP_RESOURCE_URL
MCP_STAGING_ENABLED
MCP_STAGING_HOST
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SITE_URL
```

The operational profile adds the following non-secret values to that same
Production target. These values are exact; do not add whitespace, alternate
provider names, or additional modes:

```text
MCP_STAGING_OPERATIONAL_ENABLED=true
BYTEPLUS_ARK_ENABLED=true
BYTEPLUS_LAS_BASE_URL=https://operator.las.ap-southeast-1.bytepluses.com/api/v1
SEEDANCE_2_5_BYTEPLUS_ENABLED=true
SEEDANCE_2_5_PROVIDER=byteplus_modelark
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false
SEEDANCE_2_5_BYTEPLUS_MODES=t2v,i2v,ref2v,extend
SEEDANCE_2_5_LAS_ENABLED=false
MCP_STAGING_REFERENCE_CLEANUP_ENABLED=true
MCP_STAGING_REFERENCE_STORAGE_PREFIX=mcp-reference-staging/
VIDEO_RENDER_STORAGE_PREFIX=mcp-render-staging/
GOOGLE_VERTEX_LOCATION=global
GOOGLE_VERTEX_API_BASE_URL=https://aiplatform.googleapis.com
GOOGLE_VERTEX_VEO_ENABLED=false
GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED=false
GOOGLE_VERTEX_VEO_ADMIN_ONLY=true
GOOGLE_VERTEX_OMNI_ENABLED=false
GOOGLE_VERTEX_OMNI_LOCATION=global
GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED=false
GOOGLE_VERTEX_OMNI_ADMIN_ONLY=true
GOOGLE_VERTEX_IMAGE_MCP_ENABLED=false
GOOGLE_VERTEX_IMAGE_MCP_PUBLIC_ROUTING_ENABLED=false
GOOGLE_VERTEX_IMAGE_MCP_ENGINE_ALLOWLIST=nano-banana-lite
```

Private provider canaries additionally require these sensitive Production-target
values on the dedicated staging project:

```text
MCP_STAGING_CANARY_ACCOUNT_IDS=<comma-separated MaxVideoAI staging account IDs>
MCP_STAGING_CANARY_CLIENT_IDS=<comma-separated hosted MCP OAuth client IDs>
```

Access is granted only when the exact account and the exact OAuth client both
match, the request is served from `maxvideoai-mcp-staging.vercel.app`, and
`MCP_STAGING_OPERATIONAL_ENABLED=true`. A partial match fails closed. These
allowlists do not mutate the deployed provider configuration: all public routing
flags stay `false` (closed), so another account or client continues to see the
Google/Vertex engines as unavailable. Store the identifiers as Vercel sensitive
values and never add their contents to Git or logs.

`BYTEPLUS_ARK_API_KEY` is required on the Production target for the first
operational MCP profile. Seedance 2.5 text-to-video, image-to-video,
reference-to-video, and extension submission and polling use the proven
ModelArk `/api/v3` route. Use a dedicated staging credential, supplied out of
band and stored only in the dedicated
`maxvideoai-mcp-staging` Vercel project. Never write it to Git, the shell command
line, logs, reports, or a downloaded environment file. The deployment wrapper
requests non-decrypted Vercel metadata and retains only environment-variable
names and targets; it never reads, pulls, compares, or prints credential values.
If the dedicated Ark credential does not exist, stop with `CREDENTIAL_BLOCKED`.
Do not substitute a production credential and do not weaken or bypass the
metadata preflight.

Fal-backed models, including H3, use the existing Vercel Marketplace resource
`MaxVideoAI-Fal`, connected to the Production target of both `maxvideoai` and
`maxvideoai-mcp-staging`. This connection exposes `FAL_KEY` through Vercel
without reading or copying its value and does not create another Fal resource
or subscription. Generations still consume the shared Fal usage balance.
`FAL_WEBHOOK_TOKEN` and `FAL_POLL_TOKEN` must be independent staging-only
secrets; the deployment wrapper requires their names and the presence of either
`FAL_KEY` or `FAL_API_KEY` before deployment.

`BYTEPLUS_LAS_API_KEY` is not required for this four-mode ModelArk profile and
does not block its deployment. LAS `/api/v1` is reserved for Seedance 2.5 V2V.
Keep `SEEDANCE_2_5_LAS_ENABLED=false` and do not add `v2v` to
`SEEDANCE_2_5_BYTEPLUS_MODES` until its LAS-specific quote, accounting, failure,
and canary evidence have passed review. A LAS key by itself never publishes or
enables V2V.

The eight Google/Vertex engines use one isolated staging identity: a dedicated
billed Google Cloud project, service account, and private GCS input prefix with
no access to production resources. The Production target requires
`GOOGLE_VERTEX_PROJECT_ID`, `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON`,
`GOOGLE_VERTEX_INPUT_GCS_URI`, `GOOGLE_VERTEX_VEO_POLL_TOKEN`, and
`GOOGLE_VERTEX_OMNI_POLL_TOKEN`. Keep every public routing flag false when the
identity is first installed. The four image engines are additionally held by
`GOOGLE_VERTEX_IMAGE_MCP_ENABLED`,
`GOOGLE_VERTEX_IMAGE_MCP_PUBLIC_ROUTING_ENABLED`, and the explicit
comma-separated `GOOGLE_VERTEX_IMAGE_MCP_ENGINE_ALLOWLIST`; credentials alone
never expose them through MCP. Enable one image engine at a time, then Veo Lite,
Veo Fast, Veo, and Omni after non-generation OAuth, GCS, and model-access probes
succeed. Never copy the production Google project, service-account JSON, or
bucket credential into staging.

`MCP_TOPUP_HANDOFF_SECRET` is required on the Production target of the dedicated
staging project. It must contain 32–256 random printable ASCII characters and is
used only to sign short-lived MaxVideoAI billing handoffs. Store it as a Vercel
secret and never copy its value into Git, documentation, logs, or a command-line
argument. The deployment wrapper verifies only its name and target and stops
with `CREDENTIAL_BLOCKED` when it is absent.

Durable video delivery also requires `S3_BUCKET`, `S3_REGION`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL` on the
Production target. Use a staging-only bucket or a staging IAM credential whose
write scope is restricted to the literal `mcp-render-staging/` and
`mcp-reference-staging/` namespaces. Do not copy the production S3 credential
into staging. The deployment wrapper checks only the variable names and target;
it never reads or prints their values. Without this storage profile, a provider
may complete a render while MaxVideoAI correctly keeps it unavailable because
the temporary provider URL has not been copied to durable storage.

`CRON_SECRET` is also required on the Production target. For this project it is
the dedicated staging credential used to authenticate the scheduled BytePlus,
Fal, Veo, and Omni polls and the attended reference-cleanup route. Supply it out of band,
store it only in Vercel, and never include its value in a shell command, Git
file, log, report, or downloaded environment file. The wrapper checks only that
the name exists on the exact target. At runtime,
`referenceUploads` remains false unless the cleanup flag, exact storage prefix,
and a nonblank `CRON_SECRET` are all present.

`DATABASE_URL` must identify the pooled endpoint for the exact Neon branch
`preview/mcp-staging`. The Supabase variables must identify the project
documented above. Vercel does not accept empty environment-variable values, so
`COOKIE_DOMAIN` and `NEXT_PUBLIC_COOKIE_DOMAIN` are intentionally absent; the
application treats absence as an unset, host-only cookie domain.

Except for the dedicated staging-only BytePlus and Google identities, the
marketplace-managed `FAL_KEY`, the staging-only provider poll/callback tokens,
`MCP_TOPUP_HANDOFF_SECRET`, the dedicated prefix-scoped staging storage
credential, and cleanup-only `CRON_SECRET`, do not add other provider keys, Stripe secrets, a
Supabase secret or legacy `service_role` key, SMTP credentials, or any production
database URL to this project.

### Schema and cleanup prerequisite

Migration files 30–37 are present locally. The 2026-08-26 hosted checkpoint
exercised account, quote, media, recovery, upload-handoff, and top-up-handoff
database paths, but did not perform a sanitized migration-inventory or admin
ledger reconciliation. Migration 37 remains a deployment prerequisite, and the
deployment wrapper does not run migrations or mutate the live database. If the
required schema state cannot be established without revealing credentials, stop
with `SCHEMA_BLOCKED`; do not deploy and do not attempt an in-band repair.

The operational MCP staging package registers exactly four schedules:
`/api/cron/byteplus-poll`, `/api/cron/fal-poll`,
`/api/cron/google-vertex-veo-poll`, and
`/api/cron/google-vertex-omni-poll`, all every five minutes. They advance
accepted Seedance 2.5, Fal-backed, Veo, and Omni jobs and persist their terminal
outputs. Do not add the Task 5 cleanup schedule or any other production
cron to `frontend/vercel.mcp-staging.json`.
Cleanup remains an attended, authenticated one-shot operation using the same
route and bounded Task 5 ledger owner as production. A secret name without a
working operator path is not sufficient; a failed cleanup run blocks promotion
and the staging operational session.

### One-shot cleanup and teardown

The operator wrapper is local and dry-run by default. It is pinned to the exact
project and host, processes at most 100 ledger objects per request, permits at
most 20 requests per phase, and records counts only:

```bash
bash scripts/run-mcp-staging-reference-cleanup.sh
```

For an attended cleanup window, supply the dedicated cleanup credential through
the local `MCP_STAGING_CLEANUP_SECRET` process environment out of band. The
operator wrapper accepts only a 32–512 character URL-safe token consisting of
letters, digits, `_`, `.`, `~`, and `-`. Then run:

```bash
bash scripts/run-mcp-staging-reference-cleanup.sh --execute
```

The secret is sent only as the bearer credential to the exact staging cleanup
URL and is never printed. The wrapper repeats bounded ledger cleanup until a
batch reports zero. Any HTTP/authentication failure, malformed response,
batch-limit exhaustion, or `selected != deleted` result stops with
`CLEANUP_BLOCKED`.

Reference uploads may be enabled only during an attended test window. Run the
one-shot cleanup at least every 10 minutes while they are enabled and once
immediately after the window. Upload links live for 15 minutes, so this cadence
bounds expired temporary-object exposure to less than 10 additional minutes
when cleanup is healthy. A missed or failed cadence requires disabling
`MCP_STAGING_OPERATIONAL_ENABLED` and blocks further reference uploads until a
successful zero batch.

Teardown is stricter. First set `MCP_STAGING_OPERATIONAL_ENABLED=false`, deploy
that exact closed profile, and verify that the stable host reports
`referenceUploads` as false. This closes both operational generation and the
reference-upload capability; the cleanup capability flag and exact prefix must
remain true so the authenticated teardown route stays available. Then wait for
the 15-minute upload lifetime plus the 5-minute processing lease and let the
ledger cleanup drain to zero. Run:

```bash
bash scripts/run-mcp-staging-reference-cleanup.sh --execute --teardown
```

The server refuses purge unless the operational flag is explicitly false and a
bounded database proof reports zero live sessions, zero active processing
leases, and zero unfinished parts. The command requires the durable cleanup
ledger to reach zero before each purge request. It then deletes bounded batches
only from the literal
`mcp-reference-staging/` namespace using the staging deployment's own database
and storage identity. It cannot purge `user-assets/`, shared production keys,
another bucket, or an operator-supplied prefix. Both phases repeat until zero;
any failed deletion blocks teardown completion and must be retried rather than
waived.

### Deployment packaging guard

The application depends on the repository-local package
`packages/pricing`, so a CLI deployment must upload the repository root while
Vercel builds the `frontend` project root. Uploading only `frontend` produces
an incomplete build.

Vercel also resolves deployment configuration from the effective project-root
`frontend/vercel.json`. With this monorepo layout, passing
`--local-config frontend/vercel.mcp-staging.json` from the repository root was
not sufficient: Vercel used the production config, including its cron list.
The current staging deployment is produced with
`frontend/vercel.mcp-staging.json` as the effective project-root config and must
contain exactly the five-minute BytePlus, Fal, Veo, and Omni poll
registrations—no inherited Kling, Luma, reconciliation, cleanup, retention, or
alert schedules.

Do not run Vercel deployment commands directly against this linked staging
project. Commit the exact revision to validate, make sure the worktree contains
no tracked or untracked changes, then use only the reviewed wrapper from the
repository root:

```bash
bash scripts/deploy-mcp-staging-vercel.sh --dry-run
bash scripts/deploy-mcp-staging-vercel.sh
```

Before either dry-run success or a real deployment, the wrapper rejects any
tracked, staged, or untracked worktree change. The dry run exports tracked
`HEAD` into an isolated temporary directory, makes
`frontend/vercel.mcp-staging.json` the effective temporary
`frontend/vercel.json`, and verifies the repo-root workspace and staging config
without contacting Vercel.

The real invocation repeats those checks, resolves the exact dedicated Vercel
project, then queries its non-decrypted Production-target environment metadata.
It reduces the response to names and targets only and requires the complete
operational inventory, including the BytePlus API key, one normalized Fal API
key alias, the dedicated Google identity and gates, all provider poll/callback
tokens, and the durable-storage variables,
before any link or deploy
command. It does not add, remove, pull, decrypt, or print an environment value.
After that sanitized preflight, it links only the temporary directory and
creates a production-target candidate with `--skip-domain`. The stable alias is
not changed at this point.
The deployment receives only two sanitized provenance metadata values:
`mcpApprovedGitSha`, containing the exact full tracked commit SHA, and
`mcpTrackedArchiveSha256`, containing the SHA-256 digest of `git archive HEAD`.
The wrapper waits for `READY` and rejects the candidate unless all pre-promotion
checks pass: the deployment belongs to `maxvideoai-mcp-staging`, the API cron
list contains only the exact five-minute BytePlus, Fal, Veo, and Omni polls, both metadata values
exactly match the current clean approved `HEAD`, and the direct candidate origin
is anonymous and carries the exact global noindex header. It also calls the
candidate discovery and direct MCP route with the unaliased host: both must fail
closed with HTTP `404` while retaining the exact noindex header. Missing or
mismatched provenance or headers abort before promotion. Only then does it call
`vercel promote`.

To resume validation of an already-created unaliased candidate, use
`bash scripts/deploy-mcp-staging-vercel.sh --candidate dpl_ID` from the same
clean approved revision. Resume mode performs the identical deployment-API
checks, including exact `mcpApprovedGitSha` and
`mcpTrackedArchiveSha256` matching; it cannot promote legacy or unrelated
candidates that lack those values.

After promotion the wrapper proves that the stable alias resolves to the same
candidate, rechecks the exact noindex header on the root, OAuth
protected-resource metadata, and unauthenticated MCP challenge, then compares
the production project's settings, domains, and Deployment Protection with the
baseline captured before packaging. Temporary files, local Vercel links, and
downloaded OIDC material are removed by a trap. No environment-variable value
is read or printed.

The acceptance conditions are all mandatory:

- the deployment belongs to `maxvideoai-mcp-staging`;
- `mcpApprovedGitSha` and `mcpTrackedArchiveSha256` match the current clean
  tracked revision exactly;
- its cron list contains only `/api/cron/byteplus-poll`,
  `/api/cron/fal-poll`, `/api/cron/google-vertex-veo-poll`, and
  `/api/cron/google-vertex-omni-poll`, all on `*/5 * * * *`;
- the tested root, protected-resource discovery, and MCP protocol responses
  include exact `X-Robots-Tag: noindex, nofollow, noarchive`;
- the stable alias resolves directly without Vercel Authentication;
- the production `maxvideoai` project and protection settings are unchanged.

### Transient cron incident

During the initial 2026-07-11 setup, one intermediate deployment inherited the
production cron list because the alternate config path was ignored. A later
24-hour log review found seven requests while the corrected build was still
building: Fal, BytePlus, Kling, both Vertex pollers, Luma, and missing-job
reconciliation. Every request returned HTTP `401`. No cron secret, provider
credential, payment credential, or production database was present, and no
side effect is evidenced. The corrected deployment at that time had an empty
cron list. The current operational staging contract intentionally permits only
the authenticated BytePlus, Fal, Veo, and Omni polls; the candidate-before-promotion
wrapper prevents every other schedule from recurring.

## Verification

Run these checks without printing any API key:

```bash
SUPABASE_STAGING_URL='https://gecrywjztpbwbrlnomti.supabase.co'

curl --fail --silent --show-error \
  "$SUPABASE_STAGING_URL/.well-known/oauth-authorization-server/auth/v1" \
  | jq '{authorization_endpoint, token_endpoint, registration_endpoint, jwks_uri, userinfo_endpoint}'

curl --fail --silent --show-error \
  "$SUPABASE_STAGING_URL/auth/v1/.well-known/jwks.json" \
  | jq '{keys: [.keys[] | {kty, alg, use, kid, crv}]}'

supabase projects list --output json \
  | jq '.[] | select(.id == "gecrywjztpbwbrlnomti") | {name, region, status}'
```

Expected results:

- the project is named `MaxVideoAI Staging`, is in `us-east-1`, and is healthy;
- discovery exposes the five required endpoints;
- JWKS exposes a public EC key with `alg` equal to `ES256`;
- no production project setting or user has changed.

### Historical protocol capture

A credential-free protocol capture was recorded on 2026-07-12. It predates the
current operational inventory and is retained only as historical transport
evidence. Current hosted behavior is recorded in the host compatibility matrix.

| Check | Sanitized result |
| --- | --- |
| Protected-resource discovery | HTTP `200`; resource `https://maxvideoai-mcp-staging.vercel.app/mcp`; sole authorization-server host `gecrywjztpbwbrlnomti.supabase.co` |
| Supabase OAuth discovery | HTTP `200` on the staging authorization server |
| Anonymous MCP `initialize` | Direct application HTTP `401`; no redirect or Vercel protection page |
| MCP cache policy | `Cache-Control: private, no-store` |
| MCP authentication challenge | RFC 9728 bearer challenge referencing the staging protected-resource metadata URL |
| Indexing policy | Exact `X-Robots-Tag: noindex, nofollow, noarchive` on both tested staging endpoints |
| Stable deployment schedule | Vercel deployment metadata reports `crons: []` |
| Stable deployment cron logs | Zero `/api/cron/` requests from the corrected stable deployment between its 2026-07-11 creation and the 2026-07-12 verification |
| Production rollout | `api.maxvideoai.com` has no DNS record and is absent from the production Vercel project's domains; MCP and protected-resource discovery therefore remain unavailable without changing production |

The production `curl` probes returned status `000` because the dedicated API
hostname does not resolve, rather than an application HTTP response. This is
the existing disabled rollout state, not a staging test failure. Do not add the
hostname or enable production MCP flags as part of staging validation.

### Host validation status

The current checkpoint is hosted and dated 2026-08-26. The exact reviewed
revision, deployment, host versions, tested calls, spend boundary, and remaining
gaps are recorded in `docs/operations/mcp-host-compatibility-matrix.md`.

Claude Desktop 1.37937.1 and Codex CLI 0.149.0-alpha.4.3 completed controlled
OAuth-backed staging sessions through live model planning, exact quote, and
top-up handoff. Claude also exercised private media listing, completed-job
recovery, and upload-handoff creation. No new generation was confirmed and no
wallet cents changed. OAuth denial, refresh, revocation, reconnect, a fresh
private upload, a fresh paid provider result, failure/refund reconciliation,
and public ChatGPT/Codex/Claude installation still require sanitized evidence.

## Cleanup

When the hosted MCP test environment is no longer required:

1. Remove the dedicated Vercel project and its staging-only environment
   variables.
2. Delete the expiring Neon staging branch if it has not already expired.
3. Delete the Supabase project after confirming its reference is exactly
   `gecrywjztpbwbrlnomti`:

   ```bash
   supabase projects delete gecrywjztpbwbrlnomti
   ```

4. Remove the staging organization from the Supabase dashboard once it is
   empty.
5. Remove the two local Keychain entries:

   ```bash
   security delete-generic-password \
     -s 'Supabase Database Password' \
     -a 'MaxVideoAI Staging'

   security delete-generic-password \
     -s 'MaxVideoAI Staging Supabase User' \
     -a 'mcp-staging@maxvideoai.test'
   ```

All cleanup operations are destructive. Reconfirm the staging project,
organization, and branch identifiers immediately before running them.
