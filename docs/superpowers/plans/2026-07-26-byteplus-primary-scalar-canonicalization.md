# BytePlus Primary Scalar Canonicalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BytePlus image-to-video validation, billing provenance, and provider submission agree on the single opening image that the provider actually emits.

**Architecture:** `deriveGenerationAttachmentReferences` remains the selection boundary. For BytePlus I2V, it identifies the same first attachment candidate used for `initialImageUrl` and retains only that logical opening image with its original schema field provenance. `buildBytePlusSeedancePayload` treats `image_url`, `input_image`, and `image` as semantic aliases for the single provider `image_url` content item, while still requiring exactly one matching typed provenance item and carrying its actual field ID into omitted-budget bookkeeping. This preserves route-level rejection of inactive aliases and prevents an over-complete attachment list from reaching post-billing provider defense.

**Tech Stack:** TypeScript, Next.js App Router route helpers, Node test runner through `tsx`, BytePlus ModelArk payload adapter.

## Global Constraints

- Change only BytePlus I2V primary-attachment selection and its focused regression tests.
- Do not change model registry, engine catalog, provider activation, routing, pricing, billing, model IDs, environment variables, or generated configuration.
- A direct primary URL keeps precedence over every `image_url`, `input_image`, or `image` attachment.
- Without a direct primary URL, the first matching image attachment in request order whose slot is `image_url`, `input_image`, or `image` remains the sole BytePlus opening-image candidate, exactly as used for `initialImageUrl`.
- Preserve the selected attachment's original `image_url`, `input_image`, or `image` field ID in route provenance; the provider payload alone maps that active alias to its single `image_url` content item.
- Exclude every unselected primary attachment from both `referenceValuesByField` and `referenceMediaItems`, including repeated copies of the selected URL.
- Preserve and strengthen the exact BytePlus provider defense: emitted scalar media must match exactly one provenance item by an allowed semantic field, kind, and URL; missing, wrong-field, wrong-kind, wrong-URL, and ambiguous matches fail closed.
- An alias not active in the current input schema must still reject during route validation before billing; selection must not relabel it into an active field.
- Preserve direct end-image canonicalization, attachment-only end behavior, Sora, Kling, Elements, prototype-key handling, incomplete-provenance handling, and every non-BytePlus path.
- Preserve attachment-only no-budget provider behavior: the same first opening image is submitted once.
- Follow red-green-refactor. The RED run must exercise the real derivation → real validation → real BytePlus submission → real payload-builder chain. Mock only the external provider client, database write, and rollback boundary.
- Keep unrelated worktree changes intact and make one focused implementation commit.

---

## File Map

- Modify `frontend/app/api/generate/_lib/attachment-references.ts`: select one BytePlus attachment-only primary by index and retain its original alias provenance.
- Modify `frontend/src/server/video-providers/byteplus-modelark-payload.ts`: resolve one exact typed primary across the three semantic aliases and use its field ID for budget reconciliation.
- Modify `tests/generate-byteplus-submission.test.ts`: cover distinct, duplicate, active-alias, inactive-alias, direct-precedence, and no-budget behavior through the real validation and provider payload chain.
- Modify `tests/validate-request.test.ts`: lock missing, wrong-field, wrong-kind, wrong-URL, and ambiguous BytePlus scalar defenses.
- Verify unchanged `tests/byteplus-provider-architecture.test.ts`: provider budget and omitted-item defenses.

### Task 1: Canonicalize the BytePlus attachment-only opening scalar

**Files:**
- Modify: `frontend/app/api/generate/_lib/attachment-references.ts`
- Modify: `frontend/src/server/video-providers/byteplus-modelark-payload.ts`
- Modify: `tests/generate-byteplus-submission.test.ts`
- Modify: `tests/validate-request.test.ts`
- Test: `tests/byteplus-provider-architecture.test.ts`

**Interfaces:**
- Consumes: `AttachmentReferenceParams.attachments`, `mode`, `isBytePlusV1a`, and optional direct primary inputs.
- Produces: the existing `AttachmentReferenceResult` and `BytePlusSeedancePayload` shapes without adding public fields.
- Preserves: `submitBytePlusGenerateTask` and `buildBytePlusSeedancePayload` signatures.

- [ ] **Step 1: Add the failing real-chain regression matrix**

In `tests/generate-byteplus-submission.test.ts`, add a table-driven test after the existing direct-primary test. Use the existing `baseParams`, `pendingReceipt`, `deriveGenerationAttachmentReferences`, `buildGenerateValidationPayload`, and `submitBytePlusGenerateTask` imports.

The five subcases must be:

```ts
const firstUrl = 'https://cdn.maxvideoai.com/selected-start.png';
const secondUrl = 'https://cdn.maxvideoai.com/unselected-start.png';
const cases = [
  {
    name: 'distinct canonical attachments retain only the first scalar',
    activeFieldId: 'image_url',
    slots: [
      ['image_url', firstUrl],
      ['image_url', secondUrl],
    ],
    maxTotal: 2,
  },
  {
    name: 'duplicate canonical attachments count as one emitted scalar',
    activeFieldId: 'image_url',
    slots: [
      ['image_url', firstUrl],
      ['image_url', firstUrl],
    ],
    maxTotal: 1,
  },
  {
    name: 'active input_image remains exact provenance for the provider scalar',
    activeFieldId: 'input_image',
    slots: [
      ['input_image', firstUrl],
      ['input_image', secondUrl],
    ],
    maxTotal: 2,
  },
  {
    name: 'active image remains exact provenance for the provider scalar',
    activeFieldId: 'image',
    slots: [
      ['image', firstUrl],
      ['image', secondUrl],
    ],
    maxTotal: 2,
  },
  {
    name: 'no-budget submission keeps the first attachment scalar',
    activeFieldId: 'image_url',
    slots: [
      ['input_image', firstUrl],
      ['image_url', secondUrl],
    ],
    maxTotal: null,
  },
] as const;
```

Wrap the matrix in one parent test named `BytePlus I2V canonicalizes one attachment-only primary before validation and submission`. Iterate with `for (const [caseIndex, scenario] of cases.entries())` and run each entry as an awaited subtest named `scenario.name` through the Node test context `t`. The construction, validation, submission, and assertions below all belong inside that subtest.

Inside each subtest, construct `NormalizedAttachment[]` in the listed order:

```ts
const attachments: NormalizedAttachment[] = scenario.slots.map(
  ([slotId, url], index) => ({
    name: `attachment-start-${index}.png`,
    type: 'image/png',
    size: 1200,
    kind: 'image',
    slotId,
    url,
  })
);
```

Use an input schema whose active primary media field is the case's `activeFieldId`. Add the reference budget only when `maxTotal` is non-null:

```ts
const inputSchema: EngineInputSchema = {
  optional: [
    {
      id: scenario.activeFieldId,
      type: 'image',
      label: 'Start image',
      modes: ['i2v'],
    },
  ],
  ...(scenario.maxTotal === null
    ? {}
    : {
        referenceBudget: {
          fieldIds: [scenario.activeFieldId],
          modes: ['i2v'],
          maxTotal: scenario.maxTotal,
          countUniqueUrls: false,
        },
      }),
};
```

Derive references with no direct image:

```ts
const references = deriveGenerationAttachmentReferences({
  attachments,
  engineId: 'seedance-2-0',
  mode: 'i2v',
  inputSchema,
  isBytePlusV1a: true,
});
```

Run the real route validation helper with these exact media/provenance values:

```ts
const validation = buildGenerateValidationPayload({
  engineId: 'seedance-2-0',
  mode: 'i2v',
  prompt: 'Animate the selected attachment',
  multiPrompt: null,
  supportsResolution: false,
  effectiveResolution: '720p',
  supportsAspectRatio: false,
  aspectRatio: '16:9',
  audioEnabled: true,
  isBytePlusV1a: true,
  supportsDuration: true,
  numFrames: null,
  validationDuration: 8,
  maxUploadedBytes: references.maxUploadedBytes,
  resolvedFirstFrameUrl: references.resolvedFirstFrameUrl,
  lastFrameUrl: references.lastFrameUrl,
  normalizedReferenceImages: references.normalizedReferenceImages,
  videoUrls: references.videoUrls,
  audioUrls: references.audioUrls,
  resolvedAudioUrl: references.resolvedAudioUrl,
  sourceInputVideoUrl: references.sourceInputVideoUrl,
  elements: null,
  endImageUrl: null,
  startImageUrl: references.startImageUrl,
  isLumaRay2: false,
  initialImageUrl: references.initialImageUrl,
  inputSchema,
  referenceValuesByField: references.referenceValuesByField,
  referenceMediaItems: references.referenceMediaItems,
  referenceProvenanceIssues: references.referenceProvenanceIssues,
});
```

Assert before submission:

```ts
assert.equal(references.initialImageUrl, firstUrl, scenario.name);
assert.deepEqual(
  references.referenceValuesByField,
  { [scenario.slots[0][0]]: [firstUrl] },
  scenario.name
);
assert.deepEqual(
  references.referenceMediaItems,
  [
    {
      fieldId: scenario.slots[0][0],
      kind: 'image',
      url: firstUrl,
    },
  ],
  scenario.name
);
assert.equal(validation.ok, true, scenario.name);
```

Then call the real `submitBytePlusGenerateTask`. Do not inject a payload builder, profile lookup, model resolver, capability helper, or configuration reader. Inject only:

```ts
deps: {
  getBytePlusModelArkClientFn: () => ({
    createSeedanceFastTask: async (payload) => {
      providerCalls += 1;
      providerImageUrls = payload.content
        .filter((item) => item.type === 'image_url')
        .map((item) => item.image_url.url);
      return {
        providerJobId: `provider_attachment_primary_${caseIndex}`,
        status: 'queued',
      };
    },
  }),
  queryFn: async () => undefined,
  rollbackPendingPaymentFn: async () => {
    rollbacks += 1;
  },
},
```

The real configuration reader is intentional here: it performs no provider access, supplies repository-owned default model IDs, and its API key is never consumed because the external client boundary is injected.

Pass `pendingReceipt`, the derived `initialImageUrl`, the case `inputSchema`, and the derived `referenceValuesByField`. Assert `result.ok === true`, one provider call, provider image URLs exactly `[firstUrl]`, and zero rollbacks for every subcase.

Add a separate inactive-alias route test with an active `image_url` budget (`maxTotal: 1`, `countUniqueUrls: false`) and one `input_image` attachment. Derive and validate through the same real helpers, but do not call submission after validation rejects. Assert:

```ts
assert.equal(validation.ok, false);
if (validation.ok) {
  assert.fail('inactive input_image must reject before BytePlus submission');
}
assert.equal(validation.body.field, 'input_image');
assert.equal(validation.body.error, 'ENGINE_CONSTRAINT');
```

Update the existing test `BytePlus I2V canonicalizes a direct image before validation and provider submission` so its attachments contain distinct unselected `image_url`, `input_image`, and `image` candidates. Keep its existing expected provenance `{ image_url: [directImageUrl] }`, one provider call containing only the direct URL, and zero rollbacks. This is the direct-primary precedence regression across every alias.

In `tests/validate-request.test.ts`, expand `BytePlus budget defense rejects every emitted I2V scalar without typed provenance` with a primary-only builder:

```ts
const buildPrimary = (
  referenceMediaItems: Parameters<
    typeof buildBytePlusSeedancePayload
  >[0]['referenceMediaItems']
) =>
  buildBytePlusSeedancePayload({
    modelId: 'current-model-id',
    prompt: 'Animate the supplied opening frame',
    durationSec: 5,
    mode: 'i2v',
    imageUrl: 'https://example.com/start.png',
    resolution: '720p',
    ratio: '16:9',
    allowedResolutions: ['720p'],
    allowedDurationOptions: [5],
    referenceBudget: {
      fieldIds: ['image_url', 'input_image', 'image'],
      maxTotal: 2,
      countUniqueUrls: false,
    },
    referenceMediaItems,
  });
```

Assert `BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH` for each exact invalid provenance list:

```ts
const invalidPrimaryProvenance = [
  [],
  [
    {
      fieldId: 'end_image_url',
      kind: 'image',
      url: 'https://example.com/start.png',
    },
  ],
  [
    {
      fieldId: 'image_url',
      kind: 'video',
      url: 'https://example.com/start.png',
    },
  ],
  [
    {
      fieldId: 'image_url',
      kind: 'image',
      url: 'https://example.com/other.png',
    },
  ],
  [
    {
      fieldId: 'image_url',
      kind: 'image',
      url: 'https://example.com/start.png',
    },
    {
      fieldId: 'input_image',
      kind: 'image',
      url: 'https://example.com/start.png',
    },
  ],
] satisfies Array<
  NonNullable<
    Parameters<typeof buildBytePlusSeedancePayload>[0]['referenceMediaItems']
  >
>;
```

Retain the test's existing direct-end and same-URL cross-field assertions.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-byteplus-submission.test.ts \
  tests/validate-request.test.ts
```

Expected failures on current code:

- distinct `image_url` values validate as two references, then real BytePlus submission returns `BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH`, makes zero provider calls, and rolls back once;
- duplicate `image_url` values fail validation with `referenceBudget` value `2` when `maxTotal` is `1`;
- active `input_image` and `image` values pass route validation but fail real provider scalar provenance because the payload currently requires field `image_url`;
- the inactive `input_image` case is already green and proves the pre-billing rejection that must remain;
- the no-budget subcase remains green and confirms the provider-facing behavior that must be preserved.

- [ ] **Step 3: Select exactly one BytePlus attachment primary**

In `frontend/app/api/generate/_lib/attachment-references.ts`:

1. Move the existing primary slot tuple before primary attachment selection:

```ts
const primaryImageSlotIds = ['image_url', 'input_image', 'image'] as const;
type PrimaryImageSlotId = (typeof primaryImageSlotIds)[number];
const isPrimaryImageSlot = (
  slotId: string | null | undefined
): slotId is PrimaryImageSlotId =>
  primaryImageSlotIds.includes(slotId as PrimaryImageSlotId);
