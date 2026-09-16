# MaxVideoAI MCP support and disclosure readiness

Checked: 2026-09-16
Readiness: **DIRECT PRODUCTION RELEASE LIVE**

This runbook is the support and disclosure boundary for the MaxVideoAI MCP production release. It is not a directory
approval or a legal policy. Production registers fourteen model-visible tools plus one app-only helper, the
download-refresh helper listed separately below. Marketing, indexation, transport, OAuth, discovery, paid generation, and reference uploads are approved
for direct first-party publication. The promotional trial remains disabled: users must sign in and use their MaxVideoAI
credit balance before confirming a paid generation.

| Tool profile | Exact tool inventory |
| --- | --- |
| Default discovery | `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget` |
| Production model-visible tools | `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget`, `list_media`, `create_reference_upload_link`, `import_reference_files`, `prepare_generation`, `confirm_generation`, `get_generation_status`, `list_recent_generations`, `present_generation`, `create_topup_link` |
| App-only helper | `get_generation_download` |

The current inventory is checked in and covered by local contracts. The dated
hosted staging revision in the host compatibility matrix predates
`import_reference_files`; its Claude Desktop and Codex CLI evidence therefore
covers the previous 13-tool profile rather than the later direct-file path.

## Authoritative checked-in state

| Publication flag | Value | Support consequence |
| --- | --- | --- |
| `publicMarketing` | true | The owned-site MCP and integration pages are part of the production release. |
| `publicIndexing` | true | Canonical localized MCP pages may be crawled and included in sitemaps. |
| `transport` | true | The canonical production resource is `https://api.maxvideoai.com/mcp`. |
| `oauth` | true | Users connect a MaxVideoAI account through the OAuth consent flow. |
| `discovery` | true | Account, model, recommendation, and budgeting tools are public. |
| `paidGeneration` | true | Exact quotes and explicitly confirmed wallet-funded generations are public. |
| `trial` | false | No promotional MCP trial is available. |
| `referenceUploads` | true | Private reference-upload handoffs are public and use the production storage namespace. |
| `montagePreparation` | false | Montage preparation remains unpublished and absent from default tool discovery. |
| `audioGeneration` | false | Paid Audio generation remains unpublished pending qualification. |
| `studioMontageCreation` | false | Persisted Studio montage creation remains unpublished pending qualification. |

Dated host evidence and remaining checkpoints:

- migration files 30–37 are present locally; the hosted application used quote,
  media, recovery, and handoff paths, but a sanitized schema/admin reconciliation
  is still required;
- the 2026-08-27 production checkpoint records one explicitly approved paid
  confirmation, completed generation, library save, and recovery path through
  Codex CLI 0.150.0-alpha.8; this is not evidence for every host or client
  version;
- the earlier 2026-08-26 staging checkpoint observed a completed provider
  result and library recovery but did not perform a fresh provider submission,
  charge/refund reconciliation, or uploaded file;
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
observable from the default five-tool discovery registry**. Some require
model-visible tools beyond that default discovery profile. Do not tell a user
that a specific code occurred unless the live tool actually returned it.

## Support decision trees

### OAuth connection and consent

Availability: production OAuth is live. A 401 starts protected-resource
discovery and browser authorization; denial leaves protected tools unavailable.
The compatibility matrix remains the owner of dated host evidence and limits.

1. If the client receives HTTP 401 / JSON-RPC `-32001`, let it follow protected-resource discovery and open browser
   authorization. Never paste a token into the endpoint URL.
2. If consent is denied, leave the connection unauthenticated; do not describe denial as a product failure.
3. The intended least-privilege scopes are `openid,email,profile`. Stop or deny any consent that requests additional
   access. Host-specific refresh, logout, and reconnect behavior requires its
   own recorded checkpoint; do not generalize one host's behavior to another.
4. If consent completes but the protected call still fails, capture the client/version, UTC time, and correlation ID,
   then escalate to Auth + MCP engineering. Do not repeatedly reauthorize.
