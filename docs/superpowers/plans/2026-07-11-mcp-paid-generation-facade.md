# MaxVideoAI MCP Paid Generation Facade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add immutable paid-generation quotes, explicit confirmation, spending controls, wallet reservation, asynchronous image/video execution, status recovery, and top-up handoff through the shared agent facade.

**Architecture:** Canonical request normalization and pricing live below both web and MCP transports. A quote stores the complete immutable request and price snapshot. Confirmation locks the quote and creates the wallet reservation plus initial job in one database transaction, then performs the provider submission outside the transaction. Existing web routes remain adapters over the same domain functions, preserving their response shapes.

**Tech Stack:** Next.js 15, TypeScript, Neon/Postgres transactions, existing pricing/wallet/job/provider services, MCP SDK tool adapters, Zod, Node test runner.

## Global Constraints

- Complete the foundation plan first; all paid tools remain behind `FEATURES.mcp.paidGeneration`.
- Trial funding remains disabled in this plan. Every accepted generation uses `fundingMode: 'wallet'`.
- `prepare_generation` never calls a provider or changes wallet balance.
- `confirm_generation` accepts only `quoteId` and `confirmed: true`; prompt, model, settings, price, references, and user ownership come from the stored quote.
- Provider network calls never run inside a database transaction.
- Concurrent confirmation of one quote creates at most one wallet charge and one initial job.
- Preserve existing web generation request/response behavior, visitor behavior, provider routing, receipts, refunds, and account restrictions.
- Do not expose provider names, upstream bodies, prompts, private URLs, tokens, or SQL in MCP results or analytics.

---

## Task 1: Define and canonicalize the paid generation contract

**Files:**

- Create: `frontend/src/server/agent-api/generation-types.ts`
- Create: `frontend/src/server/agent-api/generation-normalization.ts`
- Create: `tests/mcp-generation-normalization.test.ts`

- [ ] Write failing table-driven tests for `t2v`, `i2v`, `ref2v`, `t2i`, and `i2i`, including whitespace normalization, deterministic reference ordering, unsupported source-video/audio fields, unknown fields, excessive prompt length, and integer output count.

- [ ] Implement the narrow canonical request:

```ts
export type CanonicalGenerationRequest = {
  schemaVersion: 1;
  surface: 'video' | 'image';
  engineId: string;
  mode: 't2v' | 'i2v' | 'ref2v' | 't2i' | 'i2i';
  prompt: string;
  settings: Record<string, string | number | boolean | null>;
  references: Array<
    | { kind: 'asset'; assetId: string; role: 'source' | 'reference' | 'first_frame' | 'last_frame' }
    | { kind: 'https'; url: string; role: 'source' | 'reference' | 'first_frame' | 'last_frame' }
  >;
  outputCount: 1;
};
```

- [ ] Serialize with stable key ordering and hash `schemaVersion + canonical JSON` using SHA-256. Keep the full prompt only in the encrypted/private quote payload and never in audit events.

- [ ] Reject `v2v`, extend, retake, source video, audio reference, arbitrary provider parameters, payment mode, price, job ID, and user ID at the normalization boundary.

- [ ] Run and commit:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-generation-normalization.test.ts
git add frontend/src/server/agent-api/generation-{types,normalization}.ts tests/mcp-generation-normalization.test.ts
git commit -m "feat: define canonical MCP generation requests"
```

## Task 2: Extract reusable image estimation

**Files:**

- Create: `frontend/src/server/images/estimate-image-generation.ts`
- Modify: `frontend/app/api/images/estimate/route.ts`
- Create: `tests/image-estimate-service.test.ts`
- Modify: `tests/image-generation-server-architecture.test.ts`

- [ ] Capture representative existing estimate responses for GPT Image 2, a standard text-to-image model, image-to-image reference pricing, invalid resolution, and unsupported mode.

- [ ] Extract a transport-neutral service:

```ts
export type ImageEstimateInput = Pick<
  ImageGenerationRequest,
  'engineId' | 'mode' | 'numImages' | 'resolution' | 'quality' | 'aspectRatio'
> & {
  referenceImageCount?: number;
  referenceImageSizes?: Array<{ width: number; height: number }>;
};

