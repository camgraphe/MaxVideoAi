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

Only these application variables belong in the staging project's Production
target:

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

`DATABASE_URL` must identify the pooled endpoint for the exact Neon branch
`preview/mcp-staging`. The Supabase variables must identify the project
documented above. Vercel does not accept empty environment-variable values, so
`COOKIE_DOMAIN` and `NEXT_PUBLIC_COOKIE_DOMAIN` are intentionally absent; the
application treats absence as an unset, host-only cookie domain.

Do not add provider keys, Stripe secrets, a Supabase secret or legacy
`service_role` key, SMTP credentials, `CRON_SECRET`, or any production
database URL to this project.

### Deployment packaging guard

The application depends on the repository-local package
`packages/pricing`, so a CLI deployment must upload the repository root while
Vercel builds the `frontend` project root. Uploading only `frontend` produces
an incomplete build.

Vercel also resolves deployment configuration from the effective project-root
`frontend/vercel.json`. With this monorepo layout, passing
`--local-config frontend/vercel.mcp-staging.json` from the repository root was
not sufficient: Vercel used the production config, including its cron list.
The current staging deployment was therefore produced with
`frontend/vercel.mcp-staging.json` as the effective project-root config and was
verified after stable-alias assignment to contain zero cron registrations.

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

The real invocation repeats those checks, asserts the exact Vercel scope and
project, links only the temporary directory, and creates a production-target
candidate with `--skip-domain`. The stable alias is not changed at this point.
The deployment receives only two sanitized provenance metadata values:
`mcpApprovedGitSha`, containing the exact full tracked commit SHA, and
`mcpTrackedArchiveSha256`, containing the SHA-256 digest of `git archive HEAD`.
The wrapper waits for `READY` and rejects the candidate unless all pre-promotion
checks pass: the deployment belongs to `maxvideoai-mcp-staging`, the API cron
list is empty, both metadata values exactly match the current clean approved
`HEAD`, and the direct candidate origin is anonymous and carries the exact
global noindex header. It also calls the candidate discovery and direct MCP
route with the unaliased host: both must fail closed with HTTP `404` while
retaining the exact noindex header. Missing or mismatched provenance or headers
abort before promotion. Only then does it call `vercel promote`.

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
- its cron list is empty;
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
side effect is evidenced. The corrected stable deployment has an empty cron
list. The candidate-before-promotion wrapper above prevents recurrence.

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

### Hosted protocol evidence

The credential-free hosted smoke test passed on 2026-07-12. No Vercel
authentication cookie, share link, protection-bypass credential, Supabase
session, or MCP bearer token was sent.

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

### Hosted client evidence

Claude Desktop 1.20186.1 completed the hosted read-only lifecycle on
2026-07-12. Dynamic registration reached only the documented staging Supabase
project. The consent page showed exactly `openid`, `email`, and `profile`, plus
the expected `https://claude.ai/api/mcp/auth_callback` return address.

The connector rendered exactly three read-only tools. Sanitized results were:

| Check | Result |
| --- | --- |
| `list_models` | 39 public models; response limited to the requested count and first three IDs |
| `recommend_models` | Three factual text-to-video recommendations with duration, audio, resolution, and reference-support trade-offs |
| `get_account_status` | Email omitted; wallet `$0.00`; no pending funds; trial disabled; staging account-connections URL |
| Prompt and references | Claude drafted the text-to-video prompt and a three-part reference-image plan without generating or submitting media |
| Revocation | Staging account page changed to no connected applications; the next approved tool call returned `Authentication required` |
| Reconnect | A fresh consent page and explicit approval were required; a subsequent read-only `list_models` call succeeded |

An early `get_account_status` call exposed the canonical production account
handoff because the stable alias still served an older runtime revision. The
staging promotion guard rejected the first replacement candidate when its
direct deployment returned an authentication interstitial. After the guard was
corrected, the READY candidate passed anonymous access, noindex, zero-cron,
OAuth, stable-alias, and production-project invariants before promotion. The
repeated account call then returned exactly:

```text
https://maxvideoai-mcp-staging.vercel.app/account/connections
```

Codex CLI 0.144.1 was also registered persistently against the exact staging
MCP URL. Its current `mcp add` command automatically began OAuth and requested
`openid profile email phone`, despite the resource advertising only
`openid email profile`. The flow was stopped before approval or token exchange.
The registered entry was then authenticated with explicit
`mcp login --scopes openid,email,profile`. That second authorization request and
the MaxVideoAI consent page both showed only the three requested scopes, used a
loopback callback, and completed PKCE successfully. An ephemeral Codex session
running in a read-only sandbox called only `list_models` and returned 42 public
models. Treat the broader automatic `mcp add` request as a production onboarding
blocker; do not weaken the server scopes or approve `phone` merely to make the
default flow continue.

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
