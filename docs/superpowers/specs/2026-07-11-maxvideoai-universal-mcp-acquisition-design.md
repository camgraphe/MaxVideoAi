# MaxVideoAI Universal MCP Acquisition Design

## Status

Validated conversational design, ready for written review before implementation planning.

This document contains no delivery dates. It defines scope, architecture, safety, acquisition, SEO/GEO, measurement, and release gates.

## Objective

Build a universal remote MCP integration that lets Codex, Claude, and other compatible agents help a person turn a creative brief into prompts, reference images, model recommendations, confirmed MaxVideoAI generations, and reusable media.

The primary business objective is acquisition. The primary success metric is the percentage of users who complete the free MCP trial and then fund their MaxVideoAI wallet.

## Product Positioning

Primary proposition:

> Create AI videos and reference images from Codex or Claude. Compare models, see the exact price, and confirm before you spend.

The integration should make MaxVideoAI the execution and model-decision layer for creative agents:

- the host agent clarifies the brief, drafts and improves prompts, proposes references, and reasons about iterations;
- MaxVideoAI supplies accurate model capabilities, recommendations, pricing, execution, billing, persistence, and media access;
- no additional server-side LLM is required merely to rewrite prompts;
- image models available through MaxVideoAI can generate references that are then reused by video models through stable media asset identifiers.

## Validated Product Decisions

- Acquisition through Codex, Claude, and other MCP clients is the primary goal.
- The first distribution is a universal MCP available from the MaxVideoAI website, not an OpenAI-only plugin.
- OAuth is required as soon as the MCP is connected.
- Signup may use Google OAuth or verified email.
- The free trial is a separate entitlement, not wallet money.
- The trial provides one Dreamina Seedance 2.0 Mini text-to-video generation.
- The trial preset is 5 seconds, 480p, with `16:9`, `9:16`, or `1:1` output and audio available at no additional charge.
- Paid users may use every public video and image model compatible with the MCP contract.
- The first release supports text-to-video, text-to-image, image-to-video, image-to-image, and image-reference workflows.
- Source-video editing, video extension, and audio-reference uploads are outside the first release.
- References may come from the MaxVideoAI library, an allowed HTTPS URL, or a secure MaxVideoAI upload handoff.
- Each paid generation requires a prepared quote followed by a separate confirmation call.
- Wallet funding stays on MaxVideoAI through a prefilled handoff URL; the MCP does not take payment.
- Model recommendation is part of the first release.
- The primary KPI is completed trial to wallet funding.

## Non-Goals

- A general-purpose public REST API, API keys, SDKs, and customer webhooks.
- Direct Stripe checkout or payment-data collection through MCP tools.
- Studio project, timeline, sequence, or export control.
- Source-video and audio-file transfer in the initial contract.
- Exposing hidden, admin-only, lab-only, or disabled engines.
- Automatically publishing a plugin in the OpenAI directory before the universal integration is validated.
- Creating large numbers of programmatic SEO pages for minor MCP query variants.

## Architecture

### Public surfaces

Separate the indexable acquisition page from the protocol endpoint:

```text
https://maxvideoai.com/mcp          Public, indexable acquisition page
https://api.maxvideoai.com/mcp      Remote MCP Streamable HTTP endpoint
https://maxvideoai.com/oauth/consent OAuth consent UI
```

The API subdomain may route to the existing Vercel application or a focused deployment, but the protocol contract must not depend on browser cookies, marketing rendering, or client-side state.

### Component boundaries

```text
Codex / Claude / compatible MCP host
                  |
                  v
       Streamable HTTP transport
                  |
                  v
          MCP tool adapter
                  |
                  v
       MaxVideoAI agent facade
          /       |       \
         v        v        v
   generation   wallet   jobs/media
         |
         v
 existing providers and persistence
```

1. **MCP transport** owns protocol negotiation, authentication challenges, request correlation, structured MCP responses, and transport-safe errors.
2. **MCP adapter** owns tool schemas, descriptions, safety annotations, input normalization, and mapping to the agent facade.
3. **Agent facade** owns stable product-level operations that do not depend on MCP. It is a future API boundary without being a public API in the first release.
4. **Existing domain services** remain authoritative for engine availability, validation, pricing, wallet charging, provider submission, jobs, refunds, and media persistence.