```

2. Replace the URL-only `find` with an index selection that preserves the current first-match order:

```ts
const attachmentPrimaryImageIndex = params.attachments.findIndex(
  (attachment) =>
    attachment.kind === 'image' &&
    typeof attachment.url === 'string' &&
    isPrimaryImageSlot(attachment.slotId)
);
const attachmentPrimaryImageUrl =
  attachmentPrimaryImageIndex >= 0
    ? params.attachments[attachmentPrimaryImageIndex]?.url?.trim()
    : undefined;
```

3. In the attachment loop, after normalizing `fieldId` and before the existing BytePlus direct-primary skip, handle every BytePlus I2V primary alias as one scalar selection:

```ts
if (
  attachment.kind === 'image' &&
  isBytePlusI2v &&
  isPrimaryImageSlot(fieldId)
) {
  if (
    bytePlusDirectPrimarySelected ||
    attachmentIndex !== attachmentPrimaryImageIndex
  ) {
    continue;
  }
  appendTypedReferenceValue(fieldId, url, 'image');
  continue;
}
```

4. Remove the now-redundant existing direct-primary attachment skip and the later duplicate `primaryImageSlotIds` declaration.

Do not change `requestedPrimaryImageUrl`, `initialImageUrl`, direct-primary projection, direct-end projection, validation, or submission code.

- [ ] **Step 4: Resolve the exact provider primary across active aliases**

In `frontend/src/server/video-providers/byteplus-modelark-payload.ts`, add:

```ts
const BYTEPLUS_PRIMARY_IMAGE_FIELD_IDS = [
  'image_url',
  'input_image',
  'image',
] as const;
```

Replace `resolveTypedPayloadScalarUrl` with an object-returning exact resolver:

```ts
const resolveTypedPayloadScalar = (
  kind: ReferenceBudgetMediaItem['kind'],
  fieldIds: readonly string[],
  requestedUrl: string
) => {
  const fallbackFieldId = fieldIds[0] ?? '';
  if (!requestedUrl || !referenceMediaItems) {
    return { fieldId: fallbackFieldId, url: requestedUrl };
  }
  const matches = referenceMediaItems.filter(
    (candidate) =>
      candidate.kind === kind &&
      fieldIds.includes(candidate.fieldId) &&
      candidate.url.trim() === requestedUrl
  );
  if (matches.length !== 1) {
    throw new BytePlusModelArkError(
      'BytePlus reference payload is missing original field provenance.',
      { code: 'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH' }
    );
  }
  return {
    fieldId: matches[0].fieldId,
    url: matches[0].url.trim(),
  };
};
```

Resolve both I2V scalars as field-aware selections:

```ts
const selectedImage =
  mode === 'i2v'
    ? resolveTypedPayloadScalar(
        'image',
        BYTEPLUS_PRIMARY_IMAGE_FIELD_IDS,
        imageUrl
      )
    : { fieldId: 'image_url', url: '' };
const selectedEndImage =
  mode === 'i2v'
    ? resolveTypedPayloadScalar('image', ['end_image_url'], endImageUrl)
    : { fieldId: 'end_image_url', url: '' };
const selectedImageUrl = selectedImage.url;
const selectedEndImageUrl = selectedEndImage.url;
```

In the omitted-budget defense, record scalars under their resolved provenance fields:

```ts
if (selectedImageUrl) {
  selectedScalarImageUrlsByField.set(
    selectedImage.fieldId,
    selectedImageUrl
  );
}
if (selectedEndImageUrl) {
  selectedScalarImageUrlsByField.set(
    selectedEndImage.fieldId,
    selectedEndImageUrl
  );
}
```

Keep the emitted BytePlus content item unchanged: its transport type remains `image_url`, regardless of which active schema alias supplied provenance.

- [ ] **Step 5: Run the focused regression files and verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-byteplus-submission.test.ts \
  tests/validate-request.test.ts
```

Expected: all tests, all five submission subcases, the inactive-alias route rejection, and every exact provider-defense case pass with pristine output.

- [ ] **Step 6: Run the provider/provenance regression packet**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-byteplus-submission.test.ts \
  tests/validate-request.test.ts \
  tests/byteplus-provider-architecture.test.ts
```

Expected: all tests pass. In particular, the unchanged exact provider field/kind/URL mismatch tests, direct start/end canonicalization tests, omitted-budget-item defense, and no-budget behavior remain green.

- [ ] **Step 7: Run static and repository verification**

Run:

```bash
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
pnpm test:validate
```

Expected: every command exits `0`; the full validation suite reports zero failures.

- [ ] **Step 8: Commit the focused correction**

```bash
git add \
  frontend/app/api/generate/_lib/attachment-references.ts \
  frontend/src/server/video-providers/byteplus-modelark-payload.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/validate-request.test.ts
git commit -m "fix: canonicalize BytePlus attachment primary"
```
