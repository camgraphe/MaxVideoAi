# Operational Seedance 2.5 MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Seedance 2.5 fully executable through the hosted MaxVideoAI MCP staging service across `t2v`, `i2v`, `ref2v`, `v2v`, and `extend`, with private multimodal references and the existing quote/confirmation/wallet protections.

**Architecture:** Add one surface-aware model executability owner and one exact-host staging operational gate. Extend the canonical generation and private-media contracts through the existing quote, reservation, provider, receipt, and recovery owners; keep storage URLs and provider credentials server-only. Deploy only the clean tracked branch to the dedicated staging project, then perform one explicitly confirmed low-cost real generation.

**Tech Stack:** TypeScript, Next.js App Router, MCP TypeScript SDK, Zod v4, PostgreSQL/Neon, Supabase OAuth, Vercel, BytePlus ModelArk, Node test runner through `tsx`.

**Spec:** `docs/superpowers/specs/2026-08-25-mcp-seedance-2-5-operational-design.md`

## Global Constraints

- Work only in `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/mcp-foundation` on `codex/mcp-foundation-clean`.
- Do not merge to `main`, deploy the production project, change production domains, or enable public indexing.
- Keep all eight values in `frontend/config/mcp-publication.json` equal to `false`.
- "Without restriction" removes accidental MCP and admin-only limitations; it does not remove exact quotes, explicit confirmation, wallet balance checks, spending controls, idempotent charging, reconciliation, or refunds.
- Never write a provider credential, OAuth token, database URL, raw storage URL, or upstream error body to Git, reports, test output, or logs.
- Provider identifiers remain in provider adapters; do not add provider IDs to `frontend/config/model-registry.json`.
- Do not edit generated model projections directly. If authored registry policy changes, use the model-registry generation commands and commit every projection together.
- Each production change begins with a focused failing test, reaches focused green, receives a diff review, and is committed separately.
- The only authorized provider-spend validation is one 4-second 480p Seedance 2.5 generation after the exact quote is shown and explicitly confirmed.

## File Structure Map

- `frontend/src/server/agent-runtime/model-executability.ts`: sole model-level MCP execution decision and safe internal reason codes.
- `frontend/src/server/images/byteplus-seedream-policy.ts`: Seedream direct-route readiness, shared by discovery and execution.
- `frontend/src/server/mcp/operational-access.ts`: exact-host staging operational capabilities; never owns provider credentials.
- `frontend/src/server/mcp/http-handler.ts`: request adapter that passes one runtime-capability decision into tool registration and backing services.
- `frontend/src/server/agent-api/generation-types.ts`: canonical public MCP mode/reference types.
- `frontend/src/server/agent-api/generation-normalization.ts`: strict closed-world canonicalization for the five video modes.
- `frontend/src/server/agent-api/generation-capability-validation.ts`: mode-specific requirements and provider constraint projection.
- `frontend/src/server/agent-api/reference-media-policy.ts`: pure MIME/kind policy for private image, video, and audio references.
- `frontend/src/server/agent-api/media-types.ts`, `media-library.ts`, `reference-assets.ts`, `reference-types.ts`: public safe DTOs and private owned-asset resolution.
- `frontend/src/server/agent-api/reference-upload-sessions.ts`, `create-reference-upload-link.ts`: short-lived upload handoff carrying an immutable requested media kind.
- `frontend/src/server/uploads/create-reference-upload-post-handler.ts` and the existing image/video/audio upload owners: authenticated ingestion without parallel storage logic.
- `frontend/src/server/agent-api/paid-generation-execution.ts`: mode-aware projection of immutable confirmed references into the existing app generation request body.
- `frontend/src/server/mcp/tools/*.ts`, `server.ts`, `instructions.ts`: strict tool schemas, runtime inventory, and host guidance.
- `scripts/deploy-mcp-staging-vercel.sh`, `docs/operations/mcp-staging-deployment.md`: isolated operational-staging allowlist, invariants, and deployment runbook.

---

### Task 1: Make provider executability surface-aware

**Files:**
- Create: `frontend/src/server/images/byteplus-seedream-policy.ts`
- Modify: `frontend/src/server/agent-runtime/model-executability.ts`
- Modify: `frontend/src/server/images/byteplus-seedream-execution.ts`
- Modify: `frontend/src/server/agent-api/model-catalog.ts`
- Test: `tests/mcp-model-catalog.test.ts`
- Test: `tests/mcp-model-details.test.ts`
- Create: `tests/mcp-model-executability.test.ts`

**Interfaces:**
- Consumes: existing Seedance profile functions in `byteplus-modelark.ts` and `byteplus-modelark-profile-policy.ts`.
- Produces: `resolveAgentGenerationEngineExecutability(engine): AgentGenerationExecutabilityDecision` and the compatibility boolean `isAgentGenerationEngineExecutable(engine): boolean`.
- Produces: `assertBytePlusSeedreamExecutable(engine): void`, used by the image execution path before provider submission.

- [ ] **Step 1: Write the failing provider-policy tests**

```ts
test('Seedream readiness is not evaluated as a Seedance video profile', () => {
  const decision = resolveAgentGenerationEngineExecutability(seedreamEngine, {
    bytePlusEnabled: true,
    bytePlusApiKey: 'test-key',
  });
  assert.deepEqual(decision, { executable: true, reason: 'available' });
});

test('direct BytePlus models fail closed without the required credential', () => {
  assert.equal(
    resolveAgentGenerationEngineExecutability(seedreamEngine, {
      bytePlusEnabled: true,
      bytePlusApiKey: '',
    }).reason,
    'provider_credentials_missing',
  );
});
```

