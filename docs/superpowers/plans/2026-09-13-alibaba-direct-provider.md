# Alibaba Direct Video Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one reusable Alibaba Cloud Model Studio direct-video adapter and connect Wan 3 Standard, Wan 3 Prime, and HappyHorse 1.1 to every existing MaxVideoAI execution surface without enabling live traffic.

**Architecture:** Extend the shared video-provider router and job lifecycle already used by Kling, Google Vertex, Luma, and BytePlus. Alibaba-specific HTTP, model mapping, payload, response, error, and factual cost logic stays in one focused adapter; submission, provider attempts, polling, storage copy, billing/refunds, MCP projection, Studio certification, and admin metrics reuse their current owners.

**Tech Stack:** Node 22, pnpm 10.18.2, TypeScript, Next.js App Router, Node test runner through `tsx --test`, PostgreSQL job/provider-attempt persistence, existing canonical pricing package, S3-compatible storage.

**Spec:** `docs/superpowers/specs/2026-09-13-alibaba-direct-provider-design.md`

## Global Constraints

- Work only on `codex/alibaba-direct-provider`.
- Do not deploy, enable public routing, create an Alibaba API key, or call Alibaba.
- Do not consume the $100 PoC credit.
- Keep all Alibaba routing flags disabled by default and admin-only by default.
- Preserve `wan-3`, `wan-3-prime`, and `happy-horse-1-1` as the only canonical product identities.
- Reuse the current job, wallet, provider-attempt, storage, MCP, Studio, and admin owners.
- Do not edit generated model projections by hand.
- Do not expose API keys, workspace identifiers, private endpoint values, signed URLs, or raw private media in logs, snapshots, browser bundles, fixtures, or documentation.
- Existing T2V/I2V/Ref2V customer prices remain unchanged when the execution provider changes.
- Never submit a Fal fallback after Alibaba has returned a task ID.
- Every production behavior starts with a focused failing test.

---

## File Map

### New provider-specific files

- `frontend/src/server/video-providers/alibaba-model-studio/types.ts`: Alibaba request/response transport types.
- `frontend/src/server/video-providers/alibaba-model-studio/model-map.ts`: canonical engine/mode mappings and exact fallback compatibility.
- `frontend/src/server/video-providers/alibaba-model-studio/payload.ts`: Wan 3 and HappyHorse request construction.
- `frontend/src/server/video-providers/alibaba-model-studio/response.ts`: task status and usage normalization.
- `frontend/src/server/video-providers/alibaba-model-studio/errors.ts`: safe error classification and fallback decisions.
- `frontend/src/server/video-providers/alibaba-model-studio/cost.ts`: Singapore factual provider-cost calculation.
- `frontend/src/server/video-providers/alibaba-model-studio/client.ts`: authenticated create-task and fetch-task HTTP transport.
- `frontend/src/server/video-providers/alibaba-model-studio/index.ts`: `VideoProviderAdapter` composition.
- `frontend/app/api/generate/_lib/alibaba-model-studio-submission.ts`: shared job/payment/provider-attempt submission orchestration.
- `frontend/server/alibaba-model-studio-poll.ts`: database polling, output copy, completion, failure, and reconciliation.
- `frontend/app/api/cron/alibaba-model-studio-poll/route.ts`: protected cron entry point.
- `docs/engineering/alibaba-model-studio-provider.md`: ownership, flags, operational rollout, and verification.

### Existing shared files to modify

- `frontend/src/lib/env.ts`
- `frontend/src/server/video-providers/types.ts`
- `frontend/src/server/video-providers/router.ts`
- `frontend/src/server/video-providers/provider-attempts.ts`
- `frontend/app/api/generate/_lib/route-context.ts`
- `frontend/app/api/generate/_lib/video-provider-submission.ts`
- `frontend/server/user-facing-failure-messages.ts`
- `frontend/server/admin-mcp-metrics.ts`
- `frontend/vercel.json`
- `frontend/src/config/fal-engines/wan-3-shared.ts`
- `frontend/src/config/fal-engines/wan-3.ts`
- `frontend/src/config/fal-engines/wan-3-prime.ts`
- `frontend/src/config/fal-engines/happy-horse-1-1.ts`
- `frontend/src/server/video-generation/execution-constraints.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification.ts`
- generated projections produced by the model-registry workflow.

