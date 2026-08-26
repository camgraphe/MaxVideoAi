# MaxVideoAI Account and Media Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ChatGPT, Claude, Codex, and compatible clients reliably guide a customer through account state, credits, top-up, fresh quoting, confirmation, generation recovery, reference uploads, and the shared MaxVideoAI media library.

**Architecture:** Introduce one typed destination builder derived from the trusted MCP account origin. Enrich agent-facing DTOs at the agent facade, not the shared web persistence layer. The MCP returns structured `open_url` destinations and deterministic next actions; server instructions and the shared plugin skill teach when to use them. Web and MCP continue to read the same user-scoped `app_jobs` and media records.

**Tech Stack:** TypeScript, MCP TypeScript SDK, Zod, Next.js route services, Neon/Postgres `app_jobs`, Node test runner, existing MCP tool-selection evaluator.

**Spec:** `docs/superpowers/specs/2026-08-26-maxvideoai-plugin-acquisition-and-continuity-design.md`

## Global Constraints

- Read `frontend/app/(core)/(workspace)/app/AGENTS.md` before changing authenticated workspace or library code.
- Do not change the web gallery persistence model or create a staging-only wallet/table.
- Do not return private source URLs, prompts, email addresses, provider identifiers, credentials, or payment data.
- Every destination must be derived from the configured trusted origin; never concatenate a user-supplied URL.
- Preserve current ownership checks, quote locking, idempotency, spending limits, trial accounting, and failure/refund semantics.
- Do not turn a string from the assistant into payment or generation consent.

---

## Task 1: Add a single typed account-destination contract

**Files:**
- Create: `frontend/src/server/agent-api/account-destinations.ts`
- Modify: `frontend/src/server/agent-api/types.ts`
- Test: `tests/mcp-account-destinations.test.ts`

- [ ] Write the failing tests first. Cover production, official MCP staging, and loopback origins; reject credentials, query strings, fragments, non-HTTP protocols, and untrusted path construction.

```ts
const destinations = buildAgentAccountDestinations(
  'https://maxvideoai-mcp-staging.vercel.app/account/connections',
);
assert.deepEqual(destinations.library, {
  type: 'open_url',
  purpose: 'media_library',
  label: 'Open the MaxVideoAI media library',
  url: 'https://maxvideoai-mcp-staging.vercel.app/app/library',
});
```

- [ ] Run the focused test and confirm it fails because the module does not exist.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-account-destinations.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` for `account-destinations`.

- [ ] Implement these exact public types and builder shape:

```ts
export type AgentDestinationPurpose =
  | 'account_connections'
  | 'billing'
  | 'media_library'
  | 'video_workspace'
  | 'image_workspace'
  | 'support'
  | 'generation'
  | 'reference_upload';

export type AgentOpenUrlDestination = Readonly<{
  type: 'open_url';
  purpose: AgentDestinationPurpose;
  label: string;
  url: string;
}>;
```

- [ ] Return `connections`, `billing`, `library`, `videoWorkspace`, `imageWorkspace`, and `support`. Derive paths with `new URL(path, origin)`.
- [ ] Keep the library destination canonical at /app/library. Add a workspace destination per job: /app?job=<id> for video and /app/image?job=<id> for images, matching the existing workspace deep-link contract.
- [ ] Run the focused test and `git diff --check`.
- [ ] Commit.

```bash
git add frontend/src/server/agent-api/account-destinations.ts frontend/src/server/agent-api/types.ts tests/mcp-account-destinations.test.ts
git commit -m "feat(mcp): add canonical account destinations"
```

## Task 2: Make account and credit guidance explicit

**Files:**
- Modify: `frontend/src/server/agent-api/account-status.ts`
- Modify: `frontend/src/server/agent-api/types.ts`
- Modify: `frontend/src/server/mcp/tools/get-account-status.ts`
- Modify: `tests/mcp-account-status.test.ts`
- Modify: `tests/mcp-tools-contract.test.ts`

- [ ] Extend the failing account-status expectations to require `destinations`, retain wallet amounts, omit email, and keep the current account/client binding.
- [ ] Add `destinations: AgentAccountDestinations` to `AgentAccountStatus` and build it from the existing trusted `accountUrl` dependency.
- [ ] Use this exact selection description:

```text
Use this to check the connected MaxVideoAI account, current credit balance, trial state, spending limits, and safe account destinations. It never reveals payment details or changes the wallet.
```

- [ ] Assert that the result answers both “how many credits do I have?” and “where can I add credits?” without hard-coded URLs in the skill.
- [ ] Run focused tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-account-status.test.ts tests/mcp-tools-contract.test.ts
git add frontend/src/server/agent-api/account-status.ts frontend/src/server/agent-api/types.ts frontend/src/server/mcp/tools/get-account-status.ts tests/mcp-account-status.test.ts tests/mcp-tools-contract.test.ts
git commit -m "feat(mcp): expose account and credit destinations"
```