- [ ] **Step 2: Run the new executability test and record the red state**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-executability.test.ts`

Expected: FAIL because the decision API and Seedream policy do not exist and the current resolver treats `byteplus_modelark` Seedream as an unsupported Seedance profile.

- [ ] **Step 3: Implement the pure Seedream readiness policy**

```ts
export type BytePlusSeedreamReadiness = Readonly<{
  executable: boolean;
  reason: 'available' | 'provider_disabled' | 'provider_credentials_missing' | 'model_unsupported';
}>;

export function resolveBytePlusSeedreamReadiness(
  engine: EngineCaps,
  env: Readonly<{ bytePlusEnabled: boolean; bytePlusApiKey: string | undefined }>,
): BytePlusSeedreamReadiness {
  if (!['seedream', 'seedream-5-0-pro'].includes(engine.id)) {
    return { executable: false, reason: 'model_unsupported' };
  }
  if (!env.bytePlusEnabled) return { executable: false, reason: 'provider_disabled' };
  if (!env.bytePlusApiKey?.trim()) {
    return { executable: false, reason: 'provider_credentials_missing' };
  }
  return { executable: true, reason: 'available' };
}
```

- [ ] **Step 4: Dispatch executability by exact model family and surface**

Implement the decision union in `model-executability.ts`. Seedance engines continue through the existing profile policy; Seedream engines use `resolveBytePlusSeedreamReadiness`; unrelated engines keep the current available result. Catch malformed provider configuration and return `profile_invalid` rather than throwing.

- [ ] **Step 5: Enforce the same Seedream readiness immediately before execution**

Call `assertBytePlusSeedreamExecutable(params.engine)` before constructing the provider request. Preserve the existing sanitized `BytePlusSeedreamError` mapping and refund path.

- [ ] **Step 6: Run catalog, details, and executability tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-executability.test.ts tests/mcp-model-catalog.test.ts tests/mcp-model-details.test.ts`

Expected: PASS, including Seedream true with a configured test credential, false without it, Seedance 2.5 flag/admin parity, and no change for unrelated models.

- [ ] **Step 7: Commit Task 1**

```bash
git add frontend/src/server/agent-runtime/model-executability.ts frontend/src/server/images/byteplus-seedream-policy.ts frontend/src/server/images/byteplus-seedream-execution.ts frontend/src/server/agent-api/model-catalog.ts tests/mcp-model-executability.test.ts tests/mcp-model-catalog.test.ts tests/mcp-model-details.test.ts
git commit -m "fix(mcp): align direct provider executability"
```

### Task 2: Add an exact-host operational staging gate

**Files:**
- Create: `frontend/src/server/mcp/operational-access.ts`
- Modify: `frontend/src/server/mcp/http-handler.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Modify: `frontend/src/server/agent-api/prepare-generation.ts`
- Modify: `frontend/src/server/agent-api/confirm-generation.ts`
- Modify: `frontend/src/server/mcp/feature-access.ts`
- Modify: `frontend/app/(core)/mcp/reference-upload/[token]/page.tsx`
- Modify: `frontend/app/api/mcp/reference-upload/[token]/route.ts`
- Test: `tests/mcp-staging-enablement.test.ts`
- Test: `tests/mcp-default-services-config.test.ts`
- Test: `tests/mcp-transport-contract.test.ts`
- Test: `tests/mcp-reference-upload-handoff.test.ts`

**Interfaces:**
- Consumes: existing exact staging-host validation in `feature-access.ts`.
- Produces: `resolveMcpRuntimeCapabilities(env, requestHost): { paidGeneration: boolean; referenceUploads: boolean }`.
- Produces: one `MaxVideoAiMcpServerOptions` value passed to both tool registration and prepare/confirm service dependencies.

- [ ] **Step 1: Write failing exact-host capability tests**

```ts
assert.deepEqual(resolveMcpRuntimeCapabilities({
  ...stagingEnv,
  MCP_STAGING_OPERATIONAL_ENABLED: 'true',
}, 'maxvideoai-mcp-staging.vercel.app'), {
  paidGeneration: true,
  referenceUploads: true,
});

for (const host of ['maxvideoai.com', 'www.maxvideoai.com', 'api.maxvideoai.com', 'other.vercel.app']) {
  assert.deepEqual(resolveMcpRuntimeCapabilities({
    ...stagingEnv,
    MCP_STAGING_OPERATIONAL_ENABLED: 'true',
  }, host), { paidGeneration: false, referenceUploads: false });
}
```

- [ ] **Step 2: Run staging and service tests to record red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-staging-enablement.test.ts tests/mcp-default-services-config.test.ts tests/mcp-transport-contract.test.ts tests/mcp-reference-upload-handoff.test.ts`

Expected: FAIL because operational capabilities do not exist and the hosted server still exposes only five read-only tools.

- [ ] **Step 3: Implement the immutable runtime capability decision**

```ts
export type McpRuntimeCapabilities = Readonly<{
  paidGeneration: boolean;
  referenceUploads: boolean;
}>;

export function resolveMcpRuntimeCapabilities(
  env: Readonly<Record<string, string | undefined>>,
  requestHost: string | null,
): McpRuntimeCapabilities {
  const operationalStaging = env.MCP_STAGING_OPERATIONAL_ENABLED === 'true'
    && isMcpFoundationFeatureEnabled('transport', env, requestHost)
    && isMcpFoundationFeatureEnabled('oauth', env, requestHost);
  return Object.freeze({
    paidGeneration: FEATURES.mcp.paidGeneration || operationalStaging,
    referenceUploads: FEATURES.mcp.referenceUploads || operationalStaging,
  });
}
```