### Tests to create or extend

- Create `tests/alibaba-model-studio-provider.test.ts`.
- Create `tests/alibaba-model-studio-submission.test.ts`.
- Create `tests/alibaba-model-studio-poll.test.ts`.
- Create `tests/alibaba-model-studio-architecture.test.ts`.
- Modify `tests/p0-provider-routing.test.ts`.
- Modify `tests/provider-attempts-helper.test.ts`.
- Modify `tests/provider-message-copy.test.ts`.
- Modify `tests/p0-video-request-bodies.test.ts`.
- Modify `tests/p0-video-pricing-parity.test.ts`.
- Modify `tests/mcp-p0-video-parity.test.ts`.
- Modify `tests/mcp-special-video-modes.test.ts`.
- Modify `tests/maxvideoai-editor-v1-capability-matrix.test.ts`.
- Modify `tests/maxvideoai-editor-workspace-architecture.test.ts`.
- Modify `tests/admin-mcp-metrics.test.ts` and its PostgreSQL counterpart only where the provider dimension is asserted.
- Modify `tests/vercel-cron-auth.test.ts`.

---

### Task 1: Prepare the supported Node runtime and lock the provider contract

**Files:**
- Modify: local tool environment only for Node 22 and installed dependencies
- Create: `tests/alibaba-model-studio-provider.test.ts`
- Create: `frontend/src/server/video-providers/alibaba-model-studio/types.ts`
- Create: `frontend/src/server/video-providers/alibaba-model-studio/model-map.ts`
- Create: `frontend/src/server/video-providers/alibaba-model-studio/cost.ts`
- Modify: `frontend/src/server/video-providers/types.ts`

**Interfaces:**
- Produces: `ALIBABA_MODEL_STUDIO_PROVIDER`, `resolveAlibabaModelRoute`, `isAlibabaDirectEngine`, `isAlibabaDirectModeSupported`, `isAlibabaFalFallbackCompatible`, `estimateAlibabaProviderCost`.
- Produces provider key: `'alibaba_model_studio'`.

- [ ] **Step 1: Activate Node 22 and install the locked dependencies**

Run:

```bash
brew install node@22
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --version
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm install --frozen-lockfile
```

Expected: Node reports `v22.x`; pnpm completes without changing the lockfile.

- [ ] **Step 2: Write failing model-map and cost tests**

Add cases equivalent to:

```ts
assert.deepEqual(resolveAlibabaModelRoute('wan-3', 't2v'), {
  model: 'wan3.0-video', family: 'wan3', mode: 't2v', fallbackCompatible: true,
});
assert.equal(resolveAlibabaModelRoute('wan-3-prime', 'extend')?.model, 'wan3.0-video-prime');
assert.equal(resolveAlibabaModelRoute('happy-horse-1-1', 'ref2v')?.model, 'happyhorse-1.1-r2v');
assert.equal(resolveAlibabaModelRoute('wan-2-6', 't2v'), null);

assert.deepEqual(estimateAlibabaProviderCost({
  engineId: 'wan-3', mode: 'ref2v', durationSec: 10,
  inputVideoDurationSec: 5, resolution: '720p',
}), { providerCostUnits: 15, providerCostUsd: 1.5, source: 'alibaba_singapore_2026-09-12' });
assert.equal(estimateAlibabaProviderCost({
  engineId: 'happy-horse-1-1', mode: 'i2v', durationSec: 5,
  inputVideoDurationSec: 0, resolution: '1080p',
}).providerCostUsd, 0.9);
```

