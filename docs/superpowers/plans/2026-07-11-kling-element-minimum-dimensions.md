# Kling Element Minimum Image Dimensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject known undersized Kling element images before billing and return a message stating the actual dimensions and the separate 300 px minimum for each axis.

**Architecture:** Add a route-local asynchronous validator that resolves element assets from `user_assets`, checks known width and height values, and returns a structured 422 response. Invoke it after request normalization and before billing preflight; retain provider-side 422 handling for assets whose dimensions are unknown.

**Tech Stack:** TypeScript, Next.js App Router, Neon PostgreSQL through the existing `query` helper, Node.js tests through `tsx`.

## Global Constraints

- Width must be at least 300 pixels and height must be at least 300 pixels.
- State actual dimensions and both axis minimums explicitly in the customer message.
- Run validation before billing preflight and atomic job creation.
- Accept unknown dimensions without a false rejection.
- Do not expose asset URLs, storage keys, or database details.
- Preserve unrelated engines and ordinary image inputs.

---

### Task 1: Kling element dimension validator

**Files:**
- Create: `frontend/app/api/generate/_lib/kling-element-image-dimensions.ts`
- Create: `tests/kling-element-image-dimensions.test.ts`

**Interfaces:**
- Consumes: normalized engine ID, authenticated user ID, `MaxVideoProviderElement[]`, and an injectable query function.
- Produces: `validateKlingElementImageDimensions(params): Promise<KlingElementImageDimensionValidationResult>`.

- [ ] **Step 1: Write the failing tests**

Create tests for 648 x 157 rejection, 299 x 600 rejection, 300 x 300 acceptance, unknown-dimension acceptance, and non-Kling bypass. The incident assertion must include this exact message:

```ts
assert.equal(
  result.body.message,
  'This image is 648 x 157 px. Kling requires at least 300 px in width and 300 px in height. Choose a larger image and try again.'
);
```

Assert error code `KLING_ELEMENT_IMAGE_TOO_SMALL`, status 422, and body fields `actualWidth`, `actualHeight`, `minimumWidth`, and `minimumHeight`.

- [ ] **Step 2: Verify RED**

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/kling-element-image-dimensions.test.ts
```

Expected: FAIL because the validator module does not exist.

- [ ] **Step 3: Implement the minimal validator**

Export constants `KLING_ELEMENT_MINIMUM_IMAGE_WIDTH = 300` and `KLING_ELEMENT_MINIMUM_IMAGE_HEIGHT = 300`. Collect unique frontal/reference asset IDs and URLs, then issue one query scoped by `user_id = $1`. Treat null, non-numeric, zero, and negative dimensions as unknown. Return `{ ok: true }` for non-Kling requests, empty elements, valid rows, or unknown rows. Return the structured 422 result for the first row below either minimum.

The public signature is:

```ts
export async function validateKlingElementImageDimensions(params: {
  engineId: string;
  userId: string;
  elements: MaxVideoProviderElement[] | null;
  deps?: { queryFn?: QueryFn };
}): Promise<KlingElementImageDimensionValidationResult>
```

- [ ] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: all new tests PASS without warnings.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/generate/_lib/kling-element-image-dimensions.ts tests/kling-element-image-dimensions.test.ts
git commit -m "fix: validate Kling element image dimensions"
```

---

### Task 2: Pre-billing route integration

**Files:**
- Modify: `frontend/app/api/generate/route.ts`
- Modify: `tests/kling-element-image-dimensions.test.ts`

**Interfaces:**
- Consumes: the Task 1 validator, `engine.id`, `userId`, normalized `elements`, and the route metric logger.
- Produces: an early 422 response before `resolveGenerateBillingPreflight`.

- [ ] **Step 1: Write the failing route-order test**

Read `route.ts` and assert that `await validateKlingElementImageDimensions` exists before `await resolveGenerateBillingPreflight`.

```ts
assert.ok(
  source.indexOf('await validateKlingElementImageDimensions') <
    source.indexOf('await resolveGenerateBillingPreflight')
);
```

- [ ] **Step 2: Verify RED**

Run the Task 1 test command. Expected: validator unit tests PASS and route-order test FAILS.

- [ ] **Step 3: Integrate before billing**

Import the helper and insert this block before billing preflight:

```ts
const dimensionValidation = await validateKlingElementImageDimensions({
  engineId: engine.id,
  userId: String(userId),
  elements,
});
if (!dimensionValidation.ok) {
  logMetric('rejected', dimensionValidation.metric);
  return NextResponse.json(dimensionValidation.body, { status: dimensionValidation.status });
}
```

Do not create or mutate an `app_jobs` row for this rejection.

- [ ] **Step 4: Verify GREEN**

```bash
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/kling-element-image-dimensions.test.ts tests/generate-validation-payload.test.ts tests/generate-request-options.test.ts tests/kling-direct-elements.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/generate/route.ts tests/kling-element-image-dimensions.test.ts
git commit -m "fix: reject undersized Kling element images before billing"
```

---

### Task 3: Verification and synchronization

**Files:**
- Verify only; no planned production changes.

**Interfaces:**
- Consumes: committed validator and route integration.
- Produces: verification evidence and a clean `main` ready to push.

- [ ] **Step 1: Run focused regressions**

Run the new test plus `generate-validation-payload`, `generate-request-options`, `kling-direct-elements`, and `generate-fal-error-handling`. Expected: all PASS.

- [ ] **Step 2: Run repository checks**

Run frontend lint, `npm run lint:exposure`, and `git diff --check origin/main...HEAD`. Expected: every command exits 0; report unrelated warnings separately.

- [ ] **Step 3: Synchronize remote main**

Fetch `origin main`. If it advanced, merge it into local `main`, resolve only conflicts in files owned by this patch, and rerun Steps 1-2. Never overwrite concurrent changes.

- [ ] **Step 4: Confirm final scope**

Inspect `git log --oneline origin/main..HEAD`, `git diff --stat origin/main...HEAD`, and `git status --short --branch`. Expected: only the design, plan, validator, route integration, and focused tests are ahead; the worktree is clean.
