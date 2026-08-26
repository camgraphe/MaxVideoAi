# MaxVideoAI MCP support and disclosure readiness

Checked: 2026-08-26
Readiness: **NOT READY FOR PUBLIC PROMOTION**

This runbook is the support and disclosure boundary for the controlled MaxVideoAI MCP foundation. It is not a public
availability announcement or a legal policy. Production defaults to the five
read-only discovery tools; the isolated staging profile registers the 12 tools
listed below. Production transport, OAuth, discovery, generation, trial, and
reference-upload publication remain disabled.

| Tool profile | Exact tool inventory |
| --- | --- |
| Default discovery | `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget` |
| Operational staging | `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget`, `list_media`, `create_reference_upload_link`, `prepare_generation`, `confirm_generation`, `get_generation_status`, `list_recent_generations`, `create_topup_link` |

The operational inventory is checked-in and tested on the hosted staging
revision recorded in the host compatibility matrix. This is evidence for the
tested Claude Desktop and Codex CLI versions only; it is not public-production,
directory, provider-submission, or fresh-spend evidence.

## Authoritative checked-in state

| Publication flag | Value | Support consequence |
| --- | --- | --- |
| `publicMarketing` | false | Do not direct prospects to the gated acquisition page as a live connection surface. |
| `publicIndexing` | false | Do not claim that MCP pages are indexed or generally available. |
| `transport` | false | The production MCP resource is not a live public service. |
| `oauth` | false | OAuth is controlled-test evidence only. |
| `discovery` | false | Do not promise automatic client discovery. |
| `paidGeneration` | false | No connected quote, debit, or generation flow is public. |
| `trial` | false | No promotional MCP trial is available. |
| `referenceUploads` | false | No connected upload or reference-ingestion flow is public. |

Additional deployment blockers:

- migration files 30–37 are present locally; the hosted application used quote,
  media, recovery, and handoff paths, but a sanitized schema/admin reconciliation
  is still required;
- a prior completed provider result and library recovery were observed, but no
  fresh provider submission, charge/refund reconciliation, or uploaded file was
  performed in the 2026-08-26 checkpoint;
- Claude Desktop 1.37937.1 and Codex CLI 0.149.0-alpha.4.3 have controlled
  staging OAuth and tool-rendering evidence;
- OAuth denial, refresh, revocation, authentication loss, reconnect, graphical
  ChatGPT/Codex installation, Claude Code, and other hosts remain unverified.

Checked-in authorities remain separate: the public claims matrix owns permissible and prohibited public claims; the
host compatibility matrix owns local-versus-real-host evidence; this support runbook owns support procedures and
escalation. Runtime flags and tool registration remain owned by `frontend/config/mcp-publication.json`,
`frontend/src/server/mcp/server.ts`, and `frontend/src/server/agent-api/errors.ts`.

## Safe case intake

Ask for only what is necessary:

- the client name and exact version;
- approximate UTC time and the action attempted;
- the visible error code and `correlationId`, if one was returned;
- the MaxVideoAI job ID and engine name for a web generation case;
- whether consent showed `openid`, `email`, and `profile`, plus the name of any additional scope;
- whether disconnect/revocation was attempted in the client, MaxVideoAI account connections, or both.

Never ask a user to send an access token, refresh token, password, OAuth authorization code, cookie, full card number,
payment method, raw private reference URL, private media, provider response, or complete prompt. Redact those values if
they are volunteered. Do not paste private case data into analytics, screenshots, directory submissions, changelog
entries, or status notices.

## Live versus reserved error vocabulary

Current errors exist at three different layers. Do not describe a transport or SDK rejection as a MaxVideoAI
application error, and do not infer a provider or wallet state from a generic protocol failure.

### Transport and protocol errors

The following safe envelopes are produced by the current handler or SDK and are covered by executable tests:

| Source | HTTP / JSON-RPC envelope | Current safe meaning |
| --- | --- | --- |
| Authentication challenge | HTTP 401, JSON-RPC `-32001`, exact response `{"jsonrpc":"2.0","error":{"code":-32001,"message":"Authentication required."},"id":null}` | No valid bearer principal. Follow protected-resource discovery and obtain fresh consent. |
| Unsupported HTTP verb | HTTP 405, `{"jsonrpc":"2.0","error":{"code":-32600,"message":"Unsupported HTTP method."},"id":null}` | Use GET, POST, or DELETE as required by Streamable HTTP. |
| Response negotiation | HTTP 406, JSON-RPC `-32600`, message `MCP requires JSON or event-stream response negotiation.` | The request accepted only browser HTML; retry from an MCP client with JSON/event-stream negotiation. |
| Oversized body | HTTP 413, JSON-RPC `-32600`, message `Request body is too large.` | Reduce the protocol request below the handler limit; never send media or base64 in this request. |
| Malformed JSON | HTTP 400, JSON-RPC `-32700`, exact response `{"jsonrpc":"2.0","error":{"code":-32700,"message":"Invalid JSON."},"id":null}` | Correct the JSON syntax; do not treat it as a tool failure. |
| Unknown JSON-RPC method | JSON-RPC `-32601`, message `Method not found`, with the request ID preserved | The SDK does not implement that protocol method. Do not retry it as a MaxVideoAI tool. |
| Handler/auth exception | HTTP 500, JSON-RPC `-32603`; safe messages are `Authentication could not be completed.` or `MCP request handling failed.` | Unexpected transport/auth processing failed without exposing the private exception. Retain only sanitized time/client context and escalate. |

These are current checked handler/SDK examples, **not an exhaustive catalogue of every private SDK message**. SDK
versions can reject other malformed JSON-RPC requests. Support may quote only the safe response returned to the user;
never expose an internal exception, schema dump, stack, token, request body, or provider response.

### Tool-level failures

SDK validation of invalid live-tool arguments returns a JSON-RPC result with `isError: true` and safe text such as
`Invalid arguments for tool list_models`; it is a tool-level `isError` result, not a provider rejection and not the
future application code `PARAMETER_INVALID`. Ask the user to correct only the documented public argument.

An unexpected operation inside a registered tool returns **`INTERNAL_ERROR`** with a redacted message and a generated
`correlationId`. Retain that identifier, stop repeated calls, and escalate if the failure persists.

Every uppercase application code used below is a **contract code that is not
observable from the default five-tool discovery registry**. Some are reachable
only in the controlled 12-tool profile. Do not tell a user that a specific code
occurred unless the live tool actually returned it.

## Support decision trees

### OAuth connection and consent

Availability: controlled Claude Desktop and Codex CLI staging evidence only;
production OAuth is off.

1. If the client receives HTTP 401 / JSON-RPC `-32001`, let it follow protected-resource discovery and open browser
   authorization. Never paste a token into the endpoint URL.
2. If consent is denied, leave the connection unauthenticated; do not describe denial as a product failure.
3. The intended least-privilege scopes are `openid,email,profile`. Stop or deny any consent that requests additional
   access. The tested hosts completed authorization with the intended staging
   policy, but additional host/version behavior still requires separate evidence.
4. If consent completes but the protected call still fails, capture the client/version, UTC time, and correlation ID,
   then escalate to Auth + MCP engineering. Do not repeatedly reauthorize.
5. Classify only Claude Desktop 1.37937.1 and Codex CLI
   0.149.0-alpha.4.3 as controlled staging passes. Treat every other host or
   version as unverified until it has its own record.

### Email verification

Availability: `get_account_status` can read verification state in controlled testing; trial/generation enforcement is
future-gated.

1. If account status is unverified, send the user to the MaxVideoAI web account verification flow.
2. Do not bypass verification, manually toggle entitlement state, or accept an emailed identity document in support.
3. A future trial or generation tool may return `EMAIL_VERIFICATION_REQUIRED`; this is a reserved code, not a current
   default five-tool discovery failure.
4. If verification is complete in the web account but remains stale after a fresh connection, escalate to Auth.

### Quote expiry

Availability: no quote tool is public. Local migration files do not prove a staging schema or live quote producer.

1. Do not inspect or repair a quote because no public MCP quote can exist today.
2. When a later live quote returns `QUOTE_EXPIRED`, require a new server-priced quote. Never extend an expired quote or
   reuse a displayed amount.
3. If funding happened after a quote was prepared, require a fresh quote so model availability, price, and balance are
   current.