- [ ] **Step 3: Run the test and confirm RED**

Run:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test tests/alibaba-model-studio-provider.test.ts
```

Expected: failure because the Alibaba modules and provider key do not exist.

- [ ] **Step 4: Implement the minimal provider types, mapping, and factual rates**

Define a route contract shaped as:

```ts
export type AlibabaModelRoute = {
  model: 'wan3.0-video' | 'wan3.0-video-prime'
    | 'happyhorse-1.1-t2v' | 'happyhorse-1.1-i2v' | 'happyhorse-1.1-r2v';
  family: 'wan3' | 'happyhorse11';
  mode: 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend';
  fallbackCompatible: boolean;
};
```

Wan 3 Standard rates are 0.05/0.10/0.20 USD per billable second at 480/720/1080p. Prime rates are 0.068/0.14/0.28. HappyHorse 1.1 rates are 0.07/0.14/0.18 and bill output seconds only.

- [ ] **Step 5: Run provider tests and the existing provider type contracts**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/alibaba-model-studio-provider.test.ts \
  tests/provider-attempts-helper.test.ts \
  tests/p0-provider-routing.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit the provider contract**

```bash
git add frontend/src/server/video-providers/types.ts \
  frontend/src/server/video-providers/alibaba-model-studio \
  tests/alibaba-model-studio-provider.test.ts
git commit -m "feat: define Alibaba direct provider contract"
```

---

### Task 2: Implement Alibaba payloads, responses, HTTP client, and safe errors

**Files:**
- Modify: `tests/alibaba-model-studio-provider.test.ts`
- Create: `frontend/src/server/video-providers/alibaba-model-studio/payload.ts`
- Create: `frontend/src/server/video-providers/alibaba-model-studio/response.ts`
- Create: `frontend/src/server/video-providers/alibaba-model-studio/errors.ts`
- Create: `frontend/src/server/video-providers/alibaba-model-studio/client.ts`
- Create: `frontend/src/server/video-providers/alibaba-model-studio/index.ts`
- Modify: `frontend/src/lib/env.ts`

**Interfaces:**
- Consumes: `resolveAlibabaModelRoute`, `estimateAlibabaProviderCost`.
- Produces: `buildAlibabaVideoPayload`, `normalizeAlibabaTask`, `classifyAlibabaError`, `shouldFallbackFromAlibabaSubmit`, `AlibabaModelStudioClient`, `getAlibabaModelStudioAdapter`.

- [ ] **Step 1: Write failing payload, normalization, error, and transport tests**

Cover these concrete payloads:

```ts
assert.deepEqual(buildAlibabaVideoPayload({
  engineId: 'wan-3', mode: 't2v', prompt: 'A cinematic harbor.',
  durationSec: 5, resolution: '720p', aspectRatio: '16:9', audioEnabled: true,
}), {
  model: 'wan3.0-video',
  input: { prompt: 'A cinematic harbor.' },
  parameters: {
    resolution: '720P', ratio: '16:9', duration: 5,
    audio: true, prompt_extend: true, watermark: false,
  },
});
```

Add I2V first/last-frame media, Ref2V ordered reference media, Wan 3 edit/extend reference-video intent, and HappyHorse T2V/I2V/R2V fixtures. Assert that first-frame Wan 3 cannot mix reference audio, combined reference video exceeds 15 seconds, total input plus output exceeds 30 seconds, unsupported Alpha images are rejected when metadata is known, and arbitrary file/link references are rejected.

Normalize `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`, and `UNKNOWN`. Assert usage reads `input_video_duration` and `output_video_duration`, and that a missing task ID or success without `video_url` is an invalid response.

Mock fetch only at the HTTP boundary and assert the exact endpoint suffixes:

```text
POST /api/v1/services/aigc/video-generation/video-synthesis
GET  /api/v1/tasks/{task_id}
```

Assert `Authorization: Bearer …`, `Content-Type: application/json`, and `X-DashScope-Async: enable` are sent but never included in thrown error bodies.

- [ ] **Step 2: Run and confirm RED**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test tests/alibaba-model-studio-provider.test.ts
```