- [ ] **Step 4: Pass one decision through HTTP, server, and services**

Change `createDefaultMaxVideoAiMcpServices` to accept the resolved capabilities. Inject `paidGenerationEnabled: () => capabilities.paidGeneration` into both service factories. Pass the same object to `createMaxVideoAiMcpServer`; do not recompute the flag inside a downstream service.

- [ ] **Step 5: Gate the reference upload page and route with the same exact-host helper**

Read the request host through the existing Next.js host-routing owner and call the operational gate. A production host with static flags false continues to return not found.

- [ ] **Step 6: Expand audit-safe tool recognition**

Add only the approved tool names to `AUDITABLE_TOOL_NAMES`: `prepare_generation`, `confirm_generation`, `get_generation_status`, `list_recent_generations`, `create_topup_link`, `list_media`, and `create_reference_upload_link`. Preserve the current safe event shape without arguments or URLs.

- [ ] **Step 7: Run the Task 2 matrix**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-staging-enablement.test.ts tests/mcp-default-services-config.test.ts tests/mcp-transport-contract.test.ts tests/mcp-reference-upload-handoff.test.ts tests/mcp-audit-events.test.ts`

Expected: PASS; exact staging host exposes operational tools when the new flag is true, while every production or mismatched host stays closed.

- [ ] **Step 8: Commit Task 2**

```bash
git add frontend/src/server/mcp/operational-access.ts frontend/src/server/mcp/http-handler.ts frontend/src/server/mcp/server.ts frontend/src/server/mcp/feature-access.ts frontend/src/server/agent-api/prepare-generation.ts frontend/src/server/agent-api/confirm-generation.ts 'frontend/app/(core)/mcp/reference-upload/[token]/page.tsx' 'frontend/app/api/mcp/reference-upload/[token]/route.ts' tests/mcp-staging-enablement.test.ts tests/mcp-default-services-config.test.ts tests/mcp-transport-contract.test.ts tests/mcp-reference-upload-handoff.test.ts tests/mcp-audit-events.test.ts
git commit -m "feat(mcp): enable operational hosted staging"
```

### Task 3: Extend the canonical contract to `v2v` and `extend`

**Files:**
- Modify: `frontend/src/server/agent-api/generation-types.ts`
- Modify: `frontend/src/server/agent-api/generation-normalization.ts`
- Modify: `frontend/src/server/agent-api/public-engine-policy.ts`
- Modify: `frontend/src/server/agent-api/generation-capability-validation.ts`
- Modify: `frontend/src/server/agent-api/project-budget.ts`
- Modify: `frontend/src/server/mcp/tools/prepare-generation.ts`
- Modify: `frontend/src/server/mcp/tools/calculate-project-budget.ts`
- Test: `tests/mcp-generation-normalization.test.ts`
- Test: `tests/mcp-generation-capabilities.test.ts`
- Test: `tests/mcp-model-catalog.test.ts`
- Test: `tests/mcp-project-budget.test.ts`
- Test: `tests/mcp-tools-contract.test.ts`

**Interfaces:**
- Produces: `CanonicalGenerationMode = 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend' | 't2i' | 'i2i'`.
- Produces: `CanonicalReferenceMediaKind = 'image' | 'video' | 'audio'`; HTTPS references must declare it, while owned asset references derive it from the owner-verified database row.
- Produces: project-budget video lines accepting the same five video modes.
- Consumes: mode-specific `EngineModeUiCaps` from the existing Seedance 2.5 engine registry.

- [ ] **Step 1: Replace the current rejection assertions with failing positive mode contracts**

```ts
for (const mode of ['v2v', 'extend'] as const) {
  const normalized = normalizeGenerationRequest({
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-5',
    mode,
    prompt: 'Continue the cinematic scene.',
    settings: { durationSec: 4, resolution: '480p', audio: true },
    references: [{ kind: 'asset', assetId: 'video-1', role: 'source' }],
    outputCount: 1,
  });
  assert.equal(normalized.mode, mode);
}
```

- [ ] **Step 2: Run normalization, capability, catalog, budget, and tool tests to record red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-generation-normalization.test.ts tests/mcp-generation-capabilities.test.ts tests/mcp-model-catalog.test.ts tests/mcp-project-budget.test.ts tests/mcp-tools-contract.test.ts`

Expected: FAIL at the canonical mode union, public-mode filter, tool schemas, and project-budget mode validator.

- [ ] **Step 3: Extend the type union and closed-world sets**

Add `v2v` and `extend` to `MODE_SET`, `VIDEO_MODE_SET`, and `SETTING_KEYS_BY_MODE`, both mapped to the existing `VIDEO_SETTING_KEYS`. Add both modes to the Zod enums in prepare and project-budget tools.

Extend only the HTTPS reference variant so its media type is explicit and cannot be guessed from a URL:

```ts
export type CanonicalReferenceMediaKind = 'image' | 'video' | 'audio';

