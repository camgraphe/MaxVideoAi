# MCP production deployment runbook

Checked: 2026-08-26

This runbook prepares a reversible production release of the MaxVideoAI remote
MCP server. It does not authorize a deployment, Vercel alias, DNS change,
Supabase change, database migration, secret change, publication-flag change,
provider call, wallet spend, or directory submission. Every mutation requires
an explicit owner approval naming the environment, revision, and capability
layer.

Never paste or record an environment value, database URL, OAuth token, provider
response, payment identifier, prompt, or private media URL. Record only names,
targets, deployment IDs, commit SHAs, public endpoint statuses, safe object
counts, and sanitized evidence IDs.

## Fail-closed launch state

The first production candidate must contain exactly this checked-in state:

```json
{
  "publicMarketing": false,
  "publicIndexing": false,
  "transport": false,
  "oauth": false,
  "discovery": false,
  "paidGeneration": false,
  "trial": false,
  "referenceUploads": false
}
```

Production does not have environment overrides for these publication gates.
Changing a capability requires a reviewed change to
`frontend/config/mcp-publication.json` and a new deployment. An unaliased
`--skip-domain` candidate with all eight flags false is the only acceptable
first candidate. It is not a launch: the MCP routes, marketing surface, and
indexing remain closed.

The 2026-08-26 audit baseline found `api.maxvideoai.com` absent from the Vercel
domain inventory and public DNS, the production Supabase authorization-server
discovery endpoint returning 404, and the production JWKS containing no key.
It also found required production variable names missing. Treat that as a dated
baseline, not current evidence; rerun every gate below.

## Gate matrix

| Gate | Pass evidence | Failure / rollback |
| --- | --- | --- |
| Repository | Clean approved revision; focused tests pass; all eight flags false | Stop before candidate creation |
| Vercel identity and environment metadata | Read-only preflight passes for project `maxvideoai`, scope `camgraphes-projects`, root `frontend`, and Production targets | Add or retarget names through an independently approved secret-management action; rerun preflight |
| Neon schema | Migrations 29–38 rehearsed on a Neon branch, backed up, applied in order, and verified in production | Keep every flag false; restore/branch from the approved recovery point if the migration owner directs it |
| Supabase OAuth 2.1 | Production server enabled, asymmetric signing key/JWKS, PKCE, exact redirects, consent, refresh, revocation, and dynamic-registration controls verified | Keep `oauth`, `transport`, and `discovery` false; revoke disposable clients and investigate |
| API domain | Vercel domain attached to the approved project; DNS resolves; valid TLS certificate covers `api.maxvideoai.com` | Remove only the new DNS/domain mapping after owner approval; flags remain false |
| S3 and IAM | Production-only namespaces, least-privilege policy, bounded upload/copy/read/delete/list and cleanup canaries pass | Keep `referenceUploads` and `paidGeneration` false; revoke the test object/credential if required |
| Providers and cron | Credential metadata exists, provider-specific gates are intentional, authenticated cron and a bounded real canary pass | Disable only the affected provider/capability; preserve recoverable jobs and accounting |
| Read-only MCP | Clean-account OAuth and five-tool read-only profile pass on each claimed host | Set either `transport` or `oauth` false; leave marketing/indexing false |
| Paid generation | Exact quote, explicit confirm, one charge/job/provider call, polling, durable result, recovery, rejection/refund, and top-up pass | Set `paidGeneration=false`; stop new submissions and reconcile in-flight work |
| Reference uploads | Ownership, media constraints, provider transfer, retention, deletion, and cleanup pass | Set `referenceUploads=false`; finish cleanup without deleting unrelated objects |
| Owned-site installation | Final public instructions and support/legal review pass while `publicIndexing=false` | Set `publicMarketing=false`; MCP can remain available to known users |
| Public indexing | Monitoring and all prior gates pass with separate approval | Set `publicIndexing=false`; remove internal/sitemap/llms discovery changes if applicable |
| OpenAI directory commerce | Written OpenAI clarification or a policy change covers the exact submitted scope | **Policy blocked** for the intended paid digital-content/credit workflow; do not submit |