Expected: failures for missing builders, normalizers, client, and classifiers.

- [ ] **Step 3: Implement the provider-local behavior**

The HTTP client constructor accepts only injected or server-derived configuration:

```ts
type AlibabaModelStudioConfig = {
  apiKey: string;
  baseUrl: string;
  submitTimeoutMs: number;
  pollTimeoutMs: number;
};
```

Add server-only environment reads:

```text
ALIBABA_MODEL_STUDIO_API_KEY
ALIBABA_MODEL_STUDIO_BASE_URL
ALIBABA_MODEL_STUDIO_REGION=ap-southeast-1
ALIBABA_MODEL_STUDIO_ENABLED=false
ALIBABA_MODEL_STUDIO_PUBLIC_ROUTING_ENABLED=false
ALIBABA_MODEL_STUDIO_ADMIN_ONLY=true
ALIBABA_MODEL_STUDIO_FALLBACK_TO_FAL_ENABLED=false
ALIBABA_MODEL_STUDIO_SUBMIT_TIMEOUT_MS=30000
ALIBABA_MODEL_STUDIO_POLL_TIMEOUT_MS=30000
ALIBABA_MODEL_STUDIO_POLL_MAX_MINUTES=185
```

Validate that the configured base URL is HTTPS, contains the Singapore region, and has no path beyond the workspace host. Never provide a committed real workspace URL.

- [ ] **Step 4: Run and confirm GREEN**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test tests/alibaba-model-studio-provider.test.ts
```

- [ ] **Step 5: Commit provider-local behavior**

```bash
git add frontend/src/lib/env.ts \
  frontend/src/server/video-providers/alibaba-model-studio \
  tests/alibaba-model-studio-provider.test.ts
git commit -m "feat: implement Alibaba video API adapter"
```

---

### Task 3: Connect shared routing, submission, fallback, and snapshot privacy

**Files:**
- Create: `tests/alibaba-model-studio-submission.test.ts`
- Modify: `tests/p0-provider-routing.test.ts`
- Modify: `tests/provider-attempts-helper.test.ts`
- Modify: `tests/provider-message-copy.test.ts`
- Modify: `frontend/src/server/video-providers/router.ts`
- Modify: `frontend/src/server/video-providers/provider-attempts.ts`
- Modify: `frontend/app/api/generate/_lib/route-context.ts`
- Create: `frontend/app/api/generate/_lib/alibaba-model-studio-submission.ts`
- Modify: `frontend/app/api/generate/_lib/video-provider-submission.ts`
- Modify: `frontend/server/user-facing-failure-messages.ts`

**Interfaces:**
- Consumes: Alibaba adapter and current `createProviderAttempt`, `createProviderJobTracker`, Fal submission, job/payment persistence.
- Produces: routing kind `alibaba_model_studio_primary` and `submitAlibabaModelStudioGenerateTask`.

- [ ] **Step 1: Write failing routing and submission tests**

Assert:

- disabled Alibaba returns the existing Fal-only plan;
- enabled plus admin routes the included engine/mode direct;
- non-admin remains Fal-only while public routing is false;
- unsupported/legacy engines remain unchanged;
- Wan 3 `v2v` and `extend` route direct with fallback false;
- a retryable pre-acceptance 429 can create attempt 1 when fallback is enabled;
- moderation, 400, 401, 403, regional mismatch, and accepted-task failures cannot fallback;
- after `task_id: task_123`, even a persistence or network error cannot enqueue Fal;
- one job cannot create more than one fallback attempt.

- [ ] **Step 2: Write a failing provider-snapshot privacy test**

Use this shape and assert every sensitive value is replaced:

```ts
{
  authorization: 'Bearer secret',
  api_key: 'secret',
  workspaceId: 'private-workspace',
  image_url: 'https://storage.example/x.png?X-Amz-Signature=secret',
  safe: { promptLength: 42 },
}
```

Expected stored shape retains `safe.promptLength` but replaces authorization,
key, workspace, and signed URL values with stable redaction markers.

- [ ] **Step 3: Run and confirm RED**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/alibaba-model-studio-submission.test.ts \
  tests/p0-provider-routing.test.ts \
  tests/provider-attempts-helper.test.ts \
  tests/provider-message-copy.test.ts
```