4. Repeated expiry after immediate preparation belongs to Pricing + MCP engineering with opaque quote and correlation
   IDs only, never the prompt or raw request body.

### Insufficient funds

Availability: no MCP wallet mutation, quote confirmation, or top-up tool is public.

1. A future `INSUFFICIENT_FUNDS` response must redirect the user to the MaxVideoAI web Billing surface.
2. The agent must not collect payment details or claim that a top-up happened until Stripe and the wallet receipt are
   authoritative.
3. After confirmed funding, prepare a new quote; do not retry a stale confirmation.
4. Escalate wallet/receipt mismatches to Billing with receipt ID, amount, currency, and UTC time only.

### Spending limit

Availability: no spending action is public. Controlled staging can prepare and
confirm an exact quote, but the 2026-08-26 checkpoint stopped before
confirmation and left the wallet unchanged.

1. Treat a null limit as “no connected spending capability,” not as unlimited spending.
2. A future `SPENDING_LIMIT_EXCEEDED` response must stop confirmation and use the server-provided web approval or
   settings action when verified.
3. Host auto-approval never overrides server quote confirmation, idempotency, or account limits.
4. Do not raise a limit from a support ticket without the authenticated account-control flow and Billing approval.

### Upload handoff

Availability: `create_reference_upload_link` is absent from the default/public
profile, present in controlled staging, and `referenceUploads=false` in the
checked-in public configuration.

1. Do not ask the user to put a local path, base64 file, private URL, or credential into a tool argument.
2. The staged handoff is short-lived, user-scoped, and selects the requested
   image, video, or audio kind. A handoff is not proof that bytes were uploaded.
3. A malformed or unsupported request may use `PARAMETER_INVALID`; return the accepted type/size constraints
   only when those constraints are backed by the live upload implementation.
4. The user completes the upload on the first-party MaxVideoAI web handoff; the
   assistant then calls `list_media` again. Do not claim that the connected
   client transferred it or that upload completed from handoff creation alone.

### Reference validation

Availability: reference listing, ingestion, and reuse are not in the public registry.

1. Do not send an arbitrary URL to a provider or fetch loopback, private-network, metadata-service, redirected, or
   unsupported content.
2. A future `REFERENCE_INVALID` response should identify a safe corrective category (ownership, type, size, decoding,
   URL policy, or expiry) without echoing the private URL.
3. If the selected mode requires a reference, a future flow may return `REFERENCE_REQUIRED`; the current registry does
   not.
4. Suspected malicious files or SSRF attempts go to Security; content-policy failures go to Trust + Safety.

### Provider rejection or job failure

Availability: no MCP provider submission or polling tool is public.

1. `PROVIDER_REJECTED` and `JOB_FAILED` are future reserved codes. Do not manufacture them from a generic web error.
2. For a web job, preserve the job ID, stop duplicate submissions, and inspect the canonical job/refund state.
3. Never expose raw provider bodies, routing secrets, provider job tokens, or internal risk decisions.
4. Escalate broad engine impact to Generation + provider operations; a single policy rejection goes to Trust + Safety
   when applicable.

### Wallet refund

Availability: the web product has an existing failed-paid-generation refund policy; there is no MCP refund tool or MCP
refund-status producer.

1. Verify the canonical job and wallet receipt before answering. Do not promise a refund time that the source of truth
   does not provide.
2. If the paid job is terminally failed and the receipt has not reconciled, escalate to Billing + Generation using the
   job and receipt identifiers.
3. Do not request card details, create a second compensating credit, or treat a provider error alone as proof that the
   wallet changed.
4. A future `JOB_FAILED` response may report a normalized refund state only after the paid-generation implementation
   owns it.

### Trial restoration

Availability: migration 31 is present locally, its staging state is unverified, no live trial entitlement is proven,
and `trial=false`.

1. Do not promise, grant, consume, or restore an MCP trial today.
2. The future design releases a reserved entitlement only after qualifying pre-acceptance submission failure or a
   qualifying terminal job failure; it does not create wallet credit.