type CanonicalHttpsGenerationReference = {
  kind: 'https';
  url: string;
  role: CanonicalGenerationReferenceRole;
  mediaKind: CanonicalReferenceMediaKind;
};
```

Add `mediaKind` to the exact HTTPS field set and to the prepare tool's HTTPS-reference Zod object. Include it in canonical identity/hashing. Keep the asset variant unchanged because its kind is verified from `media_assets`.

- [ ] **Step 4: Make capability validation mode-aware**

Require at least one `source` reference for `v2v` and `extend`; preserve `i2v` first/source image semantics. Enforce Seedance's registry-owned per-mode caps and reference budget. Reject an aspect ratio when source-framed mode caps omit it.

- [ ] **Step 5: Expose exact public modes only when mode caps exist**

Add `v2v` and `extend` to `VIDEO_MODES` in `public-engine-policy.ts`. Keep the catalog's existing `modeCaps` check so an engine cannot advertise a mode with no executable UI contract.

- [ ] **Step 6: Run Task 3 tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-generation-normalization.test.ts tests/mcp-generation-capabilities.test.ts tests/mcp-model-catalog.test.ts tests/mcp-project-budget.test.ts tests/mcp-tools-contract.test.ts`

Expected: PASS for all five Seedance modes and continued rejection of `retake` and surface/mode mismatches.

- [ ] **Step 7: Commit Task 3**

```bash
git add frontend/src/server/agent-api/generation-types.ts frontend/src/server/agent-api/generation-normalization.ts frontend/src/server/agent-api/public-engine-policy.ts frontend/src/server/agent-api/generation-capability-validation.ts frontend/src/server/agent-api/project-budget.ts frontend/src/server/mcp/tools/prepare-generation.ts frontend/src/server/mcp/tools/calculate-project-budget.ts tests/mcp-generation-normalization.test.ts tests/mcp-generation-capabilities.test.ts tests/mcp-model-catalog.test.ts tests/mcp-project-budget.test.ts tests/mcp-tools-contract.test.ts
git commit -m "feat(mcp): expose full Seedance video modes"
```

### Task 4: Generalize private media listing and ownership resolution

**Files:**
- Modify: `frontend/src/server/agent-api/reference-media-policy.ts`
- Modify: `frontend/src/server/agent-api/media-types.ts`
- Modify: `frontend/src/server/agent-api/reference-types.ts`
- Modify: `frontend/src/server/agent-api/media-library.ts`
- Modify: `frontend/src/server/agent-api/reference-assets.ts`
- Modify: `frontend/src/server/agent-api/resolve-generation-references.ts`
- Modify: `frontend/src/server/mcp/tools/list-media.ts`
- Test: `tests/mcp-media-contract.test.ts`
- Test: `tests/mcp-list-media.test.ts`
- Test: `tests/mcp-reference-ownership.test.ts`
- Test: `tests/mcp-reference-generation.test.ts`

**Interfaces:**
- Produces: `AgentMediaKind` as a type alias of `CanonicalReferenceMediaKind` and an exact public DTO with `durationSec` in addition to existing safe dimensions.
- Produces: `ResolvedReference.mediaKind` and server-only `storageUrl`.
- Produces: `listAgentMedia({ kind?, cursor?, limit? }, principal)` with one exact owner query per requested page.

- [ ] **Step 1: Write failing type and runtime tests for video/audio media**

```ts
assert.deepEqual(videoItem, {
  assetId: 'video-1', kind: 'video', label: 'Opening shot',
  width: 1920, height: 1080, durationSec: 4,
  mimeType: 'video/mp4', previewUrl: signedPreview,
  source: 'upload', createdAt,
});
assert.equal(Object.hasOwn(videoItem, 'storageUrl'), false);
```

Add rejection cases for HTML/SVG/octet-stream media, unsupported containers, missing MIME, deleted records, non-ready records, cross-user IDs, oversized duration metadata, and malformed storage hosts.

- [ ] **Step 2: Run media tests to record red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-media-contract.test.ts tests/mcp-list-media.test.ts tests/mcp-reference-ownership.test.ts tests/mcp-reference-generation.test.ts`

Expected: FAIL because the DTO and resolver currently allow raster images only.

- [ ] **Step 3: Add pure exact MIME policies**

Keep the existing raster allowlist. Add canonical allowlists for the actual MaxVideoAI upload owners: `video/mp4`, `video/quicktime`, `audio/mpeg`, `audio/wav`, `audio/x-wav`, and `audio/mp4`. Return `{ kind, canonicalMime }` or `null`; do not infer a kind from filename extensions.

- [ ] **Step 4: Extend the public DTO without exposing storage data**

```ts
export type AgentMediaItem = {
  assetId: string;
  kind: 'image' | 'video' | 'audio';
  label: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  mimeType: string;
  previewUrl: string | null;
  source: 'upload' | 'generated' | 'imported';
  createdAt: string;
};
```

- [ ] **Step 5: Preserve owner-scoped reads and non-leak errors**

Query `media_assets` with both ID and user ID. Validate kind, MIME, ready state, deletion, dimensions/duration, and controlled storage host after the query. Missing and other-user assets both return `REFERENCE_NOT_FOUND`; impossible owner mismatches remain a fail-closed internal branch.

- [ ] **Step 6: Extend `list_media` schema and copy**

Add optional `kind: z.enum(['image', 'video', 'audio'])`. Update title and description to say private reference media, not images. A missing kind lists all supported kinds in canonical library order.

- [ ] **Step 7: Run Task 4 tests and mutation checks**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-media-contract.test.ts tests/mcp-list-media.test.ts tests/mcp-reference-ownership.test.ts tests/mcp-reference-generation.test.ts`

Expected: PASS. Temporarily adding `storageUrl` to the DTO fixture or allowing `text/html` must make the contract suite fail; restore the production shape before commit.

- [ ] **Step 8: Commit Task 4**