- [ ] **Step 4: Implement shared routing and submission**

Extend `VideoProviderRoutingPlan` with:

```ts
{
  kind: 'alibaba_model_studio_primary';
  primaryProvider: 'alibaba_model_studio';
  fallbackProvider: 'fal';
  fallbackEnabled: boolean;
}
```

Keep BytePlus's existing early route intact. The generic router evaluates Alibaba
alongside Kling/Luma/Vertex and only for exact mapped engine/mode pairs. Submission
creates attempt zero, persists acceptance before returning, and calls the existing
Fal submission only through an explicit attempt-one path.

Extend snapshot sanitization by key class and URL query stripping; never persist
whole Alibaba request bodies when a bounded summary is sufficient.

- [ ] **Step 5: Run and confirm GREEN**

Run the four focused tests from Step 3 and `tests/generate-provider-job-tracker.test.ts`.

- [ ] **Step 6: Commit routing and submission**

```bash
git add frontend/src/server/video-providers/router.ts \
  frontend/src/server/video-providers/provider-attempts.ts \
  frontend/app/api/generate/_lib/route-context.ts \
  frontend/app/api/generate/_lib/alibaba-model-studio-submission.ts \
  frontend/app/api/generate/_lib/video-provider-submission.ts \
  frontend/server/user-facing-failure-messages.ts \
  tests/alibaba-model-studio-submission.test.ts \
  tests/p0-provider-routing.test.ts \
  tests/provider-attempts-helper.test.ts \
  tests/provider-message-copy.test.ts
git commit -m "feat: route Alibaba direct video submissions"
```

---

### Task 4: Add polling, permanent output copy, recovery, and cron integration

**Files:**
- Create: `tests/alibaba-model-studio-poll.test.ts`
- Modify: `tests/vercel-cron-auth.test.ts`
- Create: `frontend/server/alibaba-model-studio-poll.ts`
- Create: `frontend/app/api/cron/alibaba-model-studio-poll/route.ts`
- Modify: `frontend/vercel.json`

**Interfaces:**
- Consumes: `AlibabaModelStudioClient.fetchTask`, `normalizeAlibabaTask`, `copyProviderVideoOriginal`, provider-attempt lifecycle, existing wallet refund/failure owners.
- Produces: `runAlibabaModelStudioPoll` and protected cron GET handler.

- [ ] **Step 1: Write failing poll lifecycle tests**

Cover:

- only active `alibaba_model_studio` jobs are selected;
- pending/running status updates attempt and job without completing it;
- success downloads and copies the provider original before marking completed;
- usage produces actual provider cost from input/output duration;
- failed/canceled tasks use existing safe failure and refund behavior;
- unknown or repeated transport failure becomes `polling_stalled` without fallback;
- copy failure remains recoverable and does not resubmit generation;
- already completed jobs are idempotent;
- result fetch rejects redirect abuse, non-video content, oversized content, and partial downloads through the existing copy boundary.

- [ ] **Step 2: Run and confirm RED**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/alibaba-model-studio-poll.test.ts \
  tests/vercel-cron-auth.test.ts