export async function estimateImageGeneration(
  input: ImageEstimateInput,
): Promise<{ pricing: PricingSnapshot; normalized: ImageEstimateNormalized }>;
```

- [ ] Move validation and price computation unchanged from the route. Keep storyboard-specific pricing available to the web adapter but disallow storyboard sources from the MCP adapter.

- [ ] Make the route a JSON/parser/error adapter and add an architecture cap so it does not regain pricing logic.

- [ ] Run estimate, pricing, and image architecture tests; commit the extraction separately.

## Task 3: Make video authentication bearer-aware before sharing execution

**Files:**

- Modify: `frontend/app/api/generate/_lib/auth-idempotency.ts`
- Modify: `tests/generate-auth-idempotency.test.ts`
- Create: `tests/generate-bearer-auth.test.ts`

- [ ] Write a failing test proving `resolveGenerateUserId(req)` accepts the same Bearer token path as image generation while preserving cookie auth and local admin bypass.

- [ ] Replace the direct cookie-only `supabase.auth.getUser()` path with `getRouteAuthContext(req)`. Keep dependency injection so unit tests do not need a live Supabase project.

- [ ] Verify ownership/idempotency still keys by the derived user ID and never by a body field.

- [ ] Run focused video route contracts and commit:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-auth-idempotency.test.ts \
  tests/generate-bearer-auth.test.ts \
  tests/generate-route-context.test.ts
```

## Task 4: Extract transport-neutral job reads from the large jobs routes

**Files:**

- Create: `frontend/src/server/generations/generation-status.ts`
- Create: `frontend/src/server/generations/recent-generations.ts`
- Modify: `frontend/app/api/jobs/route.ts`
- Modify: `frontend/app/api/jobs/[jobId]/route.ts`
- Create: `tests/generation-status-service.test.ts`
- Create: `tests/recent-generations-service.test.ts`
- Create: `tests/jobs-route-delegation.test.ts`

- [ ] Capture existing authenticated route output before extraction, including video, image, accepted/running/completed/failed, refunded, and ownership mismatch cases.

- [ ] Define normalized agent DTOs that omit prompt and provider details:

```ts
type AgentGenerationStatus = {
  jobId: string;
  surface: 'video' | 'image';
  status: 'accepted' | 'running' | 'completed' | 'failed';
  progress: number | null;
  message: string | null;
  priceCents: number | null;
  currency: string | null;
  paymentStatus: string | null;
  result: AgentGenerationResult | null;
  retryAfterSeconds: number | null;
};
```

- [ ] Move user-scoped query and status normalization to server services. Keep visitor fallback and HTTP parsing in the routes. Enforce a minimum recommended polling interval of five seconds for active jobs.

- [ ] Make the web routes delegate and preserve their current payloads through explicit web mappers.

- [ ] Run job/media contracts and commit.

## Task 5: Add quote and spending-limit persistence

**Files:**

- Create: `neon/migrations/28_mcp_paid_generation.sql`
- Modify: `frontend/src/lib/schema/mcp-schema.ts`
- Create: `frontend/src/server/agent-api/quote-repository.ts`
- Create: `frontend/src/server/agent-api/spending-limits.ts`
- Create: `tests/mcp-paid-migration.test.ts`
- Create: `tests/mcp-quote-repository.test.ts`
- Create: `tests/mcp-spending-limits.test.ts`

- [ ] Write failing migration contracts for:

```text
mcp_generation_quotes
  quote_id UUID PRIMARY KEY
  user_id TEXT NOT NULL
  oauth_client_id TEXT
  request_json JSONB NOT NULL
  request_hash TEXT NOT NULL
  catalog_revision TEXT NOT NULL
  pricing_snapshot JSONB NOT NULL
  price_cents INTEGER NOT NULL CHECK >= 0
  currency TEXT NOT NULL
  funding_mode TEXT CHECK ('wallet')
  state TEXT CHECK ('prepared','claimed','accepted','failed','expired')
  job_id TEXT UNIQUE
  expires_at, claimed_at, created_at, updated_at

mcp_spending_limits
  user_id TEXT PRIMARY KEY
  per_generation_cents INTEGER
  daily_cents INTEGER
  web_approval_above_cents INTEGER
  updated_at
```

- [ ] Add indexes on `(user_id, created_at DESC)`, `(oauth_client_id, created_at DESC)`, expiration, and state. Do not add prompt or reference URL columns outside `request_json`.

- [ ] Implement repository methods with injectable `QueryExecutor`: `insertPreparedQuote`, `getOwnedQuote`, `lockOwnedPreparedQuote`, `markQuoteAccepted`, `markQuoteFailed`, and `expirePreparedQuotes`.

- [ ] Make opaque IDs random UUIDs. Set quote lifetime to ten minutes in server configuration; do not accept a client-supplied expiration.

- [ ] Implement spending checks from integer cents and already accepted MCP spend. Return `SPENDING_LIMIT_EXCEEDED` with a web approval URL when configured.