The MCP must not query application tables or call providers directly from tool handlers.

### Incremental integration

The image generation route already delegates to focused server services and accepts Bearer authentication. The video route has strong route-local helpers but still owns browser-route orchestration. Extract only the video submission boundary needed by both the route and agent facade. Do not perform a general rewrite of generation, workspace state, or provider routing.

Existing web routes should move onto the facade only where sharing prevents price, validation, or billing drift. This is an incremental migration, not a big-bang API rewrite.

### Asynchronous execution

The MCP endpoint remains stateless and does not hold a connection open for provider completion.

```text
prepare quote -> confirm -> accepted jobId -> poll status -> return resource links
```

Generation tools return after the provider submission is accepted. `get_generation_status` and `list_recent_generations` recover state across conversations and clients.

## Authentication and Authorization

### OAuth architecture

Use Supabase Auth's OAuth 2.1 authorization-code flow with PKCE, OAuth discovery, and dynamic client registration for MCP-compatible hosts.

Required surfaces include:

- OAuth authorization-server discovery exposed by Supabase;
- protected-resource metadata for `https://api.maxvideoai.com/mcp`;
- an MCP `WWW-Authenticate` challenge pointing clients to that metadata;
- a MaxVideoAI consent page that preserves login return state;
- a revocation surface in MaxVideoAI account settings.

Supabase OAuth 2.1 Server is currently beta. All Supabase-specific discovery, consent, token validation, and client-claim handling must sit behind a focused authentication adapter. The rest of the agent facade consumes a normalized authenticated principal:

```ts
type AgentPrincipal = {
  userId: string;
  clientId: string | null;
  emailVerified: boolean;
  authMethod: 'oauth';
};
```

The facade must not authorize from user-editable metadata. Account restrictions and ownership checks remain server-enforced.

### Capability control

The consent page clearly states that the connected agent may:

- read the public model catalog and private account balance;
- read the user's MaxVideoAI media library;
- create upload handoffs;
- prepare quotes;
- create media only after the confirmation step.

OAuth identity scopes alone do not grant database access. Every facade operation performs its own authorization and ownership checks. The OAuth `client_id` is recorded for attribution and risk controls, not treated as proof that an action is safe.

## Agent-Orchestrated Creative Workflow

The MCP server instructions guide the host agent through this default workflow:

1. Clarify output goal, platform, ratio, visual style, subject, action, audio intent, budget, and speed constraints when missing.
2. Draft or improve the prompt in the host model.
3. Call `recommend_models` when the user has not explicitly selected a model or when the requested settings are incompatible.
4. If useful, generate one or more reference images through the paid image workflow.
5. Use returned `assetId` values in the video request.
6. Call `prepare_generation` and show the exact model, settings, references, price, balance effect, and whether the trial applies.
7. Wait for explicit approval before calling `confirm_generation`.
8. Poll the accepted job at a bounded interval.
9. Present the result and offer a deliberate next iteration rather than automatically spending again.

The server may expose read-only model and prompting resources such as `maxvideoai://models/{engineId}`. Core operation must not depend on optional MCP prompt-template support because host support varies.

## MCP Tool Contract

### `get_account_status`

Read-only. Returns user identity summary, verified-email status, wallet balance and currency, trial eligibility/status, MCP spending guardrails, and a MaxVideoAI account URL.

It never returns payment details, tokens, internal fraud signals, or raw account metadata.

### `list_models`

Read-only. Filters public engines by `video` or `image`, input mode, reference support, audio, aspect ratio, duration, resolution, availability, and optional budget hints.

Returns stable engine identifiers, visible labels, supported modes and parameters, availability, capability summaries, and catalog freshness. Hidden, disabled, admin-only, and unsupported engines are filtered server-side regardless of tool arguments.

### `recommend_models`

Read-only. Accepts structured creative constraints and returns a small ranked shortlist with reasons, trade-offs, supported modes, and the next best action.