```

- [ ] **Step 3: Implement the poll owner and protected cron route**

Follow the existing direct poller query/status structure. Use a five-minute Vercel
cron entry:

```json
{ "path": "/api/cron/alibaba-model-studio-poll", "schedule": "*/5 * * * *" }
```

Authorization reuses `CRON_SECRET` and accepts a provider-specific override header
named `x-alibaba-model-studio-poll-token`, matching the current direct-provider
cron pattern. Polling never prints the configured endpoint or raw provider body.

- [ ] **Step 4: Run and confirm GREEN**

Run the Step 2 tests plus:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/provider-video-original-copy.test.ts \
  tests/fal-poll-refund-policy.test.ts
```

- [ ] **Step 5: Commit polling and recovery**

```bash
git add frontend/server/alibaba-model-studio-poll.ts \
  frontend/app/api/cron/alibaba-model-studio-poll/route.ts \
  frontend/vercel.json \
  tests/alibaba-model-studio-poll.test.ts \
  tests/vercel-cron-auth.test.ts
git commit -m "feat: poll and persist Alibaba video jobs"
```

---

### Task 5: Align canonical capabilities, request bodies, and pricing projections

**Files:**
- Modify: `tests/p0-video-request-bodies.test.ts`
- Modify: `tests/p0-video-pricing-parity.test.ts`
- Modify: `tests/p0-video-engine-contracts.test.ts`
- Modify: `tests/p0-video-validation.test.ts`
- Modify: `frontend/src/config/fal-engines/wan-3-shared.ts`
- Modify: `frontend/src/config/fal-engines/wan-3.ts`
- Modify: `frontend/src/config/fal-engines/wan-3-prime.ts`
- Modify: `frontend/src/config/fal-engines/happy-horse-1-1.ts`
- Modify: `frontend/src/server/video-generation/execution-constraints.ts`
- Keep canonical pricing formulas unchanged; use the existing per-output-second
  customer quote for new Wan 3 modes and keep Alibaba input-duration cost only in
  provider-attempt factual accounting.

**Interfaces:**
- Consumes: current `EngineCaps`, input schema, request normalization, and canonical pricing package.
- Produces: provider-neutral Wan 3 capabilities with direct-provider constraints layered server-side.

- [ ] **Step 1: Write failing capability and request tests**

Assert Wan 3:

- prompt maximum reflects the official 20,000-character API limit;
- T2V/I2V/Ref2V retain current public request behavior;
- direct payload maps `auto` to `adaptive` and lowercase resolution to uppercase;
- first/last-frame I2V preserves field identity;
- `v2v` and `extend` accept exactly one source video and reject incompatible connector shapes;
- smart duration is not silently exposed through a numeric-only UI;
- file and link references remain unavailable;
- Fal request bodies are unchanged for existing modes.

Assert HappyHorse 1.1 retains 3-15 seconds, 480/720/1080p, 24 fps, and its
existing T2V/I2V/Ref2V public schema while the direct route uses exact Alibaba
model IDs.

- [ ] **Step 2: Write failing pricing tests**

For every existing T2V/I2V/Ref2V scenario, compare the canonical customer quote
before and after selecting Alibaba and assert equality. Separately assert factual
provider costs use Alibaba rules and do not overwrite the customer quote snapshot.
For new Wan 3 `v2v`/`extend`, assert the canonical quote includes the selected
duration/resolution and that billing facts can carry input-video duration without
changing historical quote interpretation.

- [ ] **Step 3: Run and confirm RED**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/p0-video-request-bodies.test.ts \
  tests/p0-video-pricing-parity.test.ts \
  tests/p0-video-engine-contracts.test.ts \
  tests/p0-video-validation.test.ts
```

- [ ] **Step 4: Implement minimal canonical capability changes**

Keep provider routing out of the engine registry. Add `v2v` and `extend` only where
all validation and pricing inputs exist. Preserve the existing Fal IDs for existing
modes. Update authored registry/capability sources, then regenerate projections
through the model-registry workflow rather than editing JSON outputs.

- [ ] **Step 5: Run and confirm GREEN, then regenerate/check projections**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/p0-video-request-bodies.test.ts \
  tests/p0-video-pricing-parity.test.ts \
  tests/p0-video-engine-contracts.test.ts \
  tests/p0-video-validation.test.ts
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm model:registry:check
```

