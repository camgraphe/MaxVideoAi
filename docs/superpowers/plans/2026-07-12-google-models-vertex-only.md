# Google Models Vertex-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every enabled Google model through Vertex AI only, reject unavailable Google requests before wallet charging, and prohibit Fal or Gemini Developer API fallback.

**Architecture:** Add a shared Google service-account auth helper and a synchronous Vertex Gemini Image adapter for Nano Banana. Make the catalog and image dispatcher select it, preflight its Vertex configuration before the atomic charge/job transaction, and make the video router return an explicit unavailable Google plan rather than `fal_only`.

**Tech Stack:** Next.js/TypeScript, Node test runner with `tsx`, PostgreSQL wallet receipts, Vertex AI REST `generateContent`, existing Google service-account JWT authentication.

## Global Constraints

- Enabled Google models use Vertex AI only; Fal and Gemini Developer API are not valid Google execution paths.
- A missing Vertex configuration or unsupported Google mode is rejected before `createAtomicInitialImageJob` reserves a wallet charge.
- Preserve current prices, request fields, media storage, receipt semantics, and non-Google routing behavior.
- Use `GOOGLE_VERTEX_PROJECT_ID`, `GOOGLE_VERTEX_LOCATION`, and `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON`; do not introduce a `GEMINI_API_KEY` dependency.
- Keep user-owned worktree changes outside this scope untouched.

---

### Task 1: Lock the catalog contract before changing providers

**Files:**

- Modify: `tests/google-gemini-image-model.test.ts`
- Create: `tests/google-models-vertex-only-contract.test.ts`
- Modify: `frontend/src/config/fal-engines/nano-banana.ts`
- Modify: `frontend/src/config/fal-engines/nano-banana-lite.ts`
- Modify: `frontend/src/config/fal-engines/nano-banana-2.ts`
- Modify: `frontend/src/config/fal-engines/nano-banana-pro.ts`

**Interfaces:**

- Produces four Nano Banana entries whose `engine.providerMeta.provider` is `google_vertex_image`.
- Uses this Vertex model mapping: Nano Banana `gemini-2.5-flash-image`; Lite `gemini-3.1-flash-lite-image`; Nano Banana 2 `gemini-3.1-flash-image`; Pro `gemini-3-pro-image`.

- [ ] **Step 1: Write the failing catalog contract**

```ts
test('every Nano Banana entry declares a Vertex image provider', () => {
  const expected = {
    'nano-banana': 'gemini-2.5-flash-image',
    'nano-banana-lite': 'gemini-3.1-flash-lite-image',
    'nano-banana-2': 'gemini-3.1-flash-image',
    'nano-banana-pro': 'gemini-3-pro-image',
  } as const;

  for (const [id, modelSlug] of Object.entries(expected)) {
    const entry = listFalEngines().find((candidate) => candidate.id === id);
    assert.equal(entry?.engine.providerMeta?.provider, 'google_vertex_image');
    assert.equal(entry?.engine.providerMeta?.modelSlug, modelSlug);
  }
});
```

- [ ] **Step 2: Run it red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-gemini-image-model.test.ts tests/google-models-vertex-only-contract.test.ts`

Expected: FAIL because the current catalog names `fal.ai` or `google_gemini_image`.

- [ ] **Step 3: Change only the four provider metadata declarations**

```ts
providerMeta: {
  provider: 'google_vertex_image',
  modelSlug: 'gemini-3.1-flash-image',
},
```

Keep legacy `falModelId` only as a UI config field. No Google image execution path may consume it.

- [ ] **Step 4: Run the contract green**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-gemini-image-model.test.ts tests/google-models-vertex-only-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/google-gemini-image-model.test.ts tests/google-models-vertex-only-contract.test.ts frontend/src/config/fal-engines/nano-banana.ts frontend/src/config/fal-engines/nano-banana-lite.ts frontend/src/config/fal-engines/nano-banana-2.ts frontend/src/config/fal-engines/nano-banana-pro.ts
git commit -m "feat: route Nano Banana catalog through Vertex"
```

### Task 2: Extract reusable Vertex authentication and GCS staging

**Files:**

- Create: `frontend/src/server/video-providers/google-vertex-auth.ts`
- Create: `frontend/src/server/video-providers/google-vertex-gcs.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-veo/client.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-omni/client.ts`
- Create: `tests/google-vertex-auth.test.ts`