5. The matrix's Claude Desktop 1.37937.1 and Codex CLI 0.149.0-alpha.4.3
   records are controlled staging evidence, and its Codex CLI 0.150.0-alpha.8
   record is a production checkpoint. Treat every unrecorded host or version as
   unverified.

### Email verification

Availability: `get_account_status` reports the connected account state.

1. If account status is unverified, send the user to the MaxVideoAI web account verification flow.
2. Do not bypass verification, manually toggle entitlement state, or accept an emailed identity document in support.
3. If `EMAIL_VERIFICATION_REQUIRED` is returned, treat it as the service's
   verification requirement; support must not work around it.
4. If verification is complete in the web account but remains stale after a fresh connection, escalate to Auth.

### Quote expiry

Availability: `prepare_generation` is public and creates no job or debit.

1. When `QUOTE_EXPIRED` is returned, require a fresh server-priced quote. Never extend an expired quote or
   reuse a displayed amount.
2. If funding happened after a quote was prepared, require a fresh quote so model availability, price, and balance are
   current.
3. Repeated expiry after immediate preparation belongs to Pricing + MCP engineering with opaque quote and correlation
   IDs only, never the prompt or raw request body.

### Generation confirmation and recovery

Availability: `confirm_generation` is public only after explicit user approval.

1. Confirm only the exact fresh quote the user explicitly approved. Never infer approval from a host's general tool
   permission or an earlier quote.
2. If confirmation times out or the caller loses context, recover through `list_recent_generations` and
   `get_generation_status`. Never advise a duplicate `confirm_generation` call.
3. Preserve the opaque quote, job, and correlation identifiers needed for recovery, not the prompt, raw request, or
   credentials.

### Insufficient funds

Availability: `create_topup_link` returns a first-party billing handoff; card
data stays outside chat.

1. For `INSUFFICIENT_FUNDS`, use `create_topup_link` or direct the user to the
   MaxVideoAI Billing surface. Do not collect payment details in chat.
2. Do not claim that a top-up happened until the first-party billing flow and a
   fresh `get_account_status` read are authoritative.
3. After funding, prepare a fresh quote; do not retry a stale confirmation.
4. Escalate wallet/receipt mismatches to Billing with receipt ID, amount, currency, and UTC time only.

### Spending limit

Availability: `prepare_generation` creates no job or debit, and
`confirm_generation` requires explicit approval for the quoted generation.

1. Treat a null limit as “no connected spending capability,” not as unlimited spending.
2. `SPENDING_LIMIT_EXCEEDED` must stop confirmation and use the server-provided web approval or settings action when
   available.
3. Host auto-approval never overrides server quote confirmation, idempotency, or account limits.
4. Do not raise a limit from a support ticket without the authenticated account-control flow and Billing approval.

### Upload handoff

Availability: `list_media`, `import_reference_files`, and
`create_reference_upload_link` are public. Private assets remain scoped to the
connected account.

1. Use `import_reference_files` only with user-authorized host file handles.
   Never invent a URL or pass a raw local path, base64 file, or credential into
   MCP.
2. The direct tool imports up to eight files. Preserve successful `assetId`
   values and retry only failed inputs; no `list_media` call is needed after a
   successful direct import.
3. The handoff is short-lived, user-scoped, and selects the requested image,
   video, or audio kind. A compatible host may render its in-chat importer. The
   first-party browser page remains the manual fallback.
4. Use a host-specific helper or attachment path only where its compatibility
   record says it is supported. Do not generalize file handling across hosts.
5. A handoff alone is not proof that bytes were uploaded. Claim completion only
   from the returned asset ID or a subsequent browser-fallback `list_media` result.

### Reference validation

Availability: private account-scoped reference listing and ingestion are public
through `list_media`, `import_reference_files`, and
`create_reference_upload_link`. Existing Audio may be used as a reference where
supported; paid Audio generation and montage creation remain unpublished.

1. Do not send an arbitrary URL to a provider or fetch loopback, private-network, metadata-service, redirected, or
   unsupported content.
2. A future `REFERENCE_INVALID` response should identify a safe corrective category (ownership, type, size, decoding,
   URL policy, or expiry) without echoing the private URL.