- [ ] **Step 6: Commit capability and pricing alignment**

Stage only authored files plus generator-produced diffs and commit:

```bash
git commit -m "feat: align Alibaba video capabilities and pricing"
```

---

### Task 6: Preserve MCP parity and certify Studio workflows

**Files:**
- Modify: `tests/mcp-p0-video-parity.test.ts`
- Modify: `tests/mcp-special-video-modes.test.ts`
- Modify: `tests/mcp-budget-options.test.ts`
- Modify: `tests/mcp-prepare-generation.test.ts`
- Modify: `tests/maxvideoai-editor-v1-capability-matrix.test.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-facts.ts`
- Modify MCP execution code only where provider-neutral input facts are not currently propagated.

**Interfaces:**
- Consumes: generated engine catalog and shared paid-video execution.
- Produces: unchanged MCP behavior for existing modes and explicit Wan 3 Edit/Extend discovery/execution; explicit Studio certification tuples.

- [ ] **Step 1: Write failing MCP and Studio tests**

Assert:

- Wan 3, Prime, and HappyHorse continue to expose T2V/I2V/Ref2V through MCP;
- Wan 3 `v2v` and `extend` are discoverable only after their complete capability
  and pricing contract exists;
- MCP request hashing and confirmation do not include provider choice;
- MCP budget uses the canonical customer quote, not Alibaba internal cost;
- direct-provider private fields do not appear in model details or tool schemas;
- Studio lists Wan 3/Prime/HappyHorse only for certified compatible blocks;
- Wan 3 edit and extend appear only in modify/extend blocks with exact source-video connectors.

- [ ] **Step 2: Run and confirm RED**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/mcp-p0-video-parity.test.ts \
  tests/mcp-special-video-modes.test.ts \
  tests/mcp-budget-options.test.ts \
  tests/mcp-prepare-generation.test.ts \
  tests/studio-access-policy.test.ts
```

- [ ] **Step 3: Implement only missing shared projections and certifications**

Do not add an Alibaba-specific MCP tool or Studio registry. Let both consume the
canonical engine/mode facts. Add certification entries only for tuples covered by
payload, pricing, connector, and output tests.

- [ ] **Step 4: Run and confirm GREEN**

Run the Step 2 tests plus `tests/mcp-read-only-engine-resolution.test.ts` and
`tests/maxvideoai-editor-workspace-architecture.test.ts`.

- [ ] **Step 5: Commit MCP and Studio parity**

```bash
git commit -am "feat: expose certified Alibaba workflows across MCP and Studio"
```

Before committing, inspect `git diff --name-only` and use explicit `git add` instead
if any unrelated user file is present.

---

### Task 7: Add admin observability, architecture contracts, and operating documentation

**Files:**
- Create: `tests/alibaba-model-studio-architecture.test.ts`
- Modify: `tests/admin-mcp-metrics.test.ts`
- Modify: `tests/admin-mcp-metrics-postgres.test.ts`
- Modify: `frontend/server/admin-mcp-metrics.ts`
- Create: `docs/engineering/alibaba-model-studio-provider.md`

**Interfaces:**
- Consumes: `provider_attempts`, job statuses, provider cost fields, and current admin metrics response.
- Produces: Alibaba provider dimension and an operational runbook with disabled defaults.

- [ ] **Step 1: Write failing admin and architecture tests**

Assert admin aggregation recognizes `alibaba_model_studio` and reports attempts,
acceptance/completion/failure, fallback, stalled polling, cost, and latency without
revealing raw payloads. The architecture contract asserts one Alibaba adapter
folder, one submission owner, one poll owner, shared storage copy, shared provider
attempts, and no imports from provider server modules into client components.

- [ ] **Step 2: Run and confirm RED**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/alibaba-model-studio-architecture.test.ts \
  tests/admin-mcp-metrics.test.ts
```