## Task 3: Return a complete top-up and fresh-quote state machine

**Files:**
- Modify: `frontend/src/server/agent-api/topup-handoff.ts`
- Modify: `frontend/src/server/mcp/tools/create-topup-link.ts`
- Modify: `tests/mcp-topup-handoff.test.ts`
- Modify: `tests/mcp-prepare-generation.test.ts`

- [ ] Add failing expectations for both branches: insufficient funds returns a short-lived top-up destination and sufficient funds preserves the quote and returns the current confirmation action.
- [ ] Replace ambiguous string guidance with this result contract:

```ts
type McpTopupHandoff = {
  topupRequired: true;
  amountCents: number;
  currency: 'USD';
  quoteIntentId: string;
  expiresAt: number;
  destination: AgentOpenUrlDestination;
  freshQuoteRequired: true;
  nextActionAfterFunding: {
    tool: 'get_account_status';
    then: 'prepare_generation';
  };
};
```

- [ ] Keep signing, quote locking, wallet read, quote invalidation, and origin validation unchanged. The new destination only wraps the validated handoff URL.
- [ ] State in the tool description that MaxVideoAI collects payment on the website, the old quote becomes invalid, and funding must be followed by an account refresh plus a new exact quote.
- [ ] Assert that no Stripe session ID, client secret, card field, or direct wallet mutation action is returned.
- [ ] Run focused tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-topup-handoff.test.ts tests/mcp-prepare-generation.test.ts
git add frontend/src/server/agent-api/topup-handoff.ts frontend/src/server/mcp/tools/create-topup-link.ts tests/mcp-topup-handoff.test.ts tests/mcp-prepare-generation.test.ts
git commit -m "feat(mcp): clarify topup and requote flow"
```

## Task 4: Attach library continuity to confirmation and recovery

**Files:**
- Modify: `frontend/src/server/agent-api/generation-status.ts`
- Modify: `frontend/src/server/agent-api/confirm-generation.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Modify: `frontend/src/server/mcp/tools/confirm-generation.ts`
- Modify: `frontend/src/server/mcp/tools/get-generation-status.ts`
- Modify: `frontend/src/server/mcp/tools/list-recent-generations.ts`
- Modify: `tests/mcp-confirm-generation.test.ts`
- Modify: `tests/mcp-generation-recovery-tools.test.ts`
- Modify: `tests/recent-generations-service.test.ts`
- Modify: `tests/media-library-contract.test.ts`

- [ ] Add failing tests for accepted, running, completed, and failed jobs. Require a canonical library destination on every owned recovery; require result resource links only for completed jobs.
- [ ] Enrich only the agent DTO:

```ts
export type AgentGenerationRecovery = {
  // existing safe generation fields
  library: AgentOpenUrlDestination;
  workspace: AgentOpenUrlDestination;
  savedToLibrary: boolean;
  retry: AgentGenerationRetry | null;
};
```