**Interfaces:**

- Produces `parseGoogleVertexServiceAccount(raw, errorFactory)`, `getGoogleVertexAccessToken(config)`, and `uploadGoogleVertexGcsObject(params)`.
- Uses the existing RS256 JWT assertion, `cloud-platform` OAuth scope, expiry cache, and token exchange.
- Generalizes the existing Veo `uploadGcsObject` method instead of creating a second storage integration. Use `GOOGLE_VERTEX_INPUT_GCS_URI`, falling back to the legacy `GOOGLE_VERTEX_VEO_INPUT_GCS_URI` during migration.

- [ ] **Step 1: Write the failing shared-auth test**

```ts
test('parses base64 service-account JSON and normalizes private-key newlines', () => {
  const encoded = Buffer.from(JSON.stringify({
    client_email: 'vertex@example.iam.gserviceaccount.com',
    private_key: ['-----BEGIN ', 'PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----'].join(''),
  })).toString('base64');

  const account = parseGoogleVertexServiceAccount(encoded, VertexTestError);
  assert.equal(account.client_email, 'vertex@example.iam.gserviceaccount.com');
  assert.match(account.private_key, /\nkey\n/);
});
```

- [ ] **Step 2: Run it red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-auth.test.ts`

Expected: FAIL with missing module/export.

- [ ] **Step 3: Move, do not duplicate, the existing auth code**

```ts
export async function getGoogleVertexAccessToken(config: GoogleVertexAuthConfig): Promise<string> {
  // Reuse the existing RS256 assertion and OAuth token exchange.
}
```

Keep provider-specific error types in callers through an error factory. Move the existing authenticated GCS upload implementation from the Veo client into the shared helper, then have Veo call it. Existing Veo and Omni URLs and error codes must not change.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-auth.test.ts tests/google-vertex-veo-routing.test.ts tests/google-vertex-omni-client.test.ts`

Expected: PASS.

```bash
git add frontend/src/server/video-providers/google-vertex-auth.ts frontend/src/server/video-providers/google-vertex-gcs.ts frontend/src/server/video-providers/google-vertex-veo/client.ts frontend/src/server/video-providers/google-vertex-omni/client.ts tests/google-vertex-auth.test.ts
git commit -m "refactor: share Vertex auth and GCS staging"
```

### Task 3: Implement and test the Vertex Gemini Image adapter

**Files:**

- Create: `frontend/src/server/images/google-vertex-image-client.ts`
- Create: `frontend/src/server/images/google-vertex-image-payload.ts`
- Create: `frontend/src/server/images/google-vertex-image-response.ts`
- Create: `frontend/src/server/images/google-vertex-image-error.ts`
- Create: `frontend/src/server/images/google-vertex-image-execution.ts`
- Create: `tests/google-vertex-image-payload.test.ts`
- Create: `tests/google-vertex-image-client.test.ts`

**Interfaces:**

- Produces `assertGoogleVertexImageConfigured()` and `executeGoogleVertexImageGeneration(params)`.
- Consumes `EngineCaps.providerMeta.modelSlug`, shared Vertex auth/GCS staging, existing storage/thumbnail helpers, and existing success/failure persistence.

- [ ] **Step 1: Write failing payload and response tests**

```ts
test('builds a Vertex generateContent image request with prompt and inline references', () => {
  const body = buildGoogleVertexImagePayload({
    prompt: 'Editorial product image',
    referenceImages: [{ data: 'aW1hZ2U=', mimeType: 'image/png' }],
    aspectRatio: '16:9',
    imageSize: '2k',
    enableWebSearch: true,
    thinkingLevel: 'high',
  });

  assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.equal(body.contents[0].parts[0].text, 'Editorial product image');
  assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/png');
});
```