- [ ] Apply migration to the intended Neon branch only after focused tests pass; commit.

## Task 6: Implement `prepare_generation`

**Files:**

- Create: `frontend/src/server/agent-api/prepare-generation.ts`
- Create: `frontend/src/server/agent-api/generation-pricing.ts`
- Create: `frontend/src/server/agent-api/catalog-revision.ts`
- Create: `frontend/src/server/mcp/tools/prepare-generation.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Create: `tests/mcp-prepare-generation.test.ts`

- [ ] Write failing tests for valid image/video quotes, disabled engines, mode mismatch, missing references, invalid settings, restricted accounts, insufficient funds, spending-limit handoff, catalog revision, exact price, projected balance, and expiration.

- [ ] Validate in this order: principal, feature flag, account restriction, canonical request, public engine/mode, surface-specific request, reference shape, exact current pricing, wallet currency/balance, spending policy, quote persistence.

- [ ] Use `computeConfiguredPreflight()` for video and `estimateImageGeneration()` for image. Convert both to one `PreparedGeneration` DTO:

```ts
type PreparedGeneration = {
  quoteId: string;
  expiresAt: string;
  requestHash: string;
  summary: CanonicalGenerationRequest;
  price: { amountCents: number; currency: string };
  balance: { beforeCents: number; afterCents: number };
  fundingMode: 'wallet';
  confirmationRequired: true;
  topupRequired: boolean;
};
```

- [ ] Persist the canonical request and pricing snapshot before returning. Recommendation output must never substitute for this quote.

- [ ] Register the MCP tool as `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`. Its description must say it does not spend or generate.

- [ ] Run and commit the prepare suite.

## Task 7: Split initial job reservation from provider submission

**Files:**

- Modify: `frontend/app/api/generate/_lib/initial-video-job.ts`
- Create: `frontend/src/server/video-generation/execute-video-generation.ts`
- Modify: `frontend/app/api/generate/route.ts`
- Modify: `frontend/src/server/images/image-initial-job.ts`
- Modify: `frontend/src/server/images/execute-image-generation.ts`
- Create: `frontend/src/server/generations/initial-job-reservation.ts`
- Create: `tests/generation-initial-job-transaction.test.ts`
- Create: `tests/video-generation-service-parity.test.ts`
- Create: `tests/image-generation-service-parity.test.ts`

- [ ] Add failing concurrency tests proving one executor can create an initial job and wallet reservation without starting a nested transaction.

- [ ] Extract executor-aware variants while preserving current wrappers:

```ts
export async function createInitialVideoJobInExecutor(
  executor: QueryExecutor,
  params: CreateVideoInitialJobParams,
): Promise<VideoInitialJobResult>;

export async function createInitialImageJobInExecutor(
  executor: QueryExecutor,
  params: CreateImageInitialJobParams,
): Promise<ImageInitialJobResult>;
```

- [ ] Add `walletReservation: 'reserve' | 'already_reserved'` to the internal execution contract. Web adapters use `reserve`; quote confirmation uses `already_reserved`. Reject this option from all external request bodies.

- [ ] Move the 695-line video route's orchestration into `executeVideoGeneration()` under `frontend/src/server/video-generation`, retaining its route-local provider helpers through injected adapters initially. The route parses/authenticates/maps HTTP only and stays below 250 lines.

- [ ] Split each service into `reserve initial state` and `submit provider` phases so the confirmation transaction ends before the network call. Preserve receipt creation and existing failure refund hooks.

- [ ] Add architecture tests preventing MCP tool files from importing provider modules and preventing route files from owning wallet reservation logic.

- [ ] Run all existing generation architecture, pricing, receipt, refund, provider-routing, image, and video tests. Commit this refactor alone before adding confirmation behavior.

## Task 8: Implement atomic quote confirmation and paid execution

**Files:**

- Create: `frontend/src/server/agent-api/confirm-generation.ts`
- Create: `frontend/src/server/agent-api/paid-generation-execution.ts`
- Create: `frontend/src/server/mcp/tools/confirm-generation.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Create: `tests/mcp-confirm-generation.test.ts`
- Create: `tests/mcp-confirm-generation-concurrency.test.ts`

- [ ] Write failing tests for `confirmed !== true`, expired quote, wrong user/client, already claimed quote, current account restriction, stale catalog/price, insufficient balance, spending limit, duplicate calls, and provider rejection.

- [ ] Implement the database phase with `withDbTransaction()`:

```text
SELECT quote FOR UPDATE
revalidate owner, state, expiry, restriction, spending limit, catalog and price
reserve wallet charge and receipt
create initial app_jobs row using quoteId as the idempotency key
mark quote claimed with jobId
COMMIT
```