3. Do not expose risk signals or manually change entitlement state from a support conversation.
4. When implemented, a mismatch between job state and entitlement state goes to Billing/Risk + Generation with opaque
   identifiers. Until then the correct resolution is “feature unavailable,” not “trial restored.”

### Revoked connection

Availability: Claude and Codex revocation behavior remains unverified, production OAuth is off, and no staging funnel
revocation producer is proven.

1. Remove or disconnect the connector in the client.
2. Revoke the grant at `/account/connections` when that gated account surface is available.
3. Verify that the next protected call returns HTTP 401 / JSON-RPC `-32001` and requires fresh browser approval.
4. If a revoked token still succeeds, treat it as a security incident: stop testing, retain sanitized timestamps and
   client ID, and escalate immediately to Security + Auth.

## Disclosure inventory

### User-facing permissions

The intended OAuth identity scopes are `openid`, `email`, and `profile`. They let the host act through the published
MaxVideoAI tools for the approved account; they do not grant database access, expose a password, or authorize payment
collection. The Codex default flow requesting `phone` is not approved. Users must be told how to disconnect in their
client and revoke the MaxVideoAI grant. Client-side removal and server-side revocation are separate actions.

### Stored data categories

The published Privacy Policy already describes account/identity data, transactions, minimal Stripe metadata, device
and telemetry data, prompts, inputs, outputs, uploads, consent, and preferences for the web service. The controlled MCP
audit schema is narrower: user and OAuth client identifiers, event/tool name, success/failure, optional surface/engine,
coarse error, and timestamp.

The migration 33 schema defines funnel fields for time, stage, opaque acquisition,
quote/job identifiers, coarse source/campaign/client, applicable amount/currency, idempotency key, and an irreversible
receipt hash. The **MCP funnel ledger excludes prompts, email addresses, access tokens, raw reference URLs, provider
bodies, payment details or methods, secrets, and fraud signals**. A sanitized
staging ledger reconciliation is still pending, so this remains a schema
boundary rather than a public analytics claim.

This minimization does not mean MaxVideoAI avoids content processing: the normal service still processes prompts,
inputs, outputs, and uploads when a user requests a web generation. Those service categories and the minimized MCP
analytics ledgers must be disclosed separately.

### Media and reference retention

MCP media listing and reference upload are disabled in production. Controlled
staging listed private account media and created a temporary upload handoff
without uploading bytes. The current Privacy Policy describes content processing and
high-level account/log retention, but it does not provide a specific MCP upload-session, copied-reference, generated
media, signed-link, audit-event, OAuth-binding, or funnel-event retention period. Do not invent “ephemeral,” “never
stored,” or a day count. The retention period for each category is an owner decision requiring Legal, Privacy,
Security, Media, and Operations approval plus an implemented deletion job before launch.

### Trial abuse prevention

The proposed trial requires verified identity, one entitlement per user, account restrictions, rate limits, and
privacy-preserving risk signals. It must not copy raw IP addresses, prompts, or reference URLs into analytics. The
actual signal categories, lawful basis, access rules, retention, appeal/support path, and deletion exceptions are an
owner decision. A local migration file does not prove a staging entitlement table or live trial, so no public
eligibility or restoration promise is allowed.

### Spending confirmation

No default/public MCP tool spends money. The controlled operational contract
uses a short-lived server-owned quote, a separate explicit confirmation,
idempotency, server limits, and web approval above configured thresholds.
Wallet funding remains on the MaxVideoAI web product through Stripe. A host’s
“always allow” setting is not a substitute for MaxVideoAI confirmation.

### Provider processing

The five default discovery tools do not submit prompts or media to an inference provider. A confirmed operational generation sends
the necessary prompt, settings, and owned reference assets to the selected provider under the published Privacy Policy
and current subprocessor list. Legal/Privacy must verify that every actual provider, region, data category, onward
transfer, retention rule, and user choice is current before enabling a generation tool.

### Incident handling

The public status page currently renders only an administrator-authored general service notice. It has no MCP-specific
transport, OAuth, upload, provider, quote, wallet, or trial health feed. Support may link to it for a published general
notice but must not infer “operational” from the absence of a notice. Security incidents use the existing Security/Legal
process; service cases go to `support@maxvideoai.com` with sanitized evidence.

### Escalation ownership