## Read-only Vercel preflight

Run from the approved worktree before creating a candidate:

```bash
bash scripts/preflight-mcp-production-vercel.sh
```

The script is intentionally narrower than a deployment tool. It performs two
Vercel GET requests: project metadata and
`/v10/projects/maxvideoai/env?decrypt=false&target=production`. The response is
immediately projected to variable `key` and `target`; raw payloads and values
are never written to disk or printed. It never runs `vercel env pull`, `env
add`, `env rm`, `link`, `deploy`, `promote`, `alias`, or any DNS command. It
also refuses an uncommitted source tree and validates the local eight-flag
state before contacting Vercel. When names are missing or mistargeted, it
reports the complete name-only list in one pass and exits without a mutation.

Required names must include the Vercel `production` target:

| Capability | Required names |
| --- | --- |
| Canonical MCP | `MCP_API_HOST`, `MCP_RESOURCE_URL`, `MCP_ACQUISITION_SIGNING_SECRET`, `MCP_TOPUP_HANDOFF_SECRET` |
| Neon runtime | `DATABASE_URL` |
| Site and Supabase | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SITE_URL` |
| Durable storage | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `VIDEO_RENDER_STORAGE_PREFIX` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Cron and FAL callbacks | `CRON_SECRET`, `FAL_WEBHOOK_TOKEN`, `FAL_POLL_TOKEN` |
| FAL provider | at least one of `FAL_API_KEY` or `FAL_KEY` |

`MCP_FUNNEL_TRIAL_TO_WALLET_WINDOW_SECONDS` is optional and defaults to
2,592,000 seconds. Trial variables are intentionally not required while
`trial=false`. Direct-provider variables are capability-specific and must not
be added or enabled merely to make a broad checklist green.

The preflight verifies names and targets only. It cannot prove that a value is
correct, nonblank, current, independent, or authorized. An authorized operator
must verify those properties in the secret manager without copying values into
logs. The public, non-secret canonical settings are
`MCP_API_HOST=api.maxvideoai.com` and
`MCP_RESOURCE_URL=https://api.maxvideoai.com/mcp`.

## Neon migrations 29–38

Application schema belongs in Neon; Supabase remains Auth-only. Use a direct
Neon connection supplied out of band as `DATABASE_URL_UNPOOLED` (preferred) or
`DATABASE_URL`. `scripts/apply-neon-migrations.sh` rejects Supabase and pooled
`-pooler` hosts. It does not read `POSTGRES_URL_NON_POOLING`, and it applies all
SQL files lexicographically, not only the MCP range. Never print the connection
string.

| Order | Migration | Required result |
| --- | --- | --- |
| 29 | `29_mcp_audit_events.sql` | redacted MCP audit-event table and indexes |
| 30 | `30_mcp_paid_generation.sql` | generation quotes, spending limits, guards, and indexes |
| 31 | `31_mcp_trial_entitlements.sql` | trial job fields, immutable audit, entitlement, override, and risk records |
| 32 | `32_mcp_reference_uploads.sql` | reference-upload sessions and state guard |
| 33 | `33_mcp_acquisition_funnel.sql` | immutable funnel events and OAuth connection bindings; prerequisite guards require 30–32 |
| 34 | `34_mcp_reference_upload_media_kind.sql` | typed image/video/audio media kind |
| 35 | `35_mcp_reference_upload_hardening.sql` | asset public IDs and upload-attempt ledger |
| 36 | `36_mcp_reference_upload_replay_safety.sql` | multipart/replay state, leases, hashes, and parts |
| 37 | `37_mcp_reference_upload_recovery_state.sql` | cleanup ledger, object fences, and recovery functions |
| 38 | `38_mcp_chatgpt_acquisition_attribution.sql` | distinct ChatGPT acquisition attribution after migration 33 |

Release procedure:

1. Freeze schema writes and record the approved Neon project, branch, recovery
   point, repository SHA, and migration inventory without credentials.
2. Create or refresh an isolated Neon rehearsal branch from production. Run the
   full migration runner there and execute paid, trial-disabled, reference, and
   funnel contract tests.