```bash
git add frontend/src/server/agent-api/reference-media-policy.ts frontend/src/server/agent-api/media-types.ts frontend/src/server/agent-api/reference-types.ts frontend/src/server/agent-api/media-library.ts frontend/src/server/agent-api/reference-assets.ts frontend/src/server/agent-api/resolve-generation-references.ts frontend/src/server/mcp/tools/list-media.ts tests/mcp-media-contract.test.ts tests/mcp-list-media.test.ts tests/mcp-reference-ownership.test.ts tests/mcp-reference-generation.test.ts
git commit -m "feat(mcp): support private multimodal references"
```

### Task 5: Make the upload handoff media-kind aware

**Files:**
- Modify: `frontend/src/server/agent-api/reference-upload-sessions.ts`
- Modify: `frontend/src/server/agent-api/create-reference-upload-link.ts`
- Modify: `frontend/src/server/uploads/create-reference-upload-post-handler.ts`
- Modify: `frontend/app/(core)/mcp/reference-upload/[token]/page.tsx`
- Modify: `frontend/app/(core)/mcp/reference-upload/[token]/_components/ReferenceUploadClient.tsx`
- Modify: `frontend/app/api/mcp/reference-upload/[token]/route.ts`
- Modify: `frontend/src/server/mcp/tools/create-reference-upload-link.ts`
- Reuse: `frontend/app/api/uploads/video/_lib/video-upload-limits.ts`
- Reuse: `frontend/app/api/uploads/audio/_lib/audio-upload-handler.ts`
- Test: `tests/mcp-reference-upload-sessions.test.ts`
- Test: `tests/mcp-reference-upload-handoff.test.ts`
- Test: `tests/mcp-reference-upload-migration.test.ts`

**Interfaces:**
- Produces: `createReferenceUploadLink({ kind }, principal)` where kind is `image`, `video`, or `audio`.
- Produces: an upload session whose server-owned record binds user ID, OAuth client ID, requested media kind, expiry, and one-time consumption.

- [ ] **Step 1: Write failing session and upload tests for kind binding**

```ts
const link = await service({ kind: 'video' }, principal);
assert.deepEqual(link.accepted, ['video/mp4', 'video/quicktime']);
assert.equal(link.mediaKind, 'video');
await assert.rejects(
  uploadWithSession(link, audioFile),
  hasAgentCode('REFERENCE_INVALID'),
);
```

- [ ] **Step 2: Run upload suites to record red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-reference-upload-sessions.test.ts tests/mcp-reference-upload-handoff.test.ts tests/mcp-reference-upload-migration.test.ts`

Expected: FAIL because upload sessions and tools are image-only and carry no immutable media kind.

- [ ] **Step 3: Persist the requested kind in the existing upload-session owner**

Add a constrained `media_kind` column with values `image`, `video`, and `audio` through the next Neon migration in the existing MCP migration sequence. Session lookup and one-time consumption must return and compare this value inside the same transaction.

- [ ] **Step 4: Extend the strict tool input and safe response**

```ts
const inputSchema = z.object({
  kind: z.enum(['image', 'video', 'audio']),
}).strict();
```

Return `mediaKind`, exact accepted MIME types, maximum bytes, expiry, and a browser handoff. Do not return a storage destination or presigned provider URL.

- [ ] **Step 5: Reuse existing upload owners by kind**

Keep `storeImageUpload` for images. Route video and audio through the same validation/storage/mirroring functions used by the authenticated workspace upload endpoints. If those functions are route-local, extract only the pure authenticated storage operation into `frontend/src/server/uploads/` and leave the route as an adapter. Do not copy validation tables or database writes.

- [ ] **Step 6: Keep authentication and size checks before multipart parsing**

For every kind: validate session ownership and expiry, validate `Content-Length`, then parse the body, then enforce actual byte count and media-specific metadata. Consume the one-time session only with a successfully stored asset ID.

- [ ] **Step 7: Run upload and exposure tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-reference-upload-sessions.test.ts tests/mcp-reference-upload-handoff.test.ts tests/mcp-reference-upload-migration.test.ts tests/image-upload-route-auth-order.test.ts`

Expected: PASS for image/video/audio, wrong-kind rejection, auth-before-body, expiry, replay prevention, byte limits, and safe response shapes.

- [ ] **Step 8: Commit Task 5**

```bash
git add frontend/src/server/agent-api/reference-upload-sessions.ts frontend/src/server/agent-api/create-reference-upload-link.ts frontend/src/server/uploads/create-reference-upload-post-handler.ts 'frontend/app/(core)/mcp/reference-upload/[token]/page.tsx' 'frontend/app/(core)/mcp/reference-upload/[token]/_components/ReferenceUploadClient.tsx' 'frontend/app/api/mcp/reference-upload/[token]/route.ts' frontend/src/server/mcp/tools/create-reference-upload-link.ts neon/migrations tests/mcp-reference-upload-sessions.test.ts tests/mcp-reference-upload-handoff.test.ts tests/mcp-reference-upload-migration.test.ts
git commit -m "feat(mcp): upload multimodal reference media"
```

### Task 6: Materialize confirmed references by Seedance mode

**Files:**
- Create: `frontend/src/server/agent-api/paid-video-request-body.ts`
- Modify: `frontend/src/server/agent-api/paid-generation-execution.ts`
- Modify: `frontend/src/server/agent-api/generation-capability-validation.ts`
- Modify: `frontend/src/server/video-generation/execution-constraints.ts`
- Test: `tests/mcp-reference-generation.test.ts`
- Create: `tests/mcp-seedance-2-5-request-body.test.ts`
- Modify: `tests/mcp-confirm-generation.test.ts`
- Modify: `tests/integration/mcp-paid-generation.test.ts`