Recommendation uses MaxVideoAI's current catalog, pricing capabilities, model-family data, and curated use-case evidence. It does not invent model capabilities or make an exact price claim before `prepare_generation`.

### `list_media`

Read-only and user-scoped. Lists reusable image references and recent generated outputs with pagination. Returns asset identifiers, preview URLs, media kind, dimensions, creation time, and safe provenance labels.

### `create_reference_upload_link`

Creates a short-lived, single-user upload handoff for local image files. The returned MaxVideoAI URL lets the user upload an image, validates and stores it, and makes the resulting asset discoverable through `list_media`.

The first release accepts reference images only. It does not accept arbitrary documents, source videos, or audio.

### `prepare_generation`

Read-only with respect to billing and providers. It validates a canonical request and persists a short-lived, server-owned quote.

Input includes:

- surface: `video` or `image`;
- public engine identifier;
- supported generation mode;
- prompt;
- engine-supported settings;
- references expressed as MaxVideoAI asset identifiers or allowed HTTPS URLs.

Output includes:

- opaque quote identifier and expiration;
- normalized immutable request summary;
- model and settings;
- reference summary;
- exact price and currency;
- current balance and projected balance;
- trial status when applicable;
- incompatibilities and safe alternatives;
- whether a wallet top-up is required.

The quote stores the canonical request server-side. The confirmation call cannot replace the prompt, model, settings, or references.

### `confirm_generation`

Side-effecting, additive, and externally billed when the quote is paid. Accepts only the quote identifier plus an explicit confirmation field. It atomically claims the quote, reserves the trial or wallet charge, creates the initial job, and submits to the selected provider.

Repeated calls with the same quote are idempotent and return the same accepted job or terminal result. Expired, consumed, mismatched, or unauthorized quotes fail without charging.

The two-call protocol prevents a single accidental generation call. It cannot prove a human clicked approval when a host has deliberately enabled automatic tool approval. Therefore:

- the tool must carry accurate MCP safety annotations;
- server instructions require the agent to display the quote and wait;
- the account exposes MCP spending limits;
- requests above configured limits require a MaxVideoAI web approval handoff;
- no documentation may claim that server-side code can override a user's host-level auto-approval choice.

### `get_generation_status`

Read-only and user-scoped. Returns normalized status, progress, provider-safe message, price, refund/trial restoration status, result metadata, and resource links when complete.

Images may be returned as image content when payload size is safe. Videos and larger artifacts use resource links and HTTPS preview/download URLs rather than embedding base64 in model context.

### `list_recent_generations`

Read-only and user-scoped. Recovers recent jobs across devices or conversations with filters for surface and status.

### `create_topup_link`

Creates a short-lived MaxVideoAI billing handoff that preserves the pending generation intent. It does not create a Stripe payment or transmit payment information through MCP.

After the wallet is funded, the user or agent prepares a fresh quote so price and balance cannot be stale.

## Reference-Image Flow

Support three interoperable reference sources:

1. Existing MaxVideoAI `assetId`.
2. Allowed HTTPS URL that passes URL, host, redirect, MIME, size, and image decoding validation.
3. Secure MaxVideoAI upload handoff for a local image.

Do not make raw base64 image input the primary path. It increases request size, duplicates storage logic, and behaves inconsistently across hosts and serverless limits.

Remote references are copied or normalized through existing MaxVideoAI media infrastructure before provider submission when required. Tool handlers never allow arbitrary server-side fetches to private networks, metadata services, loopback addresses, or unsupported redirects.

## Trial Entitlement

The trial is a non-monetary entitlement with a single-use state machine:

```text
available -> reserved -> consumed
                    \-> released
```

Eligibility requires:

- authenticated OAuth principal;
- verified email, including Google-authenticated accounts;
- no previously consumed trial for the user;
- no active account restriction;
- acceptable rate and risk checks.

The server, not the tool input, forces:

- engine: Dreamina Seedance 2.0 Mini;
- mode: text-to-video;
- duration: 5 seconds;
- resolution: 480p;
- ratio: `16:9`, `9:16`, or `1:1`;
- audio: user-selectable because it does not change the current public price;
- one output.