| Case | First owner | Required escalation |
| --- | --- | --- |
| Connection, scope, consent, refresh, revocation | Support | Auth + MCP engineering; Security if revoked access still works |
| Quote, price, limits, receipt, refund | Support | Pricing + Billing |
| Upload/reference validation | Support | Media + MCP engineering; Security for SSRF/malicious input |
| Provider rejection, failed or stalled job | Support | Generation + provider operations; Billing for refund mismatch |
| Trial eligibility/restoration/abuse | Support | Growth/Risk + Billing + Legal/Privacy |
| Personal-data request or disclosure gap | Privacy | Legal + Security + relevant system owner |
| Material service incident | Operations | Security/Legal where data, spend, or unauthorized access is involved |

No response-time promise is introduced by this runbook. The incident owner decides external communication from actual
impact and evidence.

## Status and changelog evidence boundary

No MCP status component was added. A component may be added only after an owner can identify a live MCP-specific health
source, monitored components, update cadence, incident owner, and evidence-backed state mapping. That live MCP-specific
health source is currently absent.

No MCP changelog entry was added. A changelog entry requires a material MCP capability or permission change that is
live, dated, and supportable. Gated code, controlled tests, a reserved migration, or a directory preparation document
is not a public release.

## Legal owner-review patch plan

**LEGAL OWNER REVIEW REQUIRED. No binding legal text was changed in Task 10.**

The current Privacy Policy provides broad service categories but predates the proposed connected-agent flow. The
current Terms and AUP govern accounts, user inputs/outputs, payment, abuse, privacy, and platform safeguards, but do not
expressly allocate connected-agent authority or responsibility. Legal may decide that existing language is sufficient,
but that decision needs an **approved sufficiency rationale**. The following patch is deliberately not applied:

| Locale | Privacy owner file | Terms owner file | Required review before a patch |
| --- | --- | --- | --- |
| English | `frontend/app/(core)/legal/privacy/_components/PrivacyArticleEn.tsx` | `frontend/app/(core)/legal/terms/_components/TermsArticleEn.tsx` | Review connected-client permissions/data, connected-agent authority and responsibility, spending/confirmation, host/provider processing, revocation, and retention. |
| French | `frontend/app/(core)/legal/privacy/_components/PrivacyArticleFr.tsx` | `frontend/app/(core)/legal/terms/_components/TermsArticleFr.tsx` | Native legal review of the same approved meaning; do not translate an unapproved English draft. |
| Spanish | `frontend/app/(core)/legal/privacy/_components/PrivacyArticleEs.tsx` | `frontend/app/(core)/legal/terms/_components/TermsArticleEs.tsx` | Native legal review of the same approved meaning; do not translate an unapproved English draft. |

Acceptable-use candidate owner: `frontend/app/(core)/legal/acceptable-use/page.tsx` (re-exported by the localized
`legal/acceptable-use/page.tsx`). Legal/Risk must decide whether automated abuse, trial circumvention, excessive
polling, and credential sharing need explicit prohibitions or are already sufficiently covered.

Owner decisions required before editing any legal document:

1. whether current Terms already allocate connected-agent authority and responsibility for user-directed agent actions,
   or which narrow amendment is required;
2. whether preparing a quote creates no spending authority, which explicit quote and confirmation action authorizes
   wallet spending, and how idempotency, limits, refunds, and disputed agent actions are allocated;
3. whether MCP revocation ends only future access or also changes pending jobs, receipts, media, retention, or deletion;
4. how MaxVideoAI Terms interact with third-party host terms and whether host instructions/approvals can bind the user;
5. controller/processor roles for the connected host, MaxVideoAI, each inference provider, and storage/auth vendors;
6. lawful basis and purpose for OAuth identifiers, security logs, audit events, attribution, and trial-risk processing;
7. exact retention period and deletion mechanism for grants/bindings, audit/funnel data, quotes, uploads/references,
   generated media, jobs, receipts, and security exceptions;
8. provider/subprocessor names, regions, transfers, and notice requirements;
9. legal-document version, effective date, re-consent mode, grace period, and native-language sign-off.

After approval, follow the existing legal-document rollout guide; do not silently change effective meaning or skip
version/re-consent handling.