**Interfaces:**
- Consumes: immutable `CanonicalGenerationRequest` and owner-verified `ResolvedReference[]`.
- Produces: `buildPaidVideoRequestBody(execution): Record<string, unknown>` with exact app-generation field names and no provider credentials.

- [ ] **Step 1: Write the failing five-mode projection table**

```ts
const cases = [
  ['i2v', { imageUrl: imageStart, endImageUrl: imageEnd }],
  ['ref2v', { referenceImages: [imageRef], referenceVideos: [videoRef], referenceAudio: [audioRef] }],
  ['v2v', { videoUrl: sourceVideo, referenceImages: [imageRef], referenceAudio: [audioRef] }],
  ['extend', { extensionSourceVideos: [sourceVideo, secondVideo] }],
] as const;
```

Assert that source-derived modes omit `aspectRatio` when their mode caps own framing and that reordering canonical references cannot change ordered source slots unexpectedly.

- [ ] **Step 2: Run the projection and paid-confirmation tests to record red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-seedance-2-5-request-body.test.ts tests/mcp-reference-generation.test.ts tests/mcp-confirm-generation.test.ts`

Expected: FAIL because the current paid request body projects every video reference as an image.

- [ ] **Step 3: Extract a pure mode-aware request-body builder**

Group verified references by `mediaKind` and canonical role. For `https` references, require controlled HTTPS and a declared media kind in the canonical reference contract before provider projection; never guess from a URL suffix. Map the groups to the existing app request-body names consumed by `executeVideoGeneration`.

- [ ] **Step 4: Enforce exact Seedance limits before reservation**

Use the engine registry's `referenceBudget` and field-level counts. Reject missing source video, more than three extend clips, excessive image/video/audio references, wrong media kind for first/last frames, and duplicate canonical references before price or wallet reservation.

- [ ] **Step 5: Preserve quote and reservation invariants**

Keep canonical pricing equality, immutable request hash, one initial job, one wallet reservation, and existing trusted quoted billing unchanged. The extracted builder runs only after ownership resolution and uses no database access.

- [ ] **Step 6: Run unit and disposable-PostgreSQL paid integration tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-seedance-2-5-request-body.test.ts tests/mcp-reference-generation.test.ts tests/mcp-prepare-generation.test.ts tests/mcp-confirm-generation.test.ts tests/mcp-confirm-generation-concurrency.test.ts tests/integration/mcp-paid-generation.test.ts`

Expected: PASS for all five modes, no price/provider call on invalid references, exact single charge, and unchanged known-rejection refund behavior.

- [ ] **Step 7: Commit Task 6**

```bash
git add frontend/src/server/agent-api/paid-video-request-body.ts frontend/src/server/agent-api/paid-generation-execution.ts frontend/src/server/agent-api/generation-capability-validation.ts frontend/src/server/video-generation/execution-constraints.ts tests/mcp-seedance-2-5-request-body.test.ts tests/mcp-reference-generation.test.ts tests/mcp-confirm-generation.test.ts tests/mcp-confirm-generation-concurrency.test.ts tests/integration/mcp-paid-generation.test.ts
git commit -m "feat(mcp): submit multimodal Seedance requests"
```

### Task 7: Align plugin guidance, tool inventory, and recovery

**Files:**
- Modify: `frontend/src/server/mcp/instructions.ts`
- Modify: `frontend/src/server/mcp/tools/list-media.ts`
- Modify: `frontend/src/server/mcp/tools/create-reference-upload-link.ts`
- Modify: `frontend/src/server/mcp/tools/prepare-generation.ts`
- Modify: `plugins/maxvideoai/skills/maxvideoai/SKILL.md`
- Modify: `plugins/maxvideoai/skills/maxvideoai/references/budget-planning.md`
- Modify: `tests/fixtures/mcp-tool-selection-prompts.json`
- Modify: `tests/mcp-instructions.test.ts`
- Modify: `tests/mcp-plugin-contract.test.ts`
- Modify: `tests/mcp-tool-selection-eval.test.ts`
- Modify: `tests/mcp-generation-recovery-tools.test.ts`

**Interfaces:**
- Consumes: operational tool inventory and exact model details.
- Produces: host guidance that recommends Seedance 2.5 when it is the best executable fit, explains all five workflows, and never confirms spend by itself.

- [ ] **Step 1: Write failing instruction and offline-eval fixtures**

Add deterministic fixtures for: quality-first Seedance 2.5 selection; image start/end workflow; multimodal reference workflow; video edit; clip extension; exact quote without confirmation; confirmed submission; status recovery; and a negative case where the user only asks for a budget.

- [ ] **Step 2: Run instruction, plugin, recovery, and evaluator suites to record red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-instructions.test.ts tests/mcp-plugin-contract.test.ts tests/mcp-tool-selection-eval.test.ts tests/mcp-generation-recovery-tools.test.ts`

Expected: FAIL because current copy describes image-only references and the read-only staging inventory.

- [ ] **Step 3: Update concise host guidance**

Tell the host to use exact model details for required fields, upload/list references by media kind, prepare before confirmation, display the exact price, wait for explicit user approval, and use recovery tools rather than submitting a second paid job. Retain best-fit-first and comparable-budget-before-cheaper rules.

- [ ] **Step 4: Update strict tool descriptions and annotations**

`prepare_generation` remains read-only and non-destructive. `confirm_generation` remains the only spend-capable tool. Upload handoff remains non-destructive but open-world. Status and media listing remain read-only.

- [ ] **Step 5: Validate the packaged Skill and plugin**

Run the repository's existing Skill validator and plugin validator commands recorded in `tests/mcp-plugin-contract.test.ts`. Use the existing cached PyYAML path if bare Python lacks `yaml`; do not install a dependency.

- [ ] **Step 6: Run Task 7 tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-instructions.test.ts tests/mcp-plugin-contract.test.ts tests/mcp-tool-selection-eval.test.ts tests/mcp-generation-recovery-tools.test.ts tests/mcp-tools-contract.test.ts`