- [ ] Submit to the provider after commit using the shared image/video execution service with `walletReservation: 'already_reserved'`.

- [ ] On accepted submission, mark quote `accepted`. On pre-acceptance rejection, run the existing wallet refund path, mark the job failed/refunded, and mark the quote failed. On an ambiguous timeout, keep the job recoverable and use provider idempotency before deciding to refund.

- [ ] A repeat confirmation returns the linked job and current state without another charge. A concurrent loser may return the same job, not a generic conflict.

- [ ] Register `confirm_generation` with `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, and `openWorldHint: true`. State explicitly that it spends wallet funds and contacts an external generation provider.

- [ ] Run concurrency tests against a disposable Neon branch in addition to mocked unit tests. Commit.

## Task 9: Add status, recent generation, and top-up tools

**Files:**

- Create: `frontend/src/server/agent-api/generation-status.ts`
- Create: `frontend/src/server/agent-api/topup-handoff.ts`
- Create: `frontend/src/server/mcp/tools/get-generation-status.ts`
- Create: `frontend/src/server/mcp/tools/list-recent-generations.ts`
- Create: `frontend/src/server/mcp/tools/create-topup-link.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Create: `tests/mcp-generation-recovery-tools.test.ts`
- Create: `tests/mcp-topup-handoff.test.ts`

- [ ] Wrap the shared job-read services with ownership checks and safe result/resource links. Never return the stored prompt by default.

- [ ] Register the exact public tool names `get_generation_status`, `list_recent_generations`, and `create_topup_link`. Keep their schemas additive and return stable agent-facade DTOs rather than existing web-route payloads.

- [ ] Use the existing billing intent contract to produce a short-lived signed MaxVideoAI URL containing only amount, currency, quote intent ID, and expiry. The billing page resolves the intent server-side; it never trusts a client-supplied price.

- [ ] Require a fresh quote after funding. The top-up tool must not create a Stripe session, return a client secret, or mark the stale quote payable.

- [ ] Annotate status/recent as read-only and top-up link creation as non-destructive but open-world because it creates a web handoff.

- [ ] Test user isolation, cursor pagination, retry guidance, image content size limits, video resource links, expired handoffs, and stale quote behavior. Commit.

## Task 10: Add web spending controls and activity history

**Files:**

- Create: `frontend/app/(core)/account/connections/_components/McpSpendingControls.tsx`
- Create: `frontend/app/api/account/mcp-settings/route.ts`
- Create: `frontend/src/server/agent-api/activity-history.ts`
- Create: `tests/mcp-spending-settings-route.test.ts`
- Modify: `tests/mcp-connections-contract.test.ts`

- [ ] Add authenticated GET/PATCH settings with integer-cent validation, CSRF/origin protections used by existing account mutations, and `private, no-store` responses.

- [ ] Let users set per-generation, daily, and web-approval thresholds and view safe MCP activity: client label, tool, model, amount, outcome, and timestamp. Exclude prompts and URLs.

- [ ] Add a paid-generation kill switch and clear UI explanation that host auto-approval cannot be overridden by MaxVideoAI, but spending caps remain server-enforced.

- [ ] Run account/security contracts and commit.

## Task 11: End-to-end paid-flow verification

**Files:**

- Create: `tests/integration/mcp-paid-generation.test.ts`
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`
- Create: `docs/operations/mcp-paid-generation-runbook.md`

- [ ] On disposable auth/database/provider test environments, verify: paid text-to-image, image-to-image, text-to-video, image-to-video, quote expiry, insufficient funds, top-up handoff, fresh quote, successful status recovery, provider rejection/refund, and concurrent confirmation.

- [ ] Compare each MCP quote and final charge against the equivalent web estimate/execution. Any cent-level or settings drift blocks rollout.

- [ ] Run the full gate:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-*.test.ts \
  tests/generation-*.test.ts \
  tests/image-generation-server-architecture.test.ts \
  tests/generate-route-context.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
npm --prefix frontend run build
```

- [ ] Enable paid generation for controlled accounts only. Leave trial and reference upload flags off.

## Completion Criteria

- A paid image or video request is quoted exactly, displayed, separately confirmed, wallet-reserved once, and submitted asynchronously.
- Quote request, price, owner, and references are immutable; concurrency cannot double-charge or duplicate a job.
- Provider failures follow existing refund semantics and are observable through safe status tools.
- Account spending caps and top-up handoffs work without exposing Stripe secrets or accepting payment in MCP.
- Existing web generation behavior and accounting remain equivalent.