3. If the selected mode requires a reference, a future flow may return `REFERENCE_REQUIRED`; the current registry does
   not.
4. Suspected malicious files or SSRF attempts go to Security; content-policy failures go to Trust + Safety.

### Provider rejection or job failure

Availability: a user-approved `confirm_generation` can submit a paid job, and
`get_generation_status` and `list_recent_generations` are public recovery paths.

1. Do not manufacture `PROVIDER_REJECTED` or `JOB_FAILED` from a generic transport or web error; use only a live tool
   result.
2. Preserve the job ID, stop duplicate confirmations, and inspect the canonical job/refund state through the recovery
   tools.
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

Availability: production OAuth is live. Client-specific logout, revocation,
authentication-loss, and reconnect behavior remains limited to the dated
records in the compatibility matrix.

1. Remove or disconnect the connector in the client.
2. Revoke the grant at `/account/connections` when that gated account surface is available.
3. Verify the next protected call through the applicable host checkpoint; a
   successful 401 / JSON-RPC `-32001` requires fresh browser approval, but do
   not claim that untested hosts behave the same way.
4. If a revoked token still succeeds, treat it as a security incident: stop testing, retain sanitized timestamps and
   client ID, and escalate immediately to Security + Auth.

## Post-launch journey review

Use `/admin/mcp` as the authoritative first view of the connected-product funnel. Review aggregate behavior by
ChatGPT, Claude, Codex, and unattributed compatible clients without collecting prompts, private media URLs, access
tokens, email addresses, or provider payloads.

Read the journey in this order:

1. landing CTA to completed OAuth connection;
2. connection to model recommendation and prepared quote;
3. prepared quote to explicit generation acceptance;
4. accepted generation to completed media or a coarse failure/refund outcome;
5. first paid generation to repeat paid generation.

Use client split, quote-confirmation rate, repeat generation, refund rate,
provider cost, polling, upload failures, and coarse error codes to find the
largest drop-off. Pair the aggregate with opt-in support feedback; never
reconstruct a user prompt or private creative brief from analytics.

Improve one decision point at a time. Record the page/plugin version, client, model/mode, coarse outcome, and UTC
comparison window; change copy, tool guidance, or the workflow behind an independent release flag; then compare the
same authoritative stages. A missing aggregate stays unavailable rather than becoming a fabricated zero.

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

Migrations 33 and 38 define funnel fields for time, stage, opaque acquisition,
quote/job identifiers, coarse source/campaign/client, applicable amount/currency, idempotency key, and an irreversible
receipt hash. The **MCP funnel ledger excludes prompts, email addresses, access tokens, raw reference URLs, provider
bodies, payment details or methods, secrets, and fraud signals**. A sanitized
staging ledger reconciliation is still pending, so this remains a schema
boundary rather than a public analytics claim.

This minimization does not mean MaxVideoAI avoids content processing: the normal service still processes prompts,
inputs, outputs, and uploads when a user requests a web generation. Those service categories and the minimized MCP
analytics ledgers must be disclosed separately.

### Media and reference retention

Production MCP media listing and reference upload are available only to the
connected account. The dated controlled staging checkpoint listed private
account media and created a temporary upload handoff without uploading bytes.
The current Privacy Policy describes content processing and
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

`prepare_generation` is public and creates no job or debit. A short-lived,
server-owned quote must receive separate explicit confirmation through
`confirm_generation`; server idempotency, limits, and web approval above
configured thresholds still apply. Wallet funding remains on the MaxVideoAI web
product through Stripe via the first-party `create_topup_link` handoff. A
host’s “always allow” setting is not a substitute for MaxVideoAI confirmation.

### Provider processing

The five default discovery tools do not submit prompts or media to an inference
provider. An explicitly confirmed production generation sends the necessary
prompt, settings, and account-scoped reference assets to the selected provider
under the published Privacy Policy and current subprocessor list. Legal/Privacy
must verify that every actual provider, region, data category, onward transfer,
retention rule, and user choice is current.

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