Expected: PASS with zero forbidden confirmations and zero unsupported capability claims.

- [ ] **Step 7: Commit Task 7**

```bash
git add frontend/src/server/mcp/instructions.ts frontend/src/server/mcp/tools/list-media.ts frontend/src/server/mcp/tools/create-reference-upload-link.ts frontend/src/server/mcp/tools/prepare-generation.ts plugins/maxvideoai/skills/maxvideoai/SKILL.md plugins/maxvideoai/skills/maxvideoai/references/budget-planning.md tests/fixtures/mcp-tool-selection-prompts.json tests/mcp-instructions.test.ts tests/mcp-plugin-contract.test.ts tests/mcp-tool-selection-eval.test.ts tests/mcp-generation-recovery-tools.test.ts tests/mcp-tools-contract.test.ts
git commit -m "docs(plugin): guide full Seedance workflows"
```

### Task 8: Harden operational staging deployment policy

**Files:**
- Modify: `scripts/deploy-mcp-staging-vercel.sh`
- Modify: `docs/operations/mcp-staging-deployment.md`
- Modify: `tests/mcp-staging-vercel-config.test.ts`
- Modify: `tests/mcp-paid-e2e-proof-contract.test.ts`

**Interfaces:**
- Consumes: clean tracked Git HEAD and exact dedicated Vercel project identity.
- Produces: a sanitized preflight proving required operational variable names exist on staging and forbidden production-project mutations remain absent.

- [ ] **Step 1: Write failing deployment-policy tests**

Require the staging script to validate the presence of these names without printing values: `MCP_STAGING_OPERATIONAL_ENABLED`, `BYTEPLUS_ARK_ENABLED`, `BYTEPLUS_ARK_API_KEY`, `SEEDANCE_2_5_BYTEPLUS_ENABLED`, `SEEDANCE_2_5_PROVIDER`, `SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY`, and `SEEDANCE_2_5_BYTEPLUS_MODES`.

Require the exact expected non-secret values in the runbook:

```text
MCP_STAGING_OPERATIONAL_ENABLED=true
BYTEPLUS_ARK_ENABLED=true
SEEDANCE_2_5_BYTEPLUS_ENABLED=true
SEEDANCE_2_5_PROVIDER=byteplus_modelark
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false
SEEDANCE_2_5_BYTEPLUS_MODES=t2v,i2v,ref2v,v2v,extend
```

- [ ] **Step 2: Run staging config tests to record red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-staging-vercel-config.test.ts tests/mcp-paid-e2e-proof-contract.test.ts`

Expected: FAIL because the current runbook explicitly forbids provider credentials and has no operational staging profile.

- [ ] **Step 3: Add a sanitized operational environment preflight**

Use Vercel's environment metadata to compare names and targets only. Do not pull or print decrypted values. Assert the provider key exists only in the dedicated staging project and that production project settings/domains/protection are byte-for-byte unchanged across deployment.

- [ ] **Step 4: Preserve the existing package, no-cron, noindex, and provenance gates**

Keep tracked-HEAD archive hashing, candidate inspection, zero crons, exact `X-Robots-Tag`, anonymous OAuth discovery, MCP 401 challenge, isolated promotion, and production baseline comparison.

- [ ] **Step 5: Document credential handling**

State that `BYTEPLUS_ARK_API_KEY` must be a dedicated staging credential supplied out of band and stored only in Vercel. If no dedicated credential exists, stop with `CREDENTIAL_BLOCKED`; do not substitute a production credential or weaken the preflight.

- [ ] **Step 6: Run staging deployment tests and dry run**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-staging-vercel-config.test.ts tests/mcp-paid-e2e-proof-contract.test.ts`

Run: `./scripts/deploy-mcp-staging-vercel.sh --dry-run`

Expected: tests PASS and dry run prints only a sanitized `SAFE_PACKAGE_OK` line.

- [ ] **Step 7: Commit Task 8**

```bash
git add scripts/deploy-mcp-staging-vercel.sh docs/operations/mcp-staging-deployment.md tests/mcp-staging-vercel-config.test.ts tests/mcp-paid-e2e-proof-contract.test.ts
git commit -m "chore(mcp): gate operational staging deploys"
```

### Task 9: Run the complete local release gate

**Files:**
- Modify only files required to fix regressions introduced by Tasks 1–8.
- Record ignored local evidence under the existing `.superpowers/sdd/` convention without committing secrets or environment values.

**Interfaces:**
- Consumes: every committed task result.
- Produces: a clean, reproducible branch ready for isolated staging deployment.

