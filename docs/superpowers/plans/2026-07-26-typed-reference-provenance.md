# Typed Reference Provenance Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining generic aggregate-reference-budget bypass by preserving each submitted media item's actual kind and requiring it to match the active schema field type before billing, job creation, or provider submission.

**Architecture:** Keep URL multiplicity in the existing `referenceValuesByField` map for aggregate counting, and add a parallel `ReferenceBudgetMediaItem[]` provenance stream containing the original `fieldId`, actual attachment `kind`, and normalized URL. The generate route forwards both representations through the validation payload; the route-level media validator checks field activity and kind compatibility before the existing aggregate count. BytePlus's payload provenance check remains an independent defense.

**Tech Stack:** TypeScript, Next.js App Router route helpers, Node test runner through `tsx`.

## Global Constraints

- Use the actual submission mode when deciding whether a schema media field is active.
- When an aggregate `referenceBudget` is active, every non-empty provider-selected attachment-derived media item must name an active schema media field and its actual `kind` must exactly equal that field's `type`.
- An active schema media field outside `referenceBudget.fieldIds`, such as a V2V source `video_url`, remains allowed only when the submitted media kind matches its declared schema type.
- Preserve existing behavior exactly when no aggregate budget resolves for the submission mode.
- Preserve existing aggregate multiplicity and `countUniqueUrls` semantics in `referenceValuesByField`.
- Preserve direct compatibility projections by assigning their schema-authored media kind when they are added without an attachment.
- Reject malformed provenance before `resolveGenerateBillingPreflight`, `createAtomicInitialVideoJob`, and every provider submission path.
- Keep BytePlus payload provenance validation as defense in depth.
- Do not attach `referenceBudget` to a current engine.
- Do not add a Seedance 2.5 engine, provider profile/model ID, pricing row, registry entry, route, CTA, sitemap entry, or any other activation surface.
- Keep the correction limited to server reference derivation/validation plumbing and its focused tests.

---

### Task 1: Enforce typed reference provenance at the route validation boundary

**Files:**
- Modify: `frontend/app/api/generate/_lib/attachment-references.ts`
- Modify: `frontend/app/api/generate/_lib/validation-payload.ts`
- Modify: `frontend/app/api/generate/_lib/validate.ts`
- Modify: `frontend/app/api/generate/_lib/validate-media-inputs.ts`
- Modify: `frontend/app/api/generate/route.ts`
- Test: `tests/generate-attachment-references.test.ts`
- Test: `tests/generate-validation-payload.test.ts`
- Test: `tests/validate-request.test.ts`

**Interfaces:**
- Consumes: `ReferenceBudgetMediaItem` from `frontend/lib/reference-budget.ts`.
- Produces: `deriveGenerationAttachmentReferences(...).referenceMediaItems: ReferenceBudgetMediaItem[]`.
- Produces: `RequestValidationContext.referenceMediaItems?: readonly ReferenceBudgetMediaItem[]`.
- Preserves: `referenceValuesByField: ReferenceBudgetValuesByField<string>` as the authoritative multiplicity input for `evaluateReferenceBudget`.

- [ ] **Step 1: Write the failing derivation and validation tests**

In `tests/generate-attachment-references.test.ts`, extend a real attachment-derivation test with a hand-authored expectation proving actual kinds survive independently of schema declarations:

```ts
assert.deepEqual(result.referenceMediaItems, [
  { fieldId: 'image_urls', kind: 'image', url: 'valid-image' },
  { fieldId: 'video_url', kind: 'audio', url: 'forged-audio' },
]);
```

The second item is deliberately malformed: the original attachment says `kind: 'audio'` while reusing the active `video_url` field ID. The derivation layer must preserve that fact rather than re-inferring `video` from the schema.

In `tests/validate-request.test.ts`, add a behavioral regression using the real `deriveGenerationAttachmentReferences` result:

```ts
const inputSchema = {
  optional: [
    {
      id: 'reference_image_urls',
      type: 'image',
      label: 'References',
      modes: ['v2v'],
    },
    {
      id: 'audio_urls',
      type: 'audio',
      label: 'Reference audio',
      modes: ['v2v'],
    },
    {
      id: 'video_url',
      type: 'video',
      label: 'Source video',
      modes: ['v2v'],
    },
  ],
  referenceBudget: {
    fieldIds: ['reference_image_urls', 'audio_urls'],
    modes: ['v2v'],
    maxTotal: 1,
    countUniqueUrls: true,
  },
} satisfies EngineInputSchema;
```

Derive one valid budgeted image plus an audio attachment using `slotId: 'video_url'`. Assert that the provider audio projection contains the forged URL, then require:

```ts
assert.deepEqual(validation, {
  ok: false,
  error: {
    code: 'ENGINE_CONSTRAINT',
    field: 'video_url',
    message: 'Media input "video_url" expects video, not audio',
  },
});
```