- [ ] Set `savedToLibrary` to `true` only for `completed`. Accepted/running return a retry. Failed returns no result and preserves the safe payment/refund/failure state.
- [ ] Make `confirm_generation` return the same enriched recovery contract, so its first response contains a recoverable job ID, status, destinations, and retry guidance.
- [ ] Add an architecture assertion that web history and agent recovery still select user-owned rows from `app_jobs`; do not add an MCP-specific jobs table.
- [ ] Update tool descriptions so recent history explicitly matches the connected user’s MaxVideoAI library.
- [ ] Run focused tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-confirm-generation.test.ts tests/mcp-generation-recovery-tools.test.ts tests/recent-generations-service.test.ts tests/media-library-contract.test.ts
git add frontend/src/server/agent-api/generation-status.ts frontend/src/server/agent-api/confirm-generation.ts frontend/src/server/mcp/server.ts frontend/src/server/mcp/tools/confirm-generation.ts frontend/src/server/mcp/tools/get-generation-status.ts frontend/src/server/mcp/tools/list-recent-generations.ts tests/mcp-confirm-generation.test.ts tests/mcp-generation-recovery-tools.test.ts tests/recent-generations-service.test.ts tests/media-library-contract.test.ts
git commit -m "feat(mcp): connect generation recovery to library"
```

## Task 5: Make private reference uploads discoverable after completion

**Files:**
- Modify: `frontend/src/server/agent-api/create-reference-upload-link.ts`
- Modify: `frontend/src/server/mcp/tools/create-reference-upload-link.ts`
- Modify: `frontend/app/(core)/mcp/reference-upload/[token]/_components/ReferenceUploadClient.tsx`
- Modify: `tests/mcp-reference-upload-handoff.test.ts`
- Modify: `tests/mcp-reference-direct-upload.test.ts`
- Modify: `tests/mcp-list-media.test.ts`

- [ ] Read the closest nested `AGENTS.md` before changing the authenticated upload UI.
- [ ] Add failing tests requiring an upload `destination`, the canonical `library`, and a typed `list_media` next action for the same media kind.
- [ ] Replace the free-form `nextAction` string:

```ts
return {
  destination: uploadDestination,
  expiresAt,
  mediaKind: input.kind,
  accepted: [...policy.accepted],
  maxBytes: policy.maxBytes,
  library: destinations.library,
  nextAction: { tool: 'list_media', arguments: { kind: input.kind } },
};
```

- [ ] On successful browser upload, say that the private file is saved to the connected MaxVideoAI library and can be selected again after refreshing `list_media`.
- [ ] Keep file bytes in the existing direct-upload flow; never send them through MCP or expose private storage URLs.
- [ ] Run focused tests and commit.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-reference-upload-handoff.test.ts tests/mcp-reference-direct-upload.test.ts tests/mcp-list-media.test.ts
git add frontend/src/server/agent-api/create-reference-upload-link.ts frontend/src/server/mcp/tools/create-reference-upload-link.ts 'frontend/app/(core)/mcp/reference-upload/[token]/_components/ReferenceUploadClient.tsx' tests/mcp-reference-upload-handoff.test.ts tests/mcp-reference-direct-upload.test.ts tests/mcp-list-media.test.ts
git commit -m "feat(mcp): explain reference library continuity"
```

## Task 6: Teach hosts the complete customer journey

**Files:**
- Modify: `frontend/src/server/mcp/instructions.ts`
- Modify: `plugins/maxvideoai/skills/maxvideoai/SKILL.md`
- Modify: `plugins/maxvideoai/skills/maxvideoai/references/generation-safety.md`
- Modify: `plugins/maxvideoai/README.md`
- Modify: `tests/mcp-instructions.test.ts`
- Modify: `tests/mcp-plugin-contract.test.ts`