3. Inspect the full migration diff and locks. Confirm migrations 29–38 appear
   once and in order; never create placeholder predecessors.
4. During the approved production window, inject the direct URL out of band and
   run `pnpm db:migrate:neon`. Keep all publication flags false.
5. Verify required relations/columns/functions with metadata-only SQL, then run
   read-only counts. Do not select request JSON, prompts, URLs, tokens, provider
   IDs, OAuth client IDs, or payment IDs.
6. Record sanitized success evidence and preserve the recovery point. A schema
   error blocks every later layer.

## Production Supabase OAuth 2.1

Supabase OAuth Server is beta; recheck the
[current OAuth Server documentation](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
and changelog on the release day. Production changes require an Auth-owner
approval and are not implied by staging evidence.

Before enabling repository flags:

1. Set the production Site URL to the approved MaxVideoAI origin and the
   authorization path to `/oauth/consent`.
2. Enable the OAuth 2.1 authorization server and authorization-code flow with
   PKCE S256. Use an asymmetric RS256 or ES256 signing key so `openid` has a
   nonempty public JWKS.
3. Request only `openid email profile`. Review consent copy, token lifetimes,
   refresh-token rotation, session deletion behavior, grant revocation, and
   reconnect.
4. Allow exact reviewed redirect URIs; do not use wildcards. Dynamic client
   registration stays disabled until its owner, redirect policy, monitoring,
   and cleanup procedure are approved. If a claimed host requires it, enable it
   only for the controlled test and monitor registrations.
5. Verify authorization-server discovery, a nonempty JWKS, deny/approve, PKCE
   token exchange, HTTP 200 token responses, refresh, revoke, expired-token
   rejection, and reconnect with a disposable account. Never record codes or
   tokens.
6. Confirm the MaxVideoAI protected-resource document names only the canonical
   resource and authorization server. Keep `discovery=false` until all prior
   checks pass.

Public metadata checks may project only non-secret fields:

```bash
curl --fail --silent \
  'https://<production-project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1' \
  | jq '{issuer,authorization_endpoint,token_endpoint,registration_endpoint,scopes_supported,code_challenge_methods_supported}'

curl --fail --silent \
  'https://<production-project-ref>.supabase.co/auth/v1/.well-known/jwks.json' \
  | jq '{keyCount:(.keys | length)}'
```

## `api.maxvideoai.com` DNS and TLS

Do this only after an approved, unaliased, all-flags-false candidate is READY
and its deployment provenance and cron inventory match the reviewed revision.

1. Add `api.maxvideoai.com` to the `maxvideoai` Vercel project. Record the
   Vercel-reported DNS target without changing DNS yet.
2. Obtain DNS-owner approval, create the exact Vercel record, and wait for
   Vercel verification. Do not use a proxy that prevents certificate issuance
   unless that architecture has been separately reviewed.
3. Verify A/AAAA/CNAME resolution, certificate SAN/expiry/chain, SNI, HTTP/2 or
   HTTP/3 behavior, and the absence of redirects to `www` or the marketing
   origin.
4. With flags still false, `/mcp` and protected-resource discovery must remain
   fail-closed with noindex headers. A valid certificate does not authorize a
   capability.

If the mapping is wrong, keep all flags false and remove only the new DNS/domain
mapping through an approved rollback. Do not redirect the MCP endpoint.

## S3, IAM, references, and retention

Use production-only credentials and prefixes. The IAM principal must be limited
to the approved bucket and object namespaces, with only the required
`PutObject`, `GetObject`, `DeleteObject`, and prefix-bounded `ListBucket`
permissions. Do not grant wildcard buckets, account administration, or access
to staging/customer-unrelated prefixes. Review public-base URL ownership,
cache-control, MIME constraints, maximum sizes, and delete/retention behavior.

Before `paidGeneration=true`, prove that one bounded provider output is copied
to the `VIDEO_RENDER_STORAGE_PREFIX`, survives provider URL expiry, is visible
only through the intended public media origin, appears in the account library,
and can be reconciled/deleted according to policy.

Before `referenceUploads=true`, prove upload ownership, cross-account denial,
size/type/hash validation, multipart replay safety, model-compatible transfer,
expiry, retention, deletion, object fencing, and authenticated cleanup. Current
code in `frontend/src/server/uploads/create-reference-direct-upload-handlers.ts`
hard-codes `mcp-reference-staging/` for the temporary object key. Production
reference uploads are blocked until engineering implements and reviews a
production-safe namespace or proves that this staging namespace is deliberately
isolated and governed in production. Never point cleanup at a broader prefix.

## Providers, H3, and cron canaries

The app accepts `FAL_API_KEY` or `FAL_KEY`; `frontend/src/lib/env.ts` normalizes
both to the same runtime credential. The read-only preflight therefore accepts
either name. It does not validate the credential or its propagation.

The H3 production checkpoint failed with `FAL_API_KEY is missing` even though
Vercel metadata contained `FAL_KEY`. This remains a paid-generation blocker.
Presence-only health checks do not close it. On the exact candidate revision,
prove that the runtime sees the configured alias, then run one explicitly
budgeted H3 authentication/submission canary, poll it to a terminal state, copy
the result to durable storage, reconcile wallet/job/provider state, and exercise
a known rejection/refund path. Do not add a duplicate secret name merely to
silence the error until the propagation/code-path cause is understood.

`FAL_WEBHOOK_TOKEN`, `FAL_POLL_TOKEN`, and `CRON_SECRET` must be independent and
present before FAL production work. Verify callback rejection without the
token, authenticated poll execution, idempotent terminal processing, stalled
job recovery, and no prompt or private URL in logs.

Other providers remain independent:

- BytePlus ModelArk requires `BYTEPLUS_ARK_API_KEY` and its explicit
  `BYTEPLUS_ARK_ENABLED`/Seedance provider, mode, and admin/public-routing gates.
  LAS additionally requires `BYTEPLUS_LAS_API_KEY`; keep LAS and V2V disabled
  until their separate accounting and failure canary passes.
- Kling direct requires `KLING_ACCESS_KEY`, `KLING_SECRET_KEY`, its explicit
  direct/public/admin gates, and `KLING_DIRECT_POLL_TOKEN`.
- Vertex Veo/Omni requires the exact project/location/service-account names,
  explicit public/admin gates, approved GCS paths where applicable, and the
  matching `GOOGLE_VERTEX_*_POLL_TOKEN`.
- Luma Agents requires `LUMA_AGENTS_API_KEY`, explicit route/admin gates, and
  `LUMA_AGENTS_POLL_TOKEN`.

`frontend/vercel.json` currently declares 11 cron routes. Before promotion,
compare the candidate's actual cron inventory to that file, call each enabled
route without credentials to prove rejection, then run one authenticated
bounded canary. A disabled provider's cron may safely do no work; do not enable
that provider to make the cron look active. Roll back only the failing provider
or capability, not a working ModelArk mode because LAS fails.

## Reversible rollout order

Each layer requires a new approved revision, a candidate inspection, promotion,
smoke tests, and an evidence entry before the next layer. `publicIndexing`
stays false throughout layers 0–6.

0. **Dark candidate:** all eight flags false; deploy unaliased with
   `--skip-domain`; verify SHA, project, root, crons, noindex, and fail-closed
   routes. This is the only candidate shape permitted by the preflight.
1. **Discovery only:** after production OAuth is healthy, set only
   `discovery=true`. Verify protected-resource metadata; `/mcp` must still 404.
2. **OAuth plus read-only transport:** set `oauth=true` and `transport=true`.
   The handler requires both. Keep paid, trial, references, marketing, and
   indexing false. Verify the five read-only tools, scopes, refresh, revoke,
   reconnect, rate limits, and audit redaction on each claimed host.
3. **Paid generation:** after the H3/provider, S3, cron, wallet, Stripe handoff,
   accounting, recovery, and refund gates pass, set `paidGeneration=true`.
   Start with one controlled disposable account and the smallest authorized
   spend; expand only after observation.
4. **Reference uploads:** after the production namespace/IAM and cleanup gate
   passes, set `referenceUploads=true`. Upload one disposable object and prove
   full lifecycle before expansion.
5. **Owned-site manual installation:** after Legal, Security, Support, and host
   evidence approve the exact public instructions, set `publicMarketing=true`
   while `publicIndexing=false`. Publish the copyable production URL first;
   this does not depend on a directory listing.
6. **Hosted compatibility:** repeat clean-account install, deny/approve,
   refresh, revoke, reconnect, tool selection, rendering, recovery, removal,
   and negative prompts on every claimed host/version.
7. **Indexing:** only with separate Growth/SEO/Operations approval set
   `publicIndexing=true`, then add internal links, sitemap/llms exposure, and
   indexation evidence. Indexing is never bundled with a capability enablement.
8. **Trial:** keep `trial=false` unless its independent risk, entitlement,
   provider-cost ceiling, reconciliation, cleanup, abuse, and support runbook
   is operational. It is not required for launch.

The server binds confirmation to an exact unexpired quote, validates
`confirmed: true`, prevents a duplicate quote from creating a second provider
job, and treats every replacement as a fresh quote. The generic MCP transport
does not provide MaxVideoAI with a signed, independently verifiable record of
the human's chat turn: the requirement to wait for new explicit user approval
is also a host policy. Test the exact failure → refund → replacement sequence on
every named host. If a host prepares and confirms a replacement without a new
user turn, keep paid generation disabled for that host and do not market the
approval boundary as a cryptographic guarantee.

For rollback, set the smallest affected checked-in flag false and deploy the
reviewed rollback revision. Setting either `transport=false` or `oauth=false`
closes `/mcp`; setting `discovery=false` closes only protected-resource
metadata; paid/reference/trial flags remove their capabilities independently.
Keep jobs, quotes, receipts, audit events, idempotency records, and cleanup
ledgers. Never retry an ambiguous paid provider submission or refund it until
the provider outcome is known.

## OpenAI commerce and distribution boundary

As checked on 2026-08-26, the
[OpenAI app guidelines](https://developers.openai.com/plugins/app-guidelines)
allow in-app commerce for physical goods and prohibit selling digital products
or services, including digital content, tokens, or credits, directly or
indirectly. MaxVideoAI's wallet-funded media generation and credit top-up flow
therefore creates a current eligibility blocker for the intended paid plugin.
This is MaxVideoAI's policy inference, not a written OpenAI eligibility ruling.

Do not submit the paid MaxVideoAI profile unless OpenAI provides written
clarification covering the exact submitted scope or the published policy
changes and Legal re-reviews it. Eligibility of a permanently read-only
comparison connector is not established; do not assume that narrowing the
submitted tool list makes it eligible.

Manual installation from MaxVideoAI's own website is a separate user-controlled
distribution path. It may launch first, with `publicIndexing=false`, only after
the production transport/OAuth, legal/support, clean-host, and monitoring gates
above pass. Do not claim an OpenAI submission, listing, approval, verification,
partnership, endorsement, or ChatGPT availability based on a direct install.
If policy is later cleared, recheck the
[current submission requirements](https://developers.openai.com/plugins/deploy/submission),
scan the exact production server, provide a no-MFA test account and public
legal/support URLs, verify every annotation/output schema, and supply exactly
five positive and three negative review cases.

## Evidence record

For every authorized layer, record only:

- UTC date/time, operator/approver role, commit SHA, Vercel deployment ID, and
  publication flags;
- public host/status/TLS observations and sanitized OAuth/provider/storage test
  outcome IDs;
- migration filenames and schema-object checks, not connection strings;
- exact client name/version and pass/fail for deny, approve, refresh, revoke,
  reconnect, tools, rendering, negative cases, and removal;
- safe job/quote counts, cents, currency, and terminal state for a controlled
  canary, without prompts, URLs, tokens, client IDs, Stripe IDs, or provider IDs;
- the smallest rollback action and its verified result.

No evidence entry authorizes the next layer or an external distribution action.