The entitlement is reserved atomically with the accepted quote. It is released if submission fails before provider acceptance or if the job reaches a qualifying terminal failure. A completed result consumes it permanently.

Use privacy-preserving anti-abuse signals in addition to the unique user constraint. Raw IP addresses, prompts, and reference URLs must not be copied into analytics events.

## Quote, Charge, and Job Consistency

A quote is an opaque, one-time, server-owned record. It includes:

- user and OAuth client ownership;
- canonical request payload and request hash;
- engine catalog revision;
- price and currency snapshot;
- trial or wallet funding mode;
- creation and expiration timestamps;
- state: `prepared`, `claimed`, `accepted`, `failed`, or `expired`;
- resulting job identifier when claimed.

Confirmation executes inside the narrowest practical database transaction:

1. lock and validate quote;
2. validate account and entitlement again;
3. reserve trial or wallet charge;
4. create the initial idempotent job;
5. mark quote claimed with the job identifier;
6. commit;
7. submit to the provider;
8. apply existing rollback/refund behavior on rejection or failure.

The provider call itself must not be held inside a database transaction.

## Persistence

Application database changes belong in `neon/migrations`, not Supabase migrations.

Introduce focused persistence for:

### MCP trial entitlements

- unique user ownership;
- entitlement status;
- reserved quote and resulting job;
- created, reserved, released, and consumed timestamps;
- reason codes without sensitive prompt content.

### MCP generation quotes

- opaque identifier;
- user and client ownership;
- canonical request and hash;
- pricing snapshot;
- funding mode;
- state and expiration;
- idempotent resulting job link.

### MCP audit and funnel events

- event type;
- user and OAuth client identifiers;
- quote/job identifiers when applicable;
- tool name, outcome, engine, surface, price, currency, and coarse error code;
- acquisition source metadata;
- no raw prompt, access token, full reference URL, payment data, or provider secret.

If existing audit/event infrastructure can satisfy the contract without mixing unrelated concerns, reuse it instead of creating a redundant table.

## Safety and Security

- Validate every OAuth access token and derive the user server-side.
- Re-run current account-restriction checks for quote preparation and confirmation.
- Enforce engine, mode, duration, resolution, reference, and output limits server-side.
- Keep provider credentials and routing details out of MCP results.
- Apply per-user, per-client, and risk-aware rate limits to discovery, uploads, quote creation, confirmation, and polling.
- Bound polling frequency and return `retryAfterSeconds`.
- Protect against quote replay, concurrent confirmation, stale pricing, and duplicate wallet charges.
- Validate remote references against SSRF and decompression-bomb risks.
- Keep media private by default and use controlled resource links or signed URLs where appropriate.
- Annotate every tool accurately as read-only, destructive/non-destructive, and open-world/closed-world.
- Never let tool descriptions imply that generated content is automatically safe for publication or commercial use.
- Provide OAuth revocation and an MCP activity history in account settings.
- Apply conservative cache and `Cache-Control: private, no-store` behavior to authenticated MCP, quote, account, and media responses.

## Error Contract

Expected product errors are returned as structured tool execution errors with a stable code, recoverable explanation, and recommended next action.

Core codes include:

- `AUTH_REQUIRED`
- `EMAIL_VERIFICATION_REQUIRED`
- `ACCOUNT_RESTRICTED`
- `TRIAL_NOT_ELIGIBLE`
- `ENGINE_UNAVAILABLE`
- `MODE_UNSUPPORTED`
- `PARAMETER_INVALID`
- `REFERENCE_REQUIRED`
- `REFERENCE_INVALID`
- `QUOTE_EXPIRED`
- `QUOTE_ALREADY_CLAIMED`
- `CONFIRMATION_REQUIRED`
- `SPENDING_LIMIT_EXCEEDED`
- `INSUFFICIENT_FUNDS`
- `RATE_LIMITED`
- `PROVIDER_REJECTED`
- `JOB_FAILED`

Errors must not expose stack traces, SQL, provider secrets, internal account-risk signals, or raw upstream responses. Recoverable errors include structured alternatives such as supported ratios, compatible models, a fresh-quote action, or a top-up URL.