- [ ] **Step 1: Run the complete MCP and provider regression matrix**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp*.test.ts tests/integration/mcp-paid-generation.test.ts tests/byteplus-provider-architecture.test.ts tests/seedance-2-5*.test.ts tests/seedream*.test.ts`

Expected: zero failures and zero skipped tests in the targeted release matrix.

- [ ] **Step 2: Run static and architecture gates**

Run: `pnpm --prefix frontend exec tsc --noEmit --pretty false`

Run: `npm --prefix frontend run lint`

Run: `npm run lint:exposure`

Run: `pnpm model:registry:check`

Run: `git diff --check`

Expected: every command exits zero; lint reports no new warning.

- [ ] **Step 3: Assert static publication remains closed**

Run an exact JSON assertion that `frontend/config/mcp-publication.json` contains eight keys and every value is `false`.

Expected: PASS with `8/8 false`.

- [ ] **Step 4: Run the production build**

Run: `npm --prefix frontend run build`

Expected: build succeeds, model registry projections are current, and route generation completes.

- [ ] **Step 5: Review the complete branch diff**

Check for raw logs, secrets, production-host bypasses, provider identifiers outside adapters, duplicate pricing formulas, broad URL allowlists, unbounded arrays, and any direct edit to generated model files.

- [ ] **Step 6: Route every regression back to its owning task**

If a gate fails, add the focused regression assertion to the task's named test file, make the smallest owner-local correction, rerun that task's focused command and the complete gate, then create a separate `fix(mcp): close operational release regression` commit containing only those reviewed files. If every gate passes, leave the worktree unchanged and do not create an empty commit.

### Task 10: Deploy staging and prove one real Seedance 2.5 generation

**Files:**
- External staging state only: dedicated Vercel environment metadata and deployment.
- No production project mutation.
- No Git file contains credential values or generated media URLs.

**Interfaces:**
- Consumes: clean locally verified branch, dedicated BytePlus staging credential, connected OAuth test account, sufficient wallet balance, and explicit confirmation of the displayed quote.
- Produces: one terminal Seedance 2.5 job, one matching receipt, and a reusable private marketing-safe video asset.

- [ ] **Step 1: Verify the dedicated provider credential exists without reading its value**

List only staging environment variable names and targets. Require the operational variables from Task 8. If the dedicated credential is absent, stop with `CREDENTIAL_BLOCKED` and request the credential; do not copy a production secret.

- [ ] **Step 2: Set or verify the non-secret operational values**

Set the exact values from Task 8 on the dedicated staging project's Production target. Confirm `SEEDANCE_2_5_BYTEPLUS_MODES` contains exactly `t2v,i2v,ref2v,v2v,extend` and admin-only is false.

- [ ] **Step 3: Deploy the clean branch through the reviewed wrapper**

Run: `./scripts/deploy-mcp-staging-vercel.sh`

Expected: `SAFE_DEPLOY_OK` names `maxvideoai-mcp-staging`, the candidate deployment ID, and `https://maxvideoai-mcp-staging.vercel.app`; the production baseline comparison passes.

- [ ] **Step 4: Refresh the installed local plugin package**

Use the repository's cachebuster/update helper and plugin validator, then reinstall `maxvideoai@personal`. Confirm the installed `.mcp.json` still points to `https://maxvideoai-mcp-staging.vercel.app/mcp`. Start a new Codex task so the refreshed Skill is loaded.

- [ ] **Step 5: Perform a read-only hosted capability probe**

Call `list_models` once and `get_model_details` once for `seedance-2-5`. Require `generationEnabled: true` and exact modes `t2v`, `i2v`, `ref2v`, `v2v`, `extend`. Call `list_media` by each kind without uploading or spending.

- [ ] **Step 6: Prepare the single low-cost quote without spending**

Use `prepare_generation` with:

```json
{
  "schemaVersion": 1,
  "surface": "video",
  "engineId": "seedance-2-5",
  "mode": "t2v",
  "prompt": "Cinematic macro shot of a luminous creative spark flowing through a clean glass prism and becoming a polished film frame, premium neutral studio, controlled camera movement, realistic reflections, no text, no logo, brand-safe.",
  "settings": {
    "durationSec": 4,
    "resolution": "480p",
    "aspectRatio": "16:9",
    "audio": true
  },
  "references": [],
  "outputCount": 1
}
```

Expected: an exact short-lived quote, sufficient-balance result or top-up handoff, and no provider job.

- [ ] **Step 7: Display the amount and obtain explicit confirmation**

Present the exact quoted amount, duration, resolution, audio setting, and model to the user. Do not call `confirm_generation` until the user approves that exact quote.

- [ ] **Step 8: Confirm once and monitor without resubmission**

Call `confirm_generation` once with the exact quote and confirmation token. Poll only through `get_generation_status`; if the outcome is ambiguous, use recovery tools and do not confirm again.

- [ ] **Step 9: Verify terminal media and accounting**

Require terminal success, a private library media item, one wallet charge matching the quote, one final receipt, no duplicate provider attempt, and no refund. If the provider rejects, require the existing refund/reconciliation outcome and stop without a second paid attempt.

- [ ] **Step 10: Report the operational verdict**

Report exact tool availability, model modes, quote amount, job outcome, receipt/refund result, media reuse suitability, remaining defects, deployed commit, and confirmation that main and production were not changed. Do not include media storage origins, OAuth values, provider IDs, or secrets.

---

## Plan Self-Review

- Spec coverage: Tasks 1–2 cover authoritative executability and staging-only access; Tasks 3–6 cover five modes, multimodal private references, upload, validation, provider projection, quote/confirm, and financial invariants; Task 7 covers host/plugin behavior; Tasks 8–10 cover isolated credentials, deployment, and the single real proof.
- Placeholder scan: every implementation and verification step names concrete files, interfaces, commands, expected outcomes, and stop conditions.
- Type consistency: `CanonicalReferenceMediaKind` owns the shared image/video/audio union; `AgentMediaKind` aliases it; `ResolvedReference.mediaKind`, `CanonicalGenerationMode`, `McpRuntimeCapabilities`, and `buildPaidVideoRequestBody` keep the same names at every consumer boundary.