- [ ] **Step 2: Run them red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-image-payload.test.ts tests/google-vertex-image-client.test.ts`

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement the minimal Vertex REST client**

```ts
const endpoint = `${apiBaseUrl}/v1/projects/${projectId}/locations/global/publishers/google/models/${modelId}:generateContent`;
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
  body: JSON.stringify(payload),
  signal,
});
```

Use `responseModalities: ['TEXT', 'IMAGE']`, inline references up to 7 MB, and GCS-staged references above 7 MB up to the existing 25 MB product limit. Store staged images under an `image-inputs/<date>/` prefix using the generic Vertex GCS helper. Map HTTP, timeout, auth, empty-output, and storage errors to `GoogleVertexImageError`; never call Fal or the Gemini Developer API.

- [ ] **Step 4: Preserve current receipt semantics**

Use `providerMode: 'google_vertex_image_direct'` with the existing completed/failed image persistence helpers. Genuine Vertex submit failures remain eligible for the existing idempotent refund behavior.

- [ ] **Step 5: Verify green and commit**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-image-payload.test.ts tests/google-vertex-image-client.test.ts tests/image-generation-atomic.test.ts`

Expected: PASS.

```bash
git add frontend/src/server/images/google-vertex-image-client.ts frontend/src/server/images/google-vertex-image-payload.ts frontend/src/server/images/google-vertex-image-response.ts frontend/src/server/images/google-vertex-image-error.ts frontend/src/server/images/google-vertex-image-execution.ts tests/google-vertex-image-payload.test.ts tests/google-vertex-image-client.test.ts
git commit -m "feat: add Vertex image provider for Nano Banana"
```

### Task 4: Reject unavailable Vertex image requests before billing

**Files:**

- Modify: `frontend/src/server/images/image-direct-provider-execution.ts`
- Modify: `frontend/src/server/images/execute-image-generation.ts`
- Create: `tests/google-vertex-image-routing.test.ts`
- Modify: `tests/image-generation-atomic.test.ts`

**Interfaces:**

- Produces an `ImageGenerationExecutionError` with code `google_vertex_image_unavailable` before `createAtomicInitialImageJob`.

- [ ] **Step 1: Write a failing pre-billing test**

```ts
test('does not reserve a wallet charge when a Vertex image engine is unavailable', async () => {
  await assert.rejects(
    () => executeImageGeneration({ userId: 'user_1', body: { engineId: 'nano-banana-2', prompt: 'test' } }),
    (error: unknown) => error instanceof ImageGenerationExecutionError && error.code === 'google_vertex_image_unavailable'
  );
  assert.equal(walletReserveCalls, 0);
  assert.equal(insertJobCalls, 0);
});
```

- [ ] **Step 2: Run it red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-image-routing.test.ts tests/image-generation-atomic.test.ts`

Expected: FAIL because the current provider check occurs after the charge/job transaction.

- [ ] **Step 3: Add the preflight after request-context resolution**

```ts
assertImageProviderAvailable({ engine, mode });
```

The preflight recognizes `google_vertex_image`, validates Vertex configuration and mode support, and throws a 503 before pricing, receipt creation, or wallet reservation. The dispatcher invokes only `executeGoogleVertexImageGeneration` for Google images and removes the `google_gemini_image` branch.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-image-routing.test.ts tests/image-generation-atomic.test.ts tests/image-input-schema.test.ts`

Expected: PASS with zero side effects in the unavailable path.

```bash
git add frontend/src/server/images/image-direct-provider-execution.ts frontend/src/server/images/execute-image-generation.ts tests/google-vertex-image-routing.test.ts tests/image-generation-atomic.test.ts
git commit -m "fix: reject unavailable Vertex image jobs before billing"
```

### Task 5: Make Google video routing Vertex-only

**Files:**

- Modify: `frontend/src/server/video-providers/router.ts`
- Modify: `frontend/app/api/generate/_lib/route-context.ts`
- Modify: `frontend/app/api/generate/_lib/video-provider-submission.ts`
- Modify: `tests/google-vertex-veo-routing.test.ts`
- Modify: `tests/google-vertex-omni-routing.test.ts`
- Modify: `tests/generate-route-context.test.ts`
- Modify: `tests/google-models-vertex-only-contract.test.ts`

**Interfaces:**

- Produces `{ kind: 'google_vertex_unavailable', reason }` for disabled, non-public, unsupported, or otherwise unavailable Google video routes.
- Google Vertex plans have only `kind` and a Vertex `primaryProvider`; they contain no fallback fields.

- [ ] **Step 1: Write failing no-fallback tests**