## SEO and GEO Strategy

### Canonical intent ownership

- `/mcp`: product and installation hub for MaxVideoAI MCP.
- `/integrations/codex`: Codex-specific connection and workflow guide.
- `/integrations/claude`: Claude-specific connection and workflow guide.
- `/docs/mcp`: technical tool, security, reference, and troubleshooting documentation.

Do not create separate indexable pages for trivial phrasing variants. Add additional workflow pages only after GSC, referral, community, or conversion evidence demonstrates a distinct intent.

### Market priority

English is the initial content and testing priority. Current GSC data shows approximately half of impressions coming from the United States with materially weaker CTR than France and Spain. Core FR/ES localization may follow using the existing localized route architecture, but translation alone is not a reason to create every supporting article.

### Page requirements

Each MCP acquisition page must be:

- server-rendered and cacheable;
- self-canonical with correct hreflang when localized;
- present in the appropriate sitemap only when complete and indexable;
- linked from relevant product, docs, pay-as-you-go, examples, and footer surfaces without sitewide over-optimization;
- written with direct, factual answers and visible last-updated information;
- supported by real screenshots or videos showing brief, reference generation, quote, confirmation, and final output;
- explicit about supported clients, models, trial restrictions, pricing, privacy, and limitations;
- free of unverified API, webhook, team, shared-wallet, or workflow claims.

Use `SoftwareApplication` or `WebApplication` structured data only when visible copy and offers match exactly. Reuse the canonical MaxVideoAI `Organization` identity. Do not invent ratings, reviews, prices, or unavailable integrations. Do not rely on commercial `FAQPage` or retired `HowTo` rich-result markup.

### GEO and agent discoverability

- Add the public MCP hub and technical documentation to `frontend/public/llms.txt` after launch readiness.
- Keep public landing and documentation pages accessible to approved search/answer crawlers.
- Keep authenticated and protocol endpoints out of sitemaps and search indexing.
- Write self-contained factual passages that explain what the MCP does, which models are available, how confirmation works, and how trial eligibility works.
- Publish real outputs, exact settings, test dates, and costs as original evidence.
- Give every tool a narrow `Use this when...` description and explicit negative cases.
- Maintain a labelled prompt set covering direct invocation, indirect creative intent, and cases where MaxVideoAI should not be selected.
- Track tool-selection precision and recall separately for Codex, Claude, and other hosts.

### Credibility cleanup

Before public promotion, reconcile the existing Docs feature flags and copy with reality. Current documentation includes API, webhook, shared-wallet, team-role, invoice, and brand-workflow claims that are not uniformly supported by the product. The MCP launch must not amplify those contradictions.

## Marketing and Distribution

### Acquisition page

The MCP landing page should show:

1. a concise promise;
2. supported clients;
3. a real end-to-end demo;
4. Connect with Codex and Connect with Claude instructions;
5. the free Seedance Mini trial contract;
6. model choice and exact-price confirmation;
7. reference-image workflows;
8. privacy, permissions, revocation, and spending controls;
9. a compact supported-tool list;
10. troubleshooting and support links.

Avoid claiming one-click installation until a client-specific deep link is verified. Provide copyable endpoint configuration and platform-specific instructions as the universal fallback.

### Distribution sequence

1. Validate the MCP from the MaxVideoAI website with controlled users.
2. Publish universal setup documentation and a verifiable public configuration example.
3. Add reputable MCP directories where submission terms and ownership verification are acceptable.
4. Publish result-driven demonstrations on YouTube and relevant communities without synthetic testimonials or promotional spam.
5. Apply to the OpenAI plugin directory after tool metadata, OAuth, negative tests, privacy materials, and support operations are stable.
6. Evaluate other client directories independently rather than assuming one listing distributes everywhere.

## Measurement

### Primary funnel

```text
MCP landing visit
-> OAuth connection
-> verified account
-> trial quote prepared
-> trial generation accepted
-> trial generation completed
-> wallet top-up
-> first paid generation
-> repeat MCP generation
```

Primary KPI:

```text
completed trial users who fund the wallet / all completed trial users
```

Secondary measures:

- MCP landing CTR and organic queries;
- OAuth connection and account-creation rate;
- trial eligibility, preparation, acceptance, completion, restoration, and abuse-block rate;
- time and drop-off between each funnel stage;
- first paid generation and repeat generation;
- revenue and provider cost by MCP-acquired cohort;
- Codex, Claude, and other-client split;
- recommendation-to-quote and quote-to-confirmation rate;
- tool errors and model-selection precision;
- top-up handoff completion;
- support and OAuth revocation rate.

Server-side product events are the authoritative MCP funnel ledger. GA4 and GSC remain useful for landing-page acquisition but must not be the only source for OAuth, quote, trial, wallet, or generation events. Prompts and private references are excluded from analytics payloads.

## Testing Strategy

### Contract and unit tests

- OAuth principal normalization for verified email and Google-authenticated accounts.
- Bearer-token support shared by video, image, wallet, job, and media facade operations.
- Public-engine filtering and hidden/admin/disabled-engine rejection.
- Recommendation output constrained to real capabilities.
- Quote canonicalization, hashing, expiration, immutability, ownership, and idempotency.
- Concurrent quote confirmation permits only one trial reservation or wallet charge.
- Trial state transitions and restoration on qualifying failures.
- Wallet insufficient-funds and spending-limit behavior.
- Reference asset ownership and HTTPS/SSRF/MIME/size validation.
- Upload handoff expiration and single-user ownership.
- Job status ownership and bounded polling guidance.
- MCP structured results, safety annotations, and stable error codes.
- Audit events exclude prompts, secrets, and raw reference URLs.

### Integration tests

- OAuth discovery, dynamic registration, consent, token exchange, refresh, and revocation in a non-production Supabase project.
- End-to-end free Seedance Mini flow without wallet mutation.
- End-to-end paid image and video flows using wallet accounting.
- Image generation followed by reference reuse in a video quote.
- Provider rejection, job failure, wallet refund, and trial restoration.
- Top-up handoff preserves intent and forces a fresh quote after funding.
- Streamable HTTP behavior through the actual Vercel/custom-domain topology.

### Host compatibility

- Codex desktop/CLI/IDE remote MCP connection and OAuth.
- Claude-compatible remote MCP connection and OAuth.
- Model discovery, recommendation, quoting, confirmation, polling, image result display, and video resource links in each host.
- Local-image handoff behavior when the host cannot forward an attachment directly.
- Negative prompts where the host should not invoke MaxVideoAI.

### SEO/GEO verification

- canonical, hreflang, JSON-LD, sitemap, robots, and `llms.txt` contracts;
- server-rendered primary copy without authentication or client JavaScript;
- no API or private MCP URL in sitemaps;
- public pages return indexable 200 responses and the endpoint returns private/no-store responses;
- labelled direct, indirect, and negative tool-selection prompt suite;
- post-deployment GSC inspection and query ownership review.

## Operational Requirements

- Dashboard for OAuth connections, tool calls, quotes, trials, costs, errors, top-up conversions, and client split.
- Alerts for abnormal trial creation, quote confirmation, provider cost, repeated polling, and error rates.
- Ability to disable the trial independently from paid MCP generation.
- Ability to disable individual engines or modes through the existing engine controls.
- Versioned tool contracts and additive schema evolution whenever possible.
- Public changelog for material MCP capability or permission changes.
- Support runbook for OAuth, quote, upload, billing, and provider failures.
- Privacy and acceptable-use documentation updated before broad promotion.

## Implementation Decomposition

This design is intentionally broader than one implementation batch. Planning and execution should be split into independently reviewable sub-projects that preserve the same contracts:

### Sub-project 1: MCP foundation, OAuth, and read-only discovery

Deliver the API subdomain/transport, protected-resource discovery, Supabase OAuth adapter, consent return flow, normalized principal, `get_account_status`, `list_models`, `recommend_models`, tool metadata, audit skeleton, and Codex/Claude connection tests. No provider submission or wallet mutation is enabled in this sub-project.