- [ ] Add failing assertions for balance lookup, returned top-up URL, required re-quote after funding, exact quote approval, recovery instead of resubmission, library continuity, private image/video/audio reference selection, and technical failure versus creative retry.
- [ ] Keep creative guidance open. The host may ask questions, create prompts and references, and propose quality-first or lower-cost plans; live tools remain authoritative for executable facts.
- [ ] Remove the obsolete “online host loading is unverified” paragraph from the distributable skill. Compatibility evidence belongs in runbooks and the claims matrix.
- [ ] Update the README outcome to “Plan and generate from ChatGPT, Claude, or Codex” and explain that generation uses existing MaxVideoAI credits and the same account library.
- [ ] Run focused tests and both package validators.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-instructions.test.ts tests/mcp-plugin-contract.test.ts
python3 /Users/adrienmillot/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/maxvideoai/skills/maxvideoai
python3 /Users/adrienmillot/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/maxvideoai
```

- [ ] Update the local plugin through the cachebuster/reinstall helper, not by editing the personal marketplace manifest by hand. Start a new Codex task after reinstall so the updated schema is loaded.
- [ ] Commit.

```bash
git add frontend/src/server/mcp/instructions.ts plugins/maxvideoai tests/mcp-instructions.test.ts tests/mcp-plugin-contract.test.ts
git commit -m "docs(plugin): guide credits recovery and library use"
```

## Task 7: Expand deterministic tool-selection evaluations

**Files:**
- Modify: `tests/fixtures/mcp-tool-selection-prompts.json`
- Modify: `tests/fixtures/mcp-tool-selection-curated-policy.json`
- Modify: `frontend/scripts/qa/mcp-tool-selection-contract.ts`
- Modify: `frontend/scripts/qa/mcp-tool-selection-scoring.ts`
- Modify: `tests/mcp-tool-selection-eval.test.ts`
- Modify: `docs/marketing/mcp-tool-selection-scorecard.md`

- [ ] Add exact fixtures:

| Intent | Required tools/order |
| --- | --- |
| “Where do I add credits?” | `get_account_status` |
| “This quote says I need credits” | `create_topup_link` only after a prepared quote |
| “I have topped up, continue” | `get_account_status`, `prepare_generation`; prohibit immediate confirmation |
| “Where is yesterday’s video?” | `list_recent_generations` |
| “Open the result I just made” | `get_generation_status` when job ID is known |
| “Use an audio reference from my account” | `get_model_details`, `list_media` |
| “Upload a new video reference” | `get_model_details`, `create_reference_upload_link`, then `list_media` |
| “It failed, try again” | `get_generation_status`; prohibit automatic paid resubmission |

- [ ] Add negative fixtures for direct card/payment-data requests, invented MaxVideoAI URLs, and confirmation without a current quote.
- [ ] Regenerate the policy fingerprint with the existing evaluator workflow; do not hand-edit it.
- [ ] Run the evaluator and commit.

```bash
pnpm --prefix frontend run qa:mcp-tool-selection
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-tool-selection-eval.test.ts
git add tests/fixtures/mcp-tool-selection-prompts.json tests/fixtures/mcp-tool-selection-curated-policy.json frontend/scripts/qa/mcp-tool-selection-contract.ts frontend/scripts/qa/mcp-tool-selection-scoring.ts tests/mcp-tool-selection-eval.test.ts docs/marketing/mcp-tool-selection-scorecard.md
git commit -m "test(mcp): cover customer continuity decisions"
```

## Task 8: Verify hosted continuity without unnecessary spend

**Files:**
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify: `docs/operations/mcp-paid-generation-runbook.md`
- Modify: `docs/marketing/mcp-launch-evidence.md`
- Modify: `docs/marketing/mcp-public-claims-matrix.md`

- [ ] Deploy the exact committed revision to the dedicated MCP staging project with `scripts/deploy-mcp-staging-vercel.sh`; do not deploy the production project.
- [ ] Run no-cost hosted checks first: OAuth, account status, destinations, model lookup, project budget, quote preparation, top-up handoff creation, reference upload handoff, media listing, and recovery of existing jobs.
- [ ] Verify in a fresh Codex task and a fresh Claude connection that returned `open_url` actions are clickable and use the staging origin.
- [ ] Reuse an existing completed staging job to prove MCP recovery and `/app/library` show the same owned media.
- [ ] If a new paid canary is still necessary, stop and request a maximum credit budget. Generate one short reusable marketing candidate and record model, mode, quote, confirmation, job ID, checksum, library visibility, and refund state if it fails.
- [ ] Test revocation and reconnect after other evidence so the session is not disrupted prematurely.
- [ ] Replace stale “local only / Task 10” evidence with exact host/version, revision, endpoint, and observed behavior.
- [ ] Run the full continuity suite and commit evidence separately.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-account-destinations.test.ts tests/mcp-account-status.test.ts tests/mcp-topup-handoff.test.ts tests/mcp-confirm-generation.test.ts tests/mcp-generation-recovery-tools.test.ts tests/mcp-reference-upload-handoff.test.ts tests/mcp-instructions.test.ts tests/mcp-plugin-contract.test.ts tests/mcp-tool-selection-eval.test.ts
git diff --check
git add docs/operations/mcp-host-compatibility-matrix.md docs/operations/mcp-paid-generation-runbook.md docs/marketing/mcp-launch-evidence.md docs/marketing/mcp-public-claims-matrix.md
git commit -m "docs(mcp): record hosted continuity evidence"
```