```ts
test('a disabled Google Vertex route is explicitly unavailable instead of Fal-only', () => {
  assert.deepEqual(resolveVideoProviderRoutingPlan({
    engineId: 'veo-3-1', mode: 't2v', isAdmin: false, env: {},
  }), {
    kind: 'google_vertex_unavailable',
    reason: 'vertex_not_configured',
  });
});
```

- [ ] **Step 2: Run them red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-veo-routing.test.ts tests/google-vertex-omni-routing.test.ts tests/generate-route-context.test.ts tests/google-models-vertex-only-contract.test.ts`

Expected: FAIL on the existing `fal_only` or fallback shape.

- [ ] **Step 3: Implement the unavailable plan and remove Google fallbacks**

```ts
type GoogleVertexUnavailablePlan = {
  kind: 'google_vertex_unavailable';
  reason: 'vertex_not_configured' | 'public_routing_disabled' | 'admin_only' | 'unsupported_mode';
};
```

Route context turns this plan into a 503 before the initial video job. Remove Fal fallback arguments and fallback branches from Google Veo/Omni submission helpers; do not change non-Google plans.

- [ ] **Step 4: Verify green and commit**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-veo-routing.test.ts tests/google-vertex-omni-routing.test.ts tests/google-vertex-veo-poll.test.ts tests/google-vertex-omni-runtime.test.ts tests/generate-route-context.test.ts tests/google-models-vertex-only-contract.test.ts`

Expected: PASS with no Google route plan exposing Fal.

```bash
git add frontend/src/server/video-providers/router.ts frontend/app/api/generate/_lib/route-context.ts frontend/app/api/generate/_lib/video-provider-submission.ts tests/google-vertex-veo-routing.test.ts tests/google-vertex-omni-routing.test.ts tests/generate-route-context.test.ts tests/google-models-vertex-only-contract.test.ts
git commit -m "feat: enforce Vertex-only Google video routing"
```

### Task 6: Remove the active Gemini-direct image route and verify

**Files:**

- Modify: `frontend/src/lib/env.ts`
- Delete: `frontend/src/server/images/google-gemini-image-client.ts`
- Delete: `frontend/src/server/images/google-gemini-image-execution.ts`
- Modify: `tests/image-generation-server-architecture.test.ts`
- Modify: `docs/engineering/llm-working-guide.md` only if a provider-routing note becomes inaccurate.

- [ ] **Step 1: Write the failing architecture assertion**

```ts
assert.match(dispatcherSource, /google_vertex_image/);
assert.doesNotMatch(dispatcherSource, /google_gemini_image/);
assert.doesNotMatch(dispatcherSource, /executeGoogleGeminiImageGeneration/);
```

- [ ] **Step 2: Run it red**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/image-generation-server-architecture.test.ts`

Expected: FAIL because direct Gemini routing remains referenced.

- [ ] **Step 3: Remove only unreachable direct-Gemini code**

Delete the Gemini Developer API client/executor and the three direct-key environment reads only after all active imports have moved. Preserve historical job records and receipt rendering.

- [ ] **Step 4: Run final verification**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-models-vertex-only-contract.test.ts tests/google-vertex-auth.test.ts tests/google-vertex-image-payload.test.ts tests/google-vertex-image-client.test.ts tests/google-vertex-image-routing.test.ts tests/google-vertex-veo-routing.test.ts tests/google-vertex-omni-routing.test.ts tests/google-vertex-veo-poll.test.ts tests/google-vertex-omni-runtime.test.ts tests/image-generation-atomic.test.ts tests/image-input-schema.test.ts tests/image-generation-server-architecture.test.ts
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/env.ts frontend/src/server/images/google-gemini-image-client.ts frontend/src/server/images/google-gemini-image-execution.ts tests/image-generation-server-architecture.test.ts docs/engineering/llm-working-guide.md
git commit -m "chore: remove Gemini direct image routing"
```

## Production Rollout

1. Configure `GOOGLE_VERTEX_INPUT_GCS_URI` to the existing Vertex input bucket/prefix, then verify the service account has object-create permission, model permission for the four mapped Gemini image models, and `GOOGLE_VERTEX_LOCATION=global`.
2. Deploy with Nano models unavailable until that check succeeds.
3. Run one controlled generation per Nano model; verify `provider_attempts.provider = 'google_vertex_image_direct'`, a completed job, and no refund receipt.
4. Monitor Nano refunds and Vertex provider errors for one hour.