### Sub-project 2: Immutable quotes and paid generation facade

Deliver shared video/image request validation, quote persistence, spending limits, `prepare_generation`, `confirm_generation`, wallet reservation, asynchronous job acceptance, status polling, recent jobs, refunds, and paid media results. Trial entitlements remain disabled.

### Sub-project 3: Free Seedance Mini acquisition trial

Deliver verified-email eligibility, the separate entitlement state machine, atomic reservation, fixed preset enforcement, failure restoration, anti-abuse controls, trial analytics, and an independent kill switch.

### Sub-project 4: Reference-image and media workflow

Deliver private media listing, image ownership checks, secure upload handoffs, allowed HTTPS reference ingestion, generated-image-to-video asset reuse, resource links, and host compatibility tests for local-file handoff.

### Sub-project 5: Acquisition, SEO/GEO, documentation, and operations

Deliver the four canonical public content owners, install instructions, real demos, `llms.txt` and sitemap integration, documentation credibility cleanup, funnel dashboards, support runbooks, distribution assets, and public-promotion gates.

Each sub-project must leave production in a coherent state and may remain disabled behind independent feature flags until its release gates pass. Implementation plans should not mix unrelated Studio, provider, SEO cleanup, or workspace refactors into these workstreams.

## Release Gates

The universal MCP is ready for public promotion only when:

- OAuth works in both Codex and Claude-compatible hosts;
- email and Google signup return correctly to consent;
- every side-effecting tool has accurate annotations and audit coverage;
- quote confirmation is immutable, idempotent, and protected by spending limits;
- the free trial cannot create duplicate wallet credit or duplicate entitlements;
- paid image and video accounting matches the existing web application;
- reference upload and reuse work without client-specific attachment assumptions;
- provider failures restore funds or trial entitlement as designed;
- landing, docs, privacy, terms, and support content describe only live capabilities;
- funnel measurement can distinguish landing, OAuth, trial, top-up, and paid generation;
- public pages pass canonical, hreflang, sitemap, robots, `llms.txt`, and structured-data checks;
- an operational kill switch exists for trial, paid MCP generation, and individual tools.

## Risks and Mitigations

### Supabase OAuth beta

Mitigation: isolate it behind an adapter, test discovery and refresh flows against a non-production project, use asymmetric signing keys where required, and avoid coupling business authorization to provider-specific token details.

### Trial abuse

Mitigation: verified identity, one entitlement per user, existing account restrictions, privacy-preserving risk signals, strict preset enforcement, rate limits, and a trial kill switch.

### Accidental spending

Mitigation: immutable quote, separate confirmation tool, accurate annotations, user-configured spending caps, web approval above the cap, idempotency, and visible projected balance.

### Client differences for file input

Mitigation: library asset identifiers, allowed HTTPS URLs, and a MaxVideoAI upload handoff instead of depending on attachment forwarding or large base64 arguments.

### Catalog and pricing drift

Mitigation: facade reads current server-side engine and pricing sources, quotes expire, paid confirmation revalidates, and exact prices are not emitted by recommendation alone.

### Serverless transport limits

Mitigation: stateless Streamable HTTP, asynchronous jobs, small structured responses, resource links for large media, and bounded polling.

### SEO dilution

Mitigation: four canonical intent owners, English-first evidence, no automatic page matrix, no indexation of protocol/private URLs, and additional content only after demonstrated demand.

### Credibility mismatch

Mitigation: audit and correct existing API/webhook/team claims before launch, publish real demos and limitations, and keep metadata synchronized with live tool behavior.

## Source References

- MCP resources and binary content: https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- MCP TypeScript server patterns: https://ts.sdk.modelcontextprotocol.io/documents/server.html
- Supabase OAuth 2.1 server: https://supabase.com/docs/guides/auth/oauth-server
- Supabase MCP authentication: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- Supabase OAuth getting started: https://supabase.com/docs/guides/auth/oauth-server/getting-started
- Existing MaxVideoAI SEO audit: `FULL-AUDIT-REPORT.md`
- Existing MaxVideoAI SEO action plan: `ACTION-PLAN.md`