- [ ] **Step 3: Implement metrics projection and documentation**

Document:

- ownership and mapping table;
- exact environment names and disabled defaults;
- Singapore endpoint/key regional coupling;
- routing and fallback eligibility;
- no-fallback-after-acceptance invariant;
- 5 RPS / 5 concurrency limit;
- polling and 24-hour result retention;
- provider cost versus customer quote;
- secret and signed-URL handling;
- admin-only canary procedure that stops before key creation or live traffic;
- rollback by disabling routing flags;
- required checks before any later deployment.

- [ ] **Step 4: Run and confirm GREEN**

Run the Step 2 tests and `tests/provider-attempts-schema.test.ts`.

- [ ] **Step 5: Commit observability and docs**

```bash
git add frontend/server/admin-mcp-metrics.ts \
  tests/alibaba-model-studio-architecture.test.ts \
  tests/admin-mcp-metrics.test.ts \
  tests/admin-mcp-metrics-postgres.test.ts \
  docs/engineering/alibaba-model-studio-provider.md
git commit -m "docs: add Alibaba provider operations and observability"
```

Omit any unchanged path from the `git add` command.

---

### Task 8: Run full verification and close the branch without publishing

**Files:**
- Modify only files needed to correct failures caused by this branch, always with a new failing regression test first.

**Interfaces:**
- Consumes: all preceding deliverables.
- Produces: verified implementation branch and evidence report; no deployment.

- [ ] **Step 1: Run the focused Alibaba suite**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/alibaba-model-studio-provider.test.ts \
  tests/alibaba-model-studio-submission.test.ts \
  tests/alibaba-model-studio-poll.test.ts \
  tests/alibaba-model-studio-architecture.test.ts
```

- [ ] **Step 2: Run cross-surface contracts**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm exec tsx --test \
  tests/p0-provider-routing.test.ts \
  tests/p0-video-request-bodies.test.ts \
  tests/p0-video-pricing-parity.test.ts \
  tests/p0-video-engine-contracts.test.ts \
  tests/p0-video-validation.test.ts \
  tests/provider-attempts-helper.test.ts \
  tests/provider-attempts-schema.test.ts \
  tests/provider-message-copy.test.ts \
  tests/provider-video-original-copy.test.ts \
  tests/mcp-p0-video-parity.test.ts \
  tests/mcp-special-video-modes.test.ts \
  tests/mcp-budget-options.test.ts \
  tests/mcp-prepare-generation.test.ts \
  tests/mcp-read-only-engine-resolution.test.ts \
  tests/studio-access-policy.test.ts \
  tests/admin-mcp-metrics.test.ts \
  tests/vercel-cron-auth.test.ts
```

- [ ] **Step 3: Run repository gates**

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm model:registry:check
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm pricing:audit
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm --prefix frontend run lint
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run lint:exposure
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --prefix frontend exec tsc --noEmit --pretty false
PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --prefix frontend run build
git diff --check
```

- [ ] **Step 4: Audit final scope and disabled defaults**

```bash
git status --short --branch
git diff --stat HEAD~7..HEAD
rg -n "ALIBABA_MODEL_STUDIO_(ENABLED|PUBLIC_ROUTING_ENABLED|ADMIN_ONLY|FALLBACK_TO_FAL_ENABLED)" frontend docs tests
rg -n "sk-|Authorization: Bearer|X-Amz-Signature" frontend docs tests
```

Review every match. Test-only dummy strings must be unmistakably synthetic; no
credential, account/workspace identifier, signed media URL, or enabled public flag
may be committed.

- [ ] **Step 5: Record final evidence and stop**

Report exact passed/failed command counts, residual risks, and the commit list.
Do not deploy, open public routing, create a provider key, or run a live canary.