Also lock the two preservation branches:

```ts
// Matching video kind on active non-budget video_url remains { ok: true }.
// The same wrong-kind attachment remains backward compatible when referenceBudget is absent.
```

In `tests/generate-validation-payload.test.ts`, require the helper to forward the exact `referenceMediaItems` array to `validateRequest`, while retaining the existing source-order assertion that validation rejection precedes billing, job creation, and provider submission.

- [ ] **Step 2: Run the focused tests and verify strict RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-attachment-references.test.ts \
  tests/generate-validation-payload.test.ts \
  tests/validate-request.test.ts
```

Expected: FAIL because attachment derivation does not expose typed provenance and validation accepts the audio item whose active field ID declares `video`.

- [ ] **Step 3: Preserve actual attachment kinds during reference derivation**

In `frontend/app/api/generate/_lib/attachment-references.ts`, import:

```ts
import type {
  ReferenceBudgetMediaItem,
  ReferenceBudgetValuesByField,
} from '@/lib/reference-budget';
```

Add to `AttachmentReferenceResult`:

```ts
referenceMediaItems: ReferenceBudgetMediaItem[];
```

Build it in parallel with `referenceValuesByField`:

```ts
const referenceMediaItems: ReferenceBudgetMediaItem[] = [];
const appendReferenceValue = (
  fieldId: string,
  rawUrl: string | undefined,
  kind?: ReferenceBudgetMediaItem['kind']
) => {
  const url = rawUrl?.trim();
  if (!fieldId || !url) return;
  (referenceValuesByField[fieldId] ??= []).push(url);
  if (kind) referenceMediaItems.push({ fieldId, kind, url });
};
```

For every normalized attachment, pass its actual `attachment.kind`. Extend `appendProjectionOnlyValues` with an explicit kind argument and use `image` for direct reference-image projections and `audio` for direct reference-audio projections. Return `referenceMediaItems` without deduplicating or re-inferring attachment kinds.

- [ ] **Step 4: Forward typed provenance through route validation**

In `validation-payload.ts`, `validate.ts`, and `route.ts`, add the optional/required values needed to forward:

```ts
referenceMediaItems: readonly ReferenceBudgetMediaItem[];
```

Pass the exact array from `deriveGenerationAttachmentReferences` into `buildGenerateValidationPayload`, then into the `validateRequest` context. Do not reconstruct it from projected provider arrays or from schema field types.

- [ ] **Step 5: Reject field/type mismatches before aggregate evaluation**

In `validate-media-inputs.ts`, accept:

```ts
referenceMediaItems?: readonly ReferenceBudgetMediaItem[];
```

When `resolveEngineReferenceBudget(...)` returns a budget, build an active media-field map from the actual mode:

```ts
const activeMediaFieldsById = new Map(
  [...(params.inputSchema?.required ?? []), ...(params.inputSchema?.optional ?? [])]
    .filter(
      (field) =>
        (field.type === 'image' ||
          field.type === 'video' ||
          field.type === 'audio') &&
        (!field.modes?.length || field.modes.includes(params.normalizedMode))
    )
    .map((field) => [field.id, field.type] as const)
);
```

Preserve the existing deterministic unknown/inactive-field rejection. Then inspect every non-empty typed item in stable `fieldId`, `kind`, `url` order. If the field exists but `expectedKind !== item.kind`, return:

```ts
{
  ok: false,
  error: {
    code: 'ENGINE_CONSTRAINT',
    field: item.fieldId,
    message: `Media input "${item.fieldId}" expects ${expectedKind}, not ${item.kind}`,
  },
}
```

Only after the provenance checks pass may the existing `evaluateReferenceBudget(...)` run.

- [ ] **Step 6: Verify GREEN and the complete affected packet**

Run the Step 2 command again. Expected: all tests pass.

Then run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-attachment-references.test.ts \
  tests/generate-validation-payload.test.ts \
  tests/validate-request.test.ts \
  tests/generate-route-context.test.ts \
  tests/generate-initial-video-job-architecture.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/reference-budget.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: every command exits `0`, current BytePlus defenses stay green, and the tracked diff contains no activation/configuration changes.

- [ ] **Step 7: Run final repository validation and commit**

Run:

```bash
pnpm test:validate
```

Expected: all repository tests pass with zero failures.

Inspect:

```bash
git diff --check
git status --short
```

Commit only the five server files and three focused test files:

```bash
git add \
  frontend/app/api/generate/_lib/attachment-references.ts \
  frontend/app/api/generate/_lib/validation-payload.ts \
  frontend/app/api/generate/_lib/validate.ts \
  frontend/app/api/generate/_lib/validate-media-inputs.ts \
  frontend/app/api/generate/route.ts \
  tests/generate-attachment-references.test.ts \
  tests/generate-validation-payload.test.ts \
  tests/validate-request.test.ts
git commit -m "fix: enforce typed reference provenance"
```
