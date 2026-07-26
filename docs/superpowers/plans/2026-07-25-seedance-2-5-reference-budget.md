# Seedance 2.5 Aggregate Reference Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic, typed, mode-aware aggregate media-reference budget that client insertion, engine reconciliation, API validation, generation preparation, and BytePlus payload construction enforce from the same authoritative field values.

**Architecture:** `EngineInputSchema` declares an optional aggregate budget in addition to per-field `maxCount`. Pure helpers resolve the budget for the actual submission mode, fall forward to a candidate asset-driven mode during rapid insertions, count normalized identities, and retain original field IDs through the API; no current engine receives a budget, so current runtime behavior remains unchanged.

**Tech Stack:** TypeScript, React hooks, Next.js App Router, Node test runner through `tsx`.

## Global Constraints

- Add exactly this optional schema capability: `referenceBudget: { fieldIds: string[]; modes?: Mode[]; maxTotal: number; countUniqueUrls: boolean }`.
- Per-field `maxCount` remains authoritative; the aggregate budget is an additional cross-field guard.
- Resolve pre-submit and API checks from the actual `submissionMode`, not a lagging form mode.
- During client insertion, evaluate the complete candidate asset state so the first or rapidly repeated unified-reference insert cannot bypass a mode-scoped budget.
- Count only declared fields active for the resolved mode; trim strings and ignore empty values.
- When `countUniqueUrls` is true, equal normalized identities consume one unit; when false, every non-empty entry consumes one unit even if BytePlus later deduplicates identical payload URLs.
- A rejected insertion must not release the existing replacement target, close the library picker, or start a local upload.
- Engine/schema reconciliation is deterministic by destination field order and existing slot order.
- When `referenceBudget` is absent, preserve existing retained arrays and per-field behavior exactly; only the pre-existing removal of obsolete field IDs may occur.
- Server validation must retain original attachment `slotId` values instead of reconstructing a budget from projected provider-oriented keys.
- BytePlus payload references and the final payload budget check must derive from the same typed reference items whenever a budget exists.
- Do not attach `referenceBudget` to Seedance 2.0 Standard, Fast, Mini, hidden Fast, or any other current engine in this batch.
- Do not add a Seedance 2.5 engine, a fifty-slot UI, bulk selection, prompt anchors, or an app route.
- Follow red-green-refactor, make one focused commit per task, and keep unrelated worktree changes intact.

---

## File Map

- Modify `frontend/types/engines.ts`: public schema capability.
- Create `frontend/lib/reference-budget.ts`: mode resolution, prospective resolution, counting, and typed provider items.
- Create `tests/reference-budget.test.ts`: pure contract.
- Modify `frontend/app/(core)/(workspace)/app/_lib/workspace-assets.ts`: result-bearing insertion and deterministic reconciliation.
- Modify `tests/workspace-assets.test.ts`: insertion/reconciliation contracts.
- Create `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState.ts`: synchronous ref-backed asset-state commits.
- Modify `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssets.ts`: handler orchestrator accepts external state.
- Modify `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets.ts`: accepted insertion gates picker close and upload.
- Modify `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState.ts`: submission-mode reconciliation.
- Modify `frontend/app/(core)/(workspace)/app/AppClient.tsx`: asset state before composer, handlers after composer.
- Modify `tests/workspace-assets-split-contract.test.ts` and `tests/workspace-input-schema-hook-contract.test.ts`: hook boundaries.
- Modify `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs.ts`: authoritative pre-submit guard.
- Modify `tests/workspace-generation-inputs.test.ts`: submission-mode tests.
- Modify `frontend/app/api/generate/_lib/attachment-references.ts`: original field-to-URL map.
- Modify `tests/generate-attachment-references.test.ts`: REF2V/V2V slot preservation.
- Modify `frontend/app/api/generate/_lib/validation-payload.ts`: validation context.
- Modify `frontend/app/api/generate/_lib/validate.ts` and `validate-media-inputs.ts`: server guard.
- Modify `frontend/app/api/generate/route.ts`: pass runtime schema and field values.
- Modify `tests/generate-validation-payload.test.ts` and `tests/validate-request.test.ts`: context/projection/server tests.
- Modify `frontend/src/server/video-providers/byteplus-modelark-payload.ts`: final typed-item defense.
- Modify `frontend/app/api/generate/_lib/byteplus-submission.ts`: wire schema and original values into the builder.
- Modify `tests/byteplus-provider-architecture.test.ts` and `tests/generate-byteplus-submission.test.ts`: payload/submission defense.

### Task 1: Define the shared aggregate-budget contract

**Files:**
- Modify: `frontend/types/engines.ts`
- Create: `frontend/lib/reference-budget.ts`
- Create: `tests/reference-budget.test.ts`

**Interfaces:**
- Produces:
  - `EngineReferenceBudget`
  - `ResolvedEngineReferenceBudget`
  - `ReferenceBudgetValuesByField<T>`
  - `ReferenceBudgetMediaItem`
  - `resolveEngineReferenceBudget(inputSchema, mode)`
  - `resolveEngineReferenceBudgetForValues(inputSchema, preferredMode, valuesByField, getIdentity, prospectiveFieldId?)`
  - `evaluateReferenceBudget({ budget, valuesByField, getIdentity })`
  - `buildReferenceMediaItems(inputSchema, mode, valuesByField)`

- [ ] **Step 1: Write the failing pure-unit tests**

Create `tests/reference-budget.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReferenceMediaItems,
  evaluateReferenceBudget,
  resolveEngineReferenceBudget,
  resolveEngineReferenceBudgetForValues,
} from '../frontend/lib/reference-budget';
import type { EngineInputSchema } from '../frontend/types/engines';

const schema: EngineInputSchema = {
  optional: [
    { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'], maxCount: 50 },
    { id: 'video_urls', type: 'video', label: 'Videos', modes: ['ref2v'], maxCount: 10 },
    { id: 'audio_urls', type: 'audio', label: 'Audio', modes: ['ref2v'], maxCount: 10 },
    { id: 'edit_images', type: 'image', label: 'Edit images', modes: ['v2v'], maxCount: 5 },
  ],
  referenceBudget: {
    fieldIds: ['image_urls', 'video_urls', 'audio_urls', 'edit_images'],
    modes: ['ref2v', 'v2v'],
    maxTotal: 3,
    countUniqueUrls: true,
  },
};

test('resolveEngineReferenceBudget keeps only fields active in the requested mode', () => {
  assert.deepEqual(resolveEngineReferenceBudget(schema, 'ref2v'), {
    fieldIds: ['image_urls', 'video_urls', 'audio_urls'],
    maxTotal: 3,
    countUniqueUrls: true,
  });
  assert.deepEqual(resolveEngineReferenceBudget(schema, 'v2v'), {
    fieldIds: ['edit_images'],
    maxTotal: 3,
    countUniqueUrls: true,
  });
  assert.equal(resolveEngineReferenceBudget(schema, 't2v'), null);
});

test('prospective values activate a ref2v-only budget before form mode catches up', () => {
  assert.deepEqual(
    resolveEngineReferenceBudgetForValues(
      schema,
      't2v',
      { image_urls: ['a', 'b'], video_urls: ['c'] },
      (value) => value,
      'video_urls'
    ),
    {
      fieldIds: ['image_urls', 'video_urls', 'audio_urls'],
      maxTotal: 3,
      countUniqueUrls: true,
    }
  );
});

test('prospective resolution derives field modes when budget modes are omitted', () => {
  const unscopedBudgetSchema: EngineInputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
  };
  assert.deepEqual(
    resolveEngineReferenceBudgetForValues(
      unscopedBudgetSchema,
      't2v',
      { image_urls: ['a'] },
      (value) => value,
      'image_urls'
    ),
    {
      fieldIds: ['image_urls'],
      maxTotal: 1,
      countUniqueUrls: true,
    }
  );
});

test('prospective resolution selects the mode covering the complete candidate state', () => {
  const mixedSchema: EngineInputSchema = {
    optional: [
      {
        id: 'image_urls',
        type: 'image',
        label: 'Images',
        modes: ['ref2v', 'v2v'],
      },
      { id: 'video_url', type: 'video', label: 'Source', modes: ['v2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'video_url'],
      modes: ['ref2v', 'v2v'],
      maxTotal: 2,
      countUniqueUrls: true,
    },
  };
  assert.deepEqual(
    resolveEngineReferenceBudgetForValues(
      mixedSchema,
      't2v',
      { image_urls: ['image'], video_url: ['video'] },
      (value) => value,
      'video_url'
    ),
    {
      fieldIds: ['image_urls', 'video_url'],
      maxTotal: 2,
      countUniqueUrls: true,
    }
  );
});

test('evaluateReferenceBudget normalizes and deduplicates identities when configured', () => {
  assert.deepEqual(
    evaluateReferenceBudget({
      budget: resolveEngineReferenceBudget(schema, 'ref2v')!,
      valuesByField: {
        image_urls: [' https://cdn.example.com/a.jpg ', 'https://cdn.example.com/a.jpg'],
        video_urls: ['https://cdn.example.com/b.mp4'],
        audio_urls: ['', 'https://cdn.example.com/c.mp3'],
      },
      getIdentity: (value) => value,
    }),
    { ok: true, count: 3, maxTotal: 3 }
  );
});

test('evaluateReferenceBudget reports overflow and can count duplicate entries', () => {
  assert.deepEqual(
    evaluateReferenceBudget({
      budget: { fieldIds: ['images'], maxTotal: 1, countUniqueUrls: false },
      valuesByField: { images: ['same', 'same'] },
      getIdentity: (value) => value,
    }),
    { ok: false, count: 2, maxTotal: 1 }
  );
});

test('buildReferenceMediaItems preserves active field id, kind, order, and duplicates', () => {
  assert.deepEqual(
    buildReferenceMediaItems(schema, 'ref2v', {
      image_urls: [' a ', 'a'],
      video_urls: ['v'],
      audio_urls: [''],
      edit_images: ['not-active'],
    }),
    [
      { fieldId: 'image_urls', kind: 'image', url: 'a' },
      { fieldId: 'image_urls', kind: 'image', url: 'a' },
      { fieldId: 'video_urls', kind: 'video', url: 'v' },
    ]
  );
});
```

- [ ] **Step 2: Run the test and verify the red state**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/reference-budget.test.ts
```

Expected: FAIL because the shared module and schema type do not exist.

- [ ] **Step 3: Add the public schema capability**

Replace the current `EngineInputSchema` declaration prefix in `frontend/types/engines.ts` with:

```ts
export interface EngineReferenceBudget {
  fieldIds: string[];
  modes?: Mode[];
  maxTotal: number;
  countUniqueUrls: boolean;
}

export interface EngineInputSchema {
  required?: EngineInputField[];
  optional?: EngineInputField[];
  referenceBudget?: EngineReferenceBudget;
  constraints?: {
```

Keep the existing `constraints` body unchanged.

- [ ] **Step 4: Implement the shared utility**

Create `frontend/lib/reference-budget.ts`:

```ts
import type {
  EngineInputSchema,
  EngineReferenceBudget,
  Mode,
} from '@/types/engines';

export type ResolvedEngineReferenceBudget = Omit<EngineReferenceBudget, 'modes'>;
export type ReferenceBudgetValuesByField<T> = Record<
  string,
  readonly T[] | undefined
>;
export type ReferenceBudgetMediaItem = {
  fieldId: string;
  kind: 'image' | 'video' | 'audio';
  url: string;
};
export type ReferenceBudgetEvaluation =
  | { ok: true; count: number; maxTotal: number }
  | { ok: false; count: number; maxTotal: number };

export function resolveEngineReferenceBudget(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode
): ResolvedEngineReferenceBudget | null {
  const budget = inputSchema?.referenceBudget;
  if (!budget || budget.maxTotal < 1 || (budget.modes?.length && !budget.modes.includes(mode))) {
    return null;
  }
  const fields = [...(inputSchema.required ?? []), ...(inputSchema.optional ?? [])];
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const fieldIds = budget.fieldIds.filter((fieldId, index, list) => {
    if (list.indexOf(fieldId) !== index) return false;
    const field = fieldsById.get(fieldId);
    return Boolean(field && (!field.modes?.length || field.modes.includes(mode)));
  });
  return fieldIds.length
    ? {
        fieldIds,
        maxTotal: budget.maxTotal,
        countUniqueUrls: budget.countUniqueUrls,
      }
    : null;
}

export function resolveEngineReferenceBudgetForValues<T>(
  inputSchema: EngineInputSchema | null | undefined,
  preferredMode: Mode,
  valuesByField: ReferenceBudgetValuesByField<T>,
  getIdentity: (value: T) => string | null | undefined,
  prospectiveFieldId?: string
): ResolvedEngineReferenceBudget | null {
  const budget = inputSchema?.referenceBudget;
  if (!budget) return null;
  const fields = [...(inputSchema?.required ?? []), ...(inputSchema?.optional ?? [])];
  const candidateModes = Array.from(
    new Set<Mode>([
      preferredMode,
      ...(budget.modes ?? []),
      ...fields
        .filter((field) => budget.fieldIds.includes(field.id))
        .flatMap((field) => field.modes ?? []),
    ])
  );
  let best:
    | {
        budget: ResolvedEngineReferenceBudget;
        score: number;
      }
    | null = null;
  for (const candidateMode of candidateModes) {
    const candidate = resolveEngineReferenceBudget(inputSchema, candidateMode);
    if (!candidate) continue;
    const populatedFieldCount = candidate.fieldIds.filter((fieldId) =>
      (valuesByField[fieldId] ?? []).some((value) =>
        Boolean(getIdentity(value)?.trim())
      )
    ).length;
    if (populatedFieldCount === 0) continue;
    const score =
      populatedFieldCount * 10 +
      (prospectiveFieldId && candidate.fieldIds.includes(prospectiveFieldId)
        ? 100
        : 0) +
      (candidateMode === preferredMode ? 1 : 0);
    if (!best || score > best.score) best = { budget: candidate, score };
  }
  return best?.budget ?? null;
}

export function evaluateReferenceBudget<T>(params: {
  budget: ResolvedEngineReferenceBudget;
  valuesByField: ReferenceBudgetValuesByField<T>;
  getIdentity: (value: T) => string | null | undefined;
}): ReferenceBudgetEvaluation {
  const identities: string[] = [];
  for (const fieldId of params.budget.fieldIds) {
    for (const value of params.valuesByField[fieldId] ?? []) {
      const identity = params.getIdentity(value)?.trim();
      if (identity) identities.push(identity);
    }
  }
  const count = params.budget.countUniqueUrls
    ? new Set(identities).size
    : identities.length;
  return {
    ok: count <= params.budget.maxTotal,
    count,
    maxTotal: params.budget.maxTotal,
  };
}

export function buildReferenceMediaItems(
  inputSchema: EngineInputSchema,
  mode: Mode,
  valuesByField: ReferenceBudgetValuesByField<string>
): ReferenceBudgetMediaItem[] {
  const fields = [...(inputSchema.required ?? []), ...(inputSchema.optional ?? [])];
  return fields.flatMap((field) => {
    if (field.modes?.length && !field.modes.includes(mode)) return [];
    const fieldId = field.id;
    const kind = field.type;
    if (kind !== 'image' && kind !== 'video' && kind !== 'audio') return [];
    return (valuesByField[fieldId] ?? [])
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ fieldId, kind, url }));
  });
}
```

- [ ] **Step 5: Run unit tests and TypeScript**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/reference-budget.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 6: Commit the shared contract**

```bash
git add \
  frontend/types/engines.ts \
  frontend/lib/reference-budget.ts \
  tests/reference-budget.test.ts
git commit -m "feat: define aggregate reference budgets"
```

### Task 2: Make workspace insertion result-bearing and deterministic

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-assets.ts`
- Modify: `tests/workspace-assets.test.ts`

**Interfaces:**
- Consumes: shared utility from Task 1.
- Produces:
  - `ReferenceAssetInsertionResult`
  - `tryInsertReferenceAsset(previous, field, asset, slotIndex, options)`
  - compatibility `insertReferenceAsset(...)`
  - `reconcileReferenceAssets(previous, fields, referenceBudget, release)`

- [ ] **Step 1: Add failing insertion and reconciliation tests**

Extend `tests/workspace-assets.test.ts` imports with:

```ts
import type { ResolvedEngineReferenceBudget } from '../frontend/lib/reference-budget';
import type { EngineInputSchema } from '../frontend/types/engines';
import {
  reconcileReferenceAssets,
  tryInsertReferenceAsset,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
```

Add:

```ts
const sharedBudget: ResolvedEngineReferenceBudget = {
  fieldIds: ['image_urls', 'video_urls'],
  maxTotal: 2,
  countUniqueUrls: true,
};

test('candidate insertion enforces one shared budget across fields', () => {
  const images: EngineInputField = { id: 'image_urls', type: 'image', label: 'Images', maxCount: 5 };
  const videos: EngineInputField = { id: 'video_urls', type: 'video', label: 'Videos', maxCount: 5 };
  const inputSchema: EngineInputSchema = {
    optional: [
      { ...images, modes: ['ref2v' as const] },
      { ...videos, modes: ['ref2v' as const] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'video_urls'],
      modes: ['ref2v' as const],
      maxTotal: 2,
      countUniqueUrls: true,
    },
  };
  const first = buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'one', url: 'one' }));
  const second = buildReferenceAssetFromLibraryAsset(videos, userAsset({
    id: 'two',
    kind: 'video',
    mime: 'video/mp4',
    url: 'two',
  }));
  const rejected = buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'three', url: 'three' }));

  const one = tryInsertReferenceAsset({}, images, first, undefined, {
    inputSchema,
    preferredMode: 't2v',
  });
  assert.equal(one.accepted, true);
  const two = tryInsertReferenceAsset(one.state, videos, second, undefined, {
    inputSchema,
    preferredMode: 't2v',
  });
  assert.equal(two.accepted, true);
  const three = tryInsertReferenceAsset(two.state, images, rejected, undefined, {
    inputSchema,
    preferredMode: 't2v',
  });
  assert.deepEqual(three, {
    accepted: false,
    state: two.state,
    reason: 'reference_budget',
    maxTotal: 2,
  });
});

test('rejected replacement neither mutates state nor releases the current asset', () => {
  const field: EngineInputField = { id: 'image_urls', type: 'image', label: 'Images', maxCount: 2 };
  const current = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'current', url: 'current' }));
  const other = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'other', url: 'other' }));
  const replacement = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'replacement', url: 'replacement' }));
  const state = { image_urls: [current, other] };
  const result = tryInsertReferenceAsset(state, field, replacement, 0, {
    inputSchema: {
      optional: [{ ...field, modes: ['ref2v'] }],
      referenceBudget: {
        fieldIds: ['image_urls'],
        modes: ['ref2v'],
        maxTotal: 2,
        countUniqueUrls: false,
      },
    },
    preferredMode: 'ref2v',
  });
  assert.equal(result.accepted, true);
  assert.equal(result.replacedAsset?.id, 'current');

  const overflowResult = tryInsertReferenceAsset(
    { image_urls: [current, other], video_urls: [replacement] },
    field,
    replacement,
    0,
    {
      inputSchema: {
        optional: [
          { ...field, modes: ['ref2v'] },
          { id: 'video_urls', type: 'video', label: 'Videos', modes: ['ref2v'] },
        ],
        referenceBudget: {
          fieldIds: ['image_urls', 'video_urls'],
          modes: ['ref2v'],
          maxTotal: 2,
          countUniqueUrls: false,
        },
      },
      preferredMode: 'ref2v',
    }
  );
  assert.equal(overflowResult.accepted, false);
  assert.equal(overflowResult.replacedAsset, undefined);
  assert.equal(overflowResult.state.image_urls[0], current);
});

test('reconciliation preserves retained arrays exactly when no aggregate budget exists', () => {
  const field: EngineInputField = { id: 'image_urls', type: 'image', label: 'Images', maxCount: 1 };
  const first = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'first', url: 'first' }));
  const second = buildReferenceAssetFromLibraryAsset(field, userAsset({ id: 'second', url: 'second' }));
  const previous = { image_urls: [first, second] };
  assert.equal(reconcileReferenceAssets(previous, [field], null), previous);
});

test('budget reconciliation keeps destination field order and releases overflow', () => {
  const images: EngineInputField = { id: 'image_urls', type: 'image', label: 'Images', maxCount: 3 };
  const videos: EngineInputField = { id: 'video_urls', type: 'video', label: 'Videos', maxCount: 1 };
  const released: string[] = [];
  const previous = {
    video_urls: [buildReferenceAssetFromLibraryAsset(videos, userAsset({ id: 'video', kind: 'video', mime: 'video/mp4', url: 'video' }))],
    image_urls: [
      buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'image-1', url: 'image-1' })),
      buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'image-2', url: 'image-2' })),
      buildReferenceAssetFromLibraryAsset(images, userAsset({ id: 'image-3', url: 'image-3' })),
    ],
  };
  const reconciled = reconcileReferenceAssets(
    previous,
    [images, videos],
    sharedBudget,
    (asset) => released.push(asset.id)
  );
  assert.deepEqual(reconciled.image_urls.map((entry) => entry?.id ?? null), ['image-1', 'image-2', null]);
  assert.equal(reconciled.video_urls, undefined);
  assert.deepEqual(released.sort(), ['image-3', 'video']);
});

test('reconciliation does not count or release an active source field outside the budget', () => {
  const images: EngineInputField = {
    id: 'image_urls',
    type: 'image',
    label: 'Images',
    maxCount: 2,
  };
  const source: EngineInputField = {
    id: 'video_url',
    type: 'video',
    label: 'Source',
    maxCount: 1,
  };
  const released: string[] = [];
  const image = buildReferenceAssetFromLibraryAsset(
    images,
    userAsset({ id: 'image', url: 'image' })
  );
  const video = buildReferenceAssetFromLibraryAsset(
    source,
    userAsset({
      id: 'source',
      kind: 'video',
      mime: 'video/mp4',
      url: 'source',
    })
  );
  const result = reconcileReferenceAssets(
    { image_urls: [image], video_url: [video] },
    [images, source],
    {
      fieldIds: ['image_urls'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
    (asset) => released.push(asset.id)
  );
  assert.equal(result.video_url[0], video);
  assert.deepEqual(released, []);
});
```

- [ ] **Step 2: Run the workspace asset test and verify the red state**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-assets.test.ts
```

Expected: FAIL because result-bearing insertion and reconciliation do not exist.

- [ ] **Step 3: Implement result-bearing insertion**

Add these types and implement `tryInsertReferenceAsset` by moving the current slot-selection logic into it:

```ts
type InputAssetState = Record<string, (ReferenceAsset | null)[]>;

export type ReferenceAssetInsertionResult =
  | {
      accepted: true;
      state: InputAssetState;
      replacedAsset: ReferenceAsset | null;
    }
  | {
      accepted: false;
      state: InputAssetState;
      reason: 'field_limit' | 'reference_budget';
      maxTotal?: number;
      replacedAsset?: undefined;
    };

export function tryInsertReferenceAsset(
  previous: InputAssetState,
  field: EngineInputField,
  asset: ReferenceAsset,
  slotIndex?: number,
  options?: {
    inputSchema?: EngineInputSchema | null;
    preferredMode?: Mode;
  }
): ReferenceAssetInsertionResult {
  const maxCount = field.maxCount ?? 0;
  const current = previous[field.id] ? [...previous[field.id]] : [];
  if (maxCount > 0 && current.length < maxCount) {
    while (current.length < maxCount) current.push(null);
  }

  let targetIndex = typeof slotIndex === 'number' ? slotIndex : -1;
  if (maxCount > 0 && targetIndex >= maxCount) targetIndex = -1;
  if (targetIndex < 0) targetIndex = current.findIndex((entry) => entry === null);
  if (targetIndex < 0 && maxCount > 0 && current.length >= maxCount) {
    return { accepted: false, state: previous, reason: 'field_limit' };
  }

  const candidate = [...current];
  const replacedAsset = targetIndex >= 0 ? candidate[targetIndex] ?? null : null;
  if (targetIndex < 0) candidate.push(asset);
  else candidate[targetIndex] = asset;
  const candidateState = { ...previous, [field.id]: candidate };
  const budget = resolveEngineReferenceBudgetForValues(
    options?.inputSchema,
    options?.preferredMode ?? 't2v',
    candidateState,
    (entry) => entry?.url ?? entry?.previewUrl ?? null,
    field.id
  );
  if (budget) {
    const evaluation = evaluateReferenceBudget({
      budget,
      valuesByField: candidateState,
      getIdentity: (entry) => entry?.url ?? entry?.previewUrl ?? null,
    });
    if (!evaluation.ok) {
      return {
        accepted: false,
        state: previous,
        reason: 'reference_budget',
        maxTotal: evaluation.maxTotal,
      };
    }
  }
  return {
    accepted: true,
    state: candidateState,
    replacedAsset,
  };
}
```

Keep the current `insertReferenceAsset` export as a compatibility wrapper:

```ts
const result = tryInsertReferenceAsset(previous, field, asset, slotIndex, {
  inputSchema: options?.inputSchema,
  preferredMode: options?.preferredMode,
});
if (!result.accepted) {
  if (result.reason === 'field_limit') options?.onMaxReached?.();
  else options?.onBudgetReached?.(result.maxTotal ?? 0);
  return previous;
}
if (result.replacedAsset) options?.release?.(result.replacedAsset);
return result.state;
```

Extend the wrapper options with `inputSchema`, `preferredMode`, and `onBudgetReached`.

- [ ] **Step 4: Implement deterministic reconciliation without changing no-budget behavior**

Add `reconcileReferenceAssets`. Its no-budget branch must reproduce the current effect exactly: keep arrays for allowed field IDs unchanged, release assets under obsolete IDs, and return `previous` when nothing changed.

For the budget branch, iterate `fields` in order and preserve slot order.
Release values beyond each field's positive `maxCount`. Apply aggregate counting
only when `referenceBudget.fieldIds` contains the current field ID; active
fields outside the aggregate budget must remain available and must not consume
units. Replace dropped occupied slots with `null`; omit fields with no occupied
slots. Release every asset under an obsolete field ID exactly once. Before
returning, compare keys, lengths, and element identities and return `previous`
when the result is identical.

Use this exact aggregate decision inside the loop:

```ts
const identity = (asset.url ?? asset.previewUrl).trim();
const consumesUnit = !referenceBudget.countUniqueUrls || !counted.has(identity);
if (consumesUnit && aggregateCount >= referenceBudget.maxTotal) {
  release?.(asset);
  retained[index] = null;
  continue;
}
if (consumesUnit) {
  aggregateCount += 1;
  counted.add(identity);
}
```

- [ ] **Step 5: Run asset and utility tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/reference-budget.test.ts \
  tests/workspace-assets.test.ts
```

Expected: PASS, including existing insertion/removal tests.

- [ ] **Step 6: Commit workspace asset semantics**

```bash
git add \
  frontend/app/\(core\)/\(workspace\)/app/_lib/workspace-assets.ts \
  tests/workspace-assets.test.ts
git commit -m "feat: make reference insertion budget-aware"
```

### Task 3: Wire accepted mutations and authoritative modes through workspace hooks

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState.ts`
- Modify: `frontend/app/(core)/(workspace)/app/AppClient.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssets.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState.ts`
- Modify: `tests/workspace-assets-split-contract.test.ts`
- Modify: `tests/workspace-input-schema-hook-contract.test.ts`

**Interfaces:**
- Consumes: `tryInsertReferenceAsset`, `resolveEngineReferenceBudget`, and `reconcileReferenceAssets`.
- Produces:
  - `useWorkspaceAssetState()`
  - `CommitInputAssetMutation`
  - handlers that start side effects only after an accepted synchronous mutation.

- [ ] **Step 1: Add failing architecture and side-effect ordering contracts**

In `tests/workspace-assets-split-contract.test.ts`, add:

```ts
const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const assetStateHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState.ts';
```

Inside its main test, read `appSource` and `assetStateSource`, then assert:

```ts
assert.equal(existsSync(assetStateHookPath), true);
assert.match(assetStateSource, /export function useWorkspaceAssetState/);
assert.match(assetStateSource, /commitInputAssetMutation/);
assert.match(appSource, /const assetState = useWorkspaceAssetState\(\)/);
assert.ok(
  appSource.indexOf('useWorkspaceAssetState()') <
    appSource.indexOf('useWorkspaceComposerState({')
);
assert.ok(
  appSource.indexOf('useWorkspaceComposerState({') <
    appSource.indexOf('useWorkspaceAssets({')
);
assert.match(appSource, /preferredMode: composer\.submissionMode/);
assert.match(referenceAssetsSource, /tryInsertReferenceAsset/);
assert.match(referenceAssetsSource, /commitInputAssetMutation/);
const handleAssetAddIndex = referenceAssetsSource.indexOf(
  'const handleAssetAdd = useCallback'
);
const uploadIndex = referenceAssetsSource.indexOf(
  'const upload = async',
  handleAssetAddIndex
);
const localRejectedGuardIndex = referenceAssetsSource.lastIndexOf(
  'if (!insertion.accepted)',
  uploadIndex
);
assert.ok(
  handleAssetAddIndex >= 0 &&
    localRejectedGuardIndex > handleAssetAddIndex &&
    localRejectedGuardIndex < uploadIndex
);
```

In `tests/workspace-input-schema-hook-contract.test.ts`, add:

```ts
assert.match(hookSource, /reconcileReferenceAssets/);
assert.match(hookSource, /resolveEngineReferenceBudget/);
assert.match(hookSource, /submissionMode/);
```

- [ ] **Step 2: Run contracts and verify the red state**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/workspace-assets-split-contract.test.ts \
  tests/workspace-input-schema-hook-contract.test.ts
```

Expected: FAIL because state ownership and accepted-mutation gating are absent.

- [ ] **Step 3: Create the ref-backed state hook**

Create `useWorkspaceAssetState.ts`:

```ts
import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ReferenceAsset } from '../_lib/workspace-assets';

export type WorkspaceInputAssetState = Record<
  string,
  (ReferenceAsset | null)[]
>;
export type CommitInputAssetMutation = <
  T extends { state: WorkspaceInputAssetState },
>(
  mutation: (previous: WorkspaceInputAssetState) => T
) => T;

export function useWorkspaceAssetState() {
  const [inputAssets, setReactInputAssets] =
    useState<WorkspaceInputAssetState>({});
  const inputAssetsRef = useRef<WorkspaceInputAssetState>({});

  const setInputAssets = useCallback<
    Dispatch<SetStateAction<WorkspaceInputAssetState>>
  >((action) => {
    const previous = inputAssetsRef.current;
    const next =
      typeof action === 'function'
        ? (action as (value: WorkspaceInputAssetState) => WorkspaceInputAssetState)(previous)
        : action;
    if (next === previous) return;
    inputAssetsRef.current = next;
    setReactInputAssets(next);
  }, []);

  const commitInputAssetMutation = useCallback<CommitInputAssetMutation>(
    (mutation) => {
      const result = mutation(inputAssetsRef.current);
      if (result.state !== inputAssetsRef.current) {
        inputAssetsRef.current = result.state;
        setReactInputAssets(result.state);
      }
      return result;
    },
    []
  );

  return {
    inputAssets,
    inputAssetsRef,
    setInputAssets,
    commitInputAssetMutation,
  };
}
```

- [ ] **Step 4: Split state initialization from handler orchestration in `AppClient`**

Replace the early `useWorkspaceAssets` call with:

```ts
const assetState = useWorkspaceAssetState();
```

Pass `assetState.setInputAssets` to `useWorkspaceVideoSettings` and `assetState.inputAssets` to `useWorkspaceComposerState`.

After `useWorkspaceComposerState`, call:

```ts
const assets = useWorkspaceAssets({
  inputAssets: assetState.inputAssets,
  setInputAssets: assetState.setInputAssets,
  commitInputAssetMutation: assetState.commitInputAssetMutation,
  engineId: routeForm.form?.engineId,
  inputSchema: composer.selectedEngine?.inputSchema,
  preferredMode: composer.submissionMode,
  workflowCopy: app.workflowCopy,
  showNotice: noticeState.showNotice,
  klingElements: routeForm.klingElements,
  setKlingElements: routeForm.setKlingElements,
});
```

Remove `useState` ownership from `useWorkspaceAssets`; add `inputAssets`, `setInputAssets`, `commitInputAssetMutation`, `inputSchema`, and `preferredMode` to its options and pass them to `useWorkspaceReferenceAssets`. Continue returning `inputAssets` and `setInputAssets` so downstream call sites stay stable.

- [ ] **Step 5: Gate library close, replacement release, and upload on acceptance**

In `useWorkspaceReferenceAssets`, accept `EngineInputSchema`, `Mode`, and `CommitInputAssetMutation`.

For library insertion:

```ts
const insertion = commitInputAssetMutation((previous) =>
  tryInsertReferenceAsset(previous, field, newAsset, slotIndex, {
    inputSchema,
    preferredMode,
  })
);
if (!insertion.accepted) {
  showNotice(
    insertion.reason === 'reference_budget'
      ? `Maximum ${insertion.maxTotal} total references reached for this engine mode.`
      : `Maximum ${field.label ?? 'reference image'} count reached for this engine.`
  );
  return;
}
if (insertion.replacedAsset) revokeAssetPreview(insertion.replacedAsset);
setAssetPickerTarget(null);
```

For a local file, commit the uploading placeholder before declaring or invoking `upload`:

```ts
const insertion = commitInputAssetMutation((previous) =>
  tryInsertReferenceAsset(previous, field, baseAsset, slotIndex, {
    inputSchema,
    preferredMode,
  })
);
if (!insertion.accepted) {
  revokeAssetPreview(baseAsset);
  showNotice(
    insertion.reason === 'reference_budget'
      ? `Maximum ${insertion.maxTotal} total references reached for this engine mode.`
      : `Maximum ${field.label ?? 'reference file'} count reached for this engine.`
  );
  return;
}
if (insertion.replacedAsset) revokeAssetPreview(insertion.replacedAsset);

const upload = async () => {
```

Keep the complete existing upload body after this accepted guard. Include `inputSchema`, `preferredMode`, and `commitInputAssetMutation` in callback dependencies.

- [ ] **Step 6: Reconcile with the submission mode**

Add `submissionMode: Mode` to `UseWorkspaceInputSchemaStateOptions`. In its asset effect:

```ts
const activeFields = inputSchemaSummary.assetFields.map((entry) => entry.field);
const referenceBudget = resolveEngineReferenceBudget(
  selectedEngine?.inputSchema,
  submissionMode
);
setInputAssets((previous) =>
  reconcileReferenceAssets(
    previous,
    activeFields,
    referenceBudget,
    revokeAssetPreview
  )
);
```

Pass both `activeMode: composer.activeMode` for schema-summary UI and `submissionMode: composer.submissionMode` for budget enforcement from `AppClient`.
Add `selectedEngine?.inputSchema` and `submissionMode` to the asset effect's
dependency array alongside its existing dependencies; the reconciliation must
rerun when either the selected schema or authoritative submission mode changes.

- [ ] **Step 7: Run workspace contracts, unit tests, and TypeScript**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/reference-budget.test.ts \
  tests/workspace-assets.test.ts \
  tests/workspace-assets-split-contract.test.ts \
  tests/workspace-input-schema-hook-contract.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: PASS. Source ordering proves rejected local insertion returns before `upload` is declared, and unit tests prove rejected replacement has no release target.

- [ ] **Step 8: Commit workspace wiring**

```bash
git add \
  frontend/app/\(core\)/\(workspace\)/app/AppClient.tsx \
  frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceAssetState.ts \
  frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceAssets.ts \
  frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceReferenceAssets.ts \
  frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceInputSchemaState.ts \
  tests/workspace-assets-split-contract.test.ts \
  tests/workspace-input-schema-hook-contract.test.ts
git commit -m "feat: wire reference budgets into workspace"
```

### Task 4: Enforce the budget against the actual submission mode

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs.ts`
- Modify: `tests/workspace-generation-inputs.test.ts`

**Interfaces:**
- Changes `PrepareGenerationInputsOptions.submissionMode` from `string` to `Mode`.
- Produces a pre-submit aggregate guard based on `submissionMode`.

- [ ] **Step 1: Add a failing active-mode versus submission-mode test**

Extend imports with `EngineInputSchema` and `PrepareGenerationInputsOptions`, then add:

```ts
function referenceBudgetPreparationOptions(params: {
  inputSchema: EngineInputSchema;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  fields: EngineInputField[];
}): PrepareGenerationInputsOptions {
  return {
    selectedEngineId: 'contract-test-engine',
    selectedEngineLabel: 'Contract test engine',
    activeMode: 't2v',
    submissionMode: 'ref2v',
    form: baseForm({ engineId: 'contract-test-engine', mode: 't2v' }),
    inputSchema: params.inputSchema,
    inputSchemaSummary: {
      assetFields: params.fields.map((inputField) => ({
        field: inputField,
        required: false,
        role: 'reference' as const,
      })),
    },
    extraInputFields: [],
    inputAssets: params.inputAssets,
    primaryAssetFieldIds: new Set(),
    referenceAssetFieldIds: new Set(params.fields.map((inputField) => inputField.id)),
    genericImageFieldIds: new Set(
      params.fields.filter((inputField) => inputField.type === 'image').map((inputField) => inputField.id)
    ),
    frameAssetFieldIds: new Set(),
    referenceAudioFieldIds: new Set(
      params.fields.filter((inputField) => inputField.type === 'audio').map((inputField) => inputField.id)
    ),
    supportsKlingV3Controls: false,
    klingElements: [],
    multiPromptActive: false,
    multiPromptScenes: [],
  };
}

test('prepareGenerationInputs validates the submission mode when active mode lags', () => {
  const images = field('image_urls', 'image', 'Images');
  const videos = field('video_urls', 'video', 'Videos');
  const inputSchema: EngineInputSchema = {
    optional: [
      { ...images, modes: ['ref2v'] },
      { ...videos, modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls', 'video_urls'],
      modes: ['ref2v'],
      maxTotal: 2,
      countUniqueUrls: true,
    },
  };
  const result = prepareGenerationInputs(
    referenceBudgetPreparationOptions({
      fields: [images, videos],
      inputSchema,
      inputAssets: {
        image_urls: [
          asset({ id: 'a', fieldId: 'image_urls', url: 'a' }),
          asset({ id: 'b', fieldId: 'image_urls', url: 'b' }),
        ],
        video_urls: [
          asset({ id: 'c', fieldId: 'video_urls', kind: 'video', url: 'c' }),
        ],
      },
    })
  );
  assert.deepEqual(result, {
    ok: false,
    message: 'This engine mode supports up to 2 total references.',
  });
});
```

- [ ] **Step 2: Run the test and verify the red state**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-generation-inputs.test.ts
```

Expected: FAIL because generation preparation does not enforce an aggregate budget.

- [ ] **Step 3: Type and enforce `submissionMode`**

Change:

```ts
submissionMode: Mode;
```

At the start of `prepareGenerationInputs`, add:

```ts
const referenceBudget = resolveEngineReferenceBudget(
  options.inputSchema,
  options.submissionMode
);
if (referenceBudget) {
  const evaluation = evaluateReferenceBudget({
    budget: referenceBudget,
    valuesByField: options.inputAssets,
    getIdentity: (asset) => asset?.url ?? asset?.previewUrl ?? null,
  });
  if (!evaluation.ok) {
    return {
      ok: false,
      message: `This engine mode supports up to ${evaluation.maxTotal} total references.`,
    };
  }
}
```

Keep all current upload, dimension, required-input, Seedance, Happy Horse, Kling, and multi-prompt logic after this guard.

- [ ] **Step 4: Run generation and current-engine regression tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/reference-budget.test.ts \
  tests/workspace-assets.test.ts \
  tests/workspace-generation-inputs.test.ts \
  tests/google-vertex-omni-engine-catalog.test.ts
```

Expected: PASS; current engine outputs remain unchanged because their schemas omit `referenceBudget`.

- [ ] **Step 5: Commit the pre-submit guard**

```bash
git add \
  frontend/app/\(core\)/\(workspace\)/app/_lib/workspace-generation-inputs.ts \
  tests/workspace-generation-inputs.test.ts
git commit -m "feat: validate reference budgets before submission"
```

### Task 5: Preserve original field identities through API validation

**Files:**
- Modify: `frontend/app/api/generate/_lib/attachment-references.ts`
- Modify: `frontend/app/api/generate/_lib/validation-payload.ts`
- Modify: `frontend/app/api/generate/_lib/validate.ts`
- Modify: `frontend/app/api/generate/_lib/validate-media-inputs.ts`
- Modify: `frontend/app/api/generate/route.ts`
- Modify: `tests/generate-attachment-references.test.ts`
- Modify: `tests/generate-validation-payload.test.ts`
- Modify: `tests/validate-request.test.ts`

**Interfaces:**
- Produces `AttachmentReferenceResult.referenceValuesByField`.
- Adds optional `RequestValidationContext` with runtime `inputSchema` and original `referenceValuesByField`.
- Extends `validateModeMediaInputs` with the same context.

- [ ] **Step 1: Add failing original-field and server tests**

In `tests/generate-attachment-references.test.ts`, update the existing full result expectation with:

```ts
referenceValuesByField: {
  image_url: ['https://cdn.maxvideoai.com/primary.png'],
  last_frame_url: ['https://cdn.maxvideoai.com/last.png'],
  reference_images: ['https://cdn.maxvideoai.com/ref-b.png'],
  video_url: ['https://cdn.maxvideoai.com/source.mp4'],
  audio_url: ['https://cdn.maxvideoai.com/audio.mp3'],
  image_urls: [
    'https://cdn.maxvideoai.com/ref-a.png',
    'https://cdn.maxvideoai.com/ref-a.png',
  ],
},
```

Add a V2V test:

```ts
test('attachment reference derivation preserves V2V field ids before projection', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'contract-test-engine',
    mode: 'v2v',
    inputSchema: {
      optional: [
        {
          id: 'reference_image_urls',
          type: 'image',
          label: 'References',
          modes: ['v2v'],
        },
      ],
    },
    referenceImages: ['legacy-image'],
    rawAudioUrl: null,
    attachments: [
      attachment({ kind: 'image', slotId: 'image_urls', url: 'ref2v-image' }),
      attachment({ kind: 'image', slotId: 'reference_image_urls', url: 'v2v-image' }),
      attachment({ kind: 'video', slotId: 'video_url', url: 'source-video' }),
    ],
  });
  assert.deepEqual(result.referenceValuesByField, {
    image_urls: ['ref2v-image'],
    reference_image_urls: ['v2v-image', 'legacy-image'],
    video_url: ['source-video'],
  });
});

test('browser compatibility projections do not duplicate attachment multiplicity', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'contract-test-engine',
    mode: 'ref2v',
    inputSchema: {
      optional: [
        { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
      ],
    },
    referenceImages: ['same-image'],
    rawAudioUrl: null,
    attachments: [
      attachment({
        kind: 'image',
        slotId: 'image_urls',
        url: 'same-image',
      }),
    ],
  });
  assert.deepEqual(result.referenceValuesByField, {
    image_urls: ['same-image'],
  });
});

test('direct-only Seedance V2V references use the schema-authored image_urls field', () => {
  const result = deriveGenerationAttachmentReferences({
    engineId: 'seedance-contract-engine',
    mode: 'v2v',
    inputSchema: {
      optional: [
        {
          id: 'image_urls',
          type: 'image',
          label: 'References',
          modes: ['ref2v', 'v2v'],
        },
      ],
    },
    referenceImages: ['direct-image'],
    rawAudioUrl: null,
    attachments: [],
  });
  assert.deepEqual(result.referenceValuesByField, {
    image_urls: ['direct-image'],
  });
});

for (const mode of ['v2v', 'extend'] as const) {
  test(`direct-only Seedance ${mode} audio uses the active schema-authored field`, () => {
    const result = deriveGenerationAttachmentReferences({
      engineId: 'seedance-contract-engine',
      mode,
      inputSchema: {
        optional: [
          {
            id: 'audio_urls',
            type: 'audio',
            label: 'Reference audio',
            modes: [mode],
          },
        ],
      },
      referenceImages: [],
      rawAudioUrl: 'direct-audio',
      attachments: [],
    });
    assert.deepEqual(result.referenceValuesByField, {
      audio_urls: ['direct-audio'],
    });
  });
}
```

In `tests/validate-request.test.ts`, import `validateModeMediaInputs` and add:

```ts
test('server aggregate validation uses original slot ids instead of projected keys', () => {
  const result = validateModeMediaInputs({
    engineId: 'contract-test-engine',
    normalizedMode: 'v2v',
    inputSchema: {
      optional: [
        { id: 'reference_image_urls', type: 'image', label: 'Images', modes: ['v2v'] },
        { id: 'video_url', type: 'video', label: 'Source', modes: ['v2v'] },
        { id: 'audio_urls', type: 'audio', label: 'Audio', modes: ['v2v'] },
      ],
      referenceBudget: {
        fieldIds: ['reference_image_urls', 'audio_urls'],
        modes: ['v2v'],
        maxTotal: 2,
        countUniqueUrls: true,
      },
    },
    referenceValuesByField: {
      reference_image_urls: ['a', 'b'],
      audio_urls: ['c'],
      video_url: ['source'],
    },
    payload: {
      reference_image_urls: ['a', 'b'],
      audio_url: 'c',
      video_url: 'source',
    },
  });
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'ENGINE_CONSTRAINT',
      field: 'referenceBudget',
      message: 'Up to 2 total references are supported for this engine mode',
      allowed: [0, 2],
      value: 3,
    },
  });
});
```

In `tests/generate-validation-payload.test.ts`, import `EngineInputSchema`, add these defaults to `baseParams`, and add the forwarding test:

```ts
inputSchema: null,
referenceValuesByField: {},
```

```ts
test('validation payload forwards runtime schema and original reference fields', () => {
  const inputSchema = {
    optional: [
      { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
    ],
    referenceBudget: {
      fieldIds: ['image_urls'],
      modes: ['ref2v'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
  } satisfies EngineInputSchema;
  const referenceValuesByField = { image_urls: ['original-field-value'] };
  let capturedContext: unknown;
  const result = buildGenerateValidationPayload({
    ...baseParams,
    inputSchema,
    referenceValuesByField,
    deps: {
      validateRequestFn: (_engineId, _mode, _payload, context) => {
        capturedContext = context;
        return { ok: true };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(capturedContext, {
    inputSchema,
    referenceValuesByField,
  });
});
```

- [ ] **Step 2: Run the three tests and verify the red state**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-attachment-references.test.ts \
  tests/generate-validation-payload.test.ts \
  tests/validate-request.test.ts
```

Expected: FAIL because field-value preservation and validation context do not exist.

- [ ] **Step 3: Preserve values by original attachment field**

Add `inputSchema?: EngineInputSchema | null` to `AttachmentReferenceParams` and
`referenceValuesByField: ReferenceBudgetValuesByField<string>` to
`AttachmentReferenceResult`.

Immediately after the existing `attachmentReferenceImageUrls`, `videoUrls`,
and `audioUrls` values have been computed inside
`deriveGenerationAttachmentReferences`, create:

```ts
const referenceValuesByField: Record<string, string[]> = {};
const appendReferenceValue = (fieldId: string, rawUrl: string | undefined) => {
  const url = rawUrl?.trim();
  if (!fieldId || !url) return;
  (referenceValuesByField[fieldId] ??= []).push(url);
};

for (const attachment of params.attachments) {
  if (!attachment.slotId || typeof attachment.url !== 'string') continue;
  appendReferenceValue(attachment.slotId, attachment.url);
}

const appendProjectionOnlyValues = (
  fieldId: string,
  projectedUrls: string[],
  representedUrls: string[]
) => {
  const remainingRepresented = new Map<string, number>();
  representedUrls.forEach((url) => {
    remainingRepresented.set(url, (remainingRepresented.get(url) ?? 0) + 1);
  });
  projectedUrls.forEach((url) => {
    const representedCount = remainingRepresented.get(url) ?? 0;
    if (representedCount > 0) {
      remainingRepresented.set(url, representedCount - 1);
      return;
    }
    appendReferenceValue(fieldId, url);
  });
};

const schemaFields = [
  ...(params.inputSchema?.required ?? []),
  ...(params.inputSchema?.optional ?? []),
];
const directReferenceImageFieldId =
  schemaFields.find(
    (field) =>
      field.type === 'image' &&
      ['image_urls', 'reference_image_urls', 'reference_images'].includes(
        field.id
      ) &&
      (!field.modes?.length || field.modes.includes(params.mode))
  )?.id ?? (params.mode === 'v2v' ? 'reference_image_urls' : 'image_urls');
const directReferenceImages = normalizeStringList(referenceImagesInput);
appendProjectionOnlyValues(
  directReferenceImageFieldId,
  directReferenceImages,
  attachmentReferenceImageUrls
);
const directReferenceAudioFieldId = schemaFields.find(
  (field) =>
    field.type === 'audio' &&
    ['audio_urls', 'reference_audio_urls', 'reference_audios'].includes(
      field.id
    ) &&
    (!field.modes?.length || field.modes.includes(params.mode))
)?.id;
const directAudioUrl = trimString(params.rawAudioUrl);
if (directReferenceAudioFieldId && directAudioUrl) {
  appendProjectionOnlyValues(
    directReferenceAudioFieldId,
    [directAudioUrl],
    audioUrls
  );
}
```

Return `referenceValuesByField` without deduplicating it. Pass
`engine.inputSchema` from `route.ts` into
`deriveGenerationAttachmentReferences`. `referenceImages` and
`audioUrl` are compatibility projections of `inputs` in the workspace request;
the multiplicity merge above prevents the same transported attachment from
being counted twice while preserving real duplicate entries. Resolving the
direct audio projection from the active schema applies equally to BytePlus
`ref2v`, `v2v`, and `extend` whenever those modes declare a reference-audio
field; do not special-case it to `ref2v`. Continue deriving the current
normalized image/video/audio arrays exactly as before.

- [ ] **Step 4: Pass the runtime schema and original map to validation**

Add to `buildGenerateValidationPayload` parameters:

```ts
inputSchema: EngineInputSchema | null | undefined;
referenceValuesByField: ReferenceBudgetValuesByField<string>;
```

Define in `validate.ts`:

```ts
export type RequestValidationContext = {
  inputSchema?: EngineInputSchema | null;
  referenceValuesByField?: ReferenceBudgetValuesByField<string>;
};
```

Extend the function signature without breaking current three-argument callers:

```ts
export function validateRequest(
  engineId: string,
  mode: Mode | undefined,
  payload: Record<string, unknown>,
  context: RequestValidationContext = {}
): ValidationResult {
```

Call it from `validation-payload.ts` with:

```ts
const validation = validateRequestFn(
  params.engineId,
  params.mode,
  payload,
  {
    inputSchema: params.inputSchema,
    referenceValuesByField: params.referenceValuesByField,
  }
);
```

In `route.ts`, destructure `referenceValuesByField`, pass `engine.inputSchema` and the map into `buildGenerateValidationPayload`, and keep the map available for BytePlus submission in Task 6.

- [ ] **Step 5: Validate the aggregate before specialized rules**

Extend `validateModeMediaInputs` parameters with:

```ts
inputSchema?: EngineInputSchema | null;
referenceValuesByField?: ReferenceBudgetValuesByField<string>;
```

Pass `context.inputSchema` and `context.referenceValuesByField` from `validateRequest`. Before Kling/R2V/V2V specialized validation, add:

```ts
const referenceBudget = resolveEngineReferenceBudget(
  params.inputSchema,
  params.normalizedMode
);
if (referenceBudget) {
  const evaluation = evaluateReferenceBudget({
    budget: referenceBudget,
    valuesByField: params.referenceValuesByField ?? {},
    getIdentity: (value) => value,
  });
  if (!evaluation.ok) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'referenceBudget',
        message: `Up to ${evaluation.maxTotal} total references are supported for this engine mode`,
        allowed: [0, evaluation.maxTotal],
        value: evaluation.count,
      },
    };
  }
}
```

Do not derive aggregate values from `payload[fieldId]`; projected V2V/audio keys are intentionally different.

- [ ] **Step 6: Run API, projection, and current validation tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/generate-attachment-references.test.ts \
  tests/generate-validation-payload.test.ts \
  tests/validate-request.test.ts \
  tests/generate-request-options.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 7: Commit server validation**

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
git commit -m "feat: validate original reference fields on server"
```

### Task 6: Wire the final BytePlus payload defense to the same values

**Files:**
- Modify: `frontend/src/server/video-providers/byteplus-modelark-payload.ts`
- Modify: `frontend/app/api/generate/_lib/byteplus-submission.ts`
- Modify: `frontend/app/api/generate/route.ts`
- Modify: `tests/byteplus-provider-architecture.test.ts`
- Modify: `tests/generate-byteplus-submission.test.ts`

**Interfaces:**
- Consumes: runtime `inputSchema`, `referenceValuesByField`, `ResolvedEngineReferenceBudget`, and `ReferenceBudgetMediaItem`.
- Produces optional `referenceBudget` and `referenceMediaItems` builder parameters. When present, the items provide provenance for every provider-selected reference, the budget counts only declared `fieldIds`, and non-budget source media remains intact.

- [ ] **Step 1: Add failing payload and submission tests**

In `tests/byteplus-provider-architecture.test.ts`, add:

```ts
test('BytePlus payload counts typed budget items before URL deduplication', () => {
  assert.throws(
    () =>
      buildBytePlusSeedancePayload({
        modelId: 'current-model-id',
        prompt: 'A reference-guided scene',
        durationSec: 5,
        mode: 'ref2v',
        resolution: '720p',
        ratio: '16:9',
        allowedResolutions: ['720p'],
        allowedDurationOptions: [5],
        referenceBudget: {
          fieldIds: ['image_urls'],
          maxTotal: 1,
          countUniqueUrls: false,
        },
        referenceMediaItems: [
          { fieldId: 'image_urls', kind: 'image', url: 'same' },
          { fieldId: 'image_urls', kind: 'image', url: 'same' },
        ],
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_REFERENCE_BUDGET_EXCEEDED'
  );
});

test('BytePlus typed provenance preserves a non-budget V2V source video', () => {
  const payload = buildBytePlusSeedancePayload({
    modelId: 'current-model-id',
    prompt: 'Edit the source',
    durationSec: 5,
    mode: 'v2v',
    resolution: '720p',
    ratio: '16:9',
    allowedResolutions: ['720p'],
    allowedDurationOptions: [5],
    referenceImageUrls: ['reference-image'],
    referenceVideoUrls: ['source-video'],
    referenceBudget: {
      fieldIds: ['reference_image_urls'],
      maxTotal: 1,
      countUniqueUrls: true,
    },
    referenceMediaItems: [
      {
        fieldId: 'reference_image_urls',
        kind: 'image',
        url: 'reference-image',
      },
      { fieldId: 'video_url', kind: 'video', url: 'source-video' },
    ],
  });

  assert.deepEqual(
    payload.content
      .filter((item) => item.type !== 'text')
      .map((item) =>
        item.type === 'image_url'
          ? item.image_url.url
          : item.type === 'video_url'
            ? item.video_url.url
            : item.audio_url.url
      ),
    ['reference-image', 'source-video']
  );
});

test('BytePlus rejects a budgeted item omitted from provider-selected arrays', () => {
  assert.throws(
    () =>
      buildBytePlusSeedancePayload({
        modelId: 'current-model-id',
        prompt: 'A reference-guided scene',
        durationSec: 5,
        mode: 'ref2v',
        resolution: '720p',
        ratio: '16:9',
        allowedResolutions: ['720p'],
        allowedDurationOptions: [5],
        referenceBudget: {
          fieldIds: ['image_urls'],
          maxTotal: 2,
          countUniqueUrls: true,
        },
        referenceMediaItems: [
          { fieldId: 'image_urls', kind: 'image', url: 'missing-image' },
        ],
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH'
  );
});
```

In `tests/generate-byteplus-submission.test.ts`, add:

```ts
test('BytePlus submission budget overflow stops before provider access and rolls back', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  let clientRequests = 0;
  let rollbacks = 0;
  try {
    const result = await submitBytePlusGenerateTask({
      ...baseParams,
      inputSchema: {
        optional: [
          { id: 'image_urls', type: 'image', label: 'Images', modes: ['ref2v'] },
          { id: 'video_urls', type: 'video', label: 'Videos', modes: ['ref2v'] },
        ],
        referenceBudget: {
          fieldIds: ['image_urls', 'video_urls'],
          modes: ['ref2v'],
          maxTotal: 2,
          countUniqueUrls: true,
        },
      },
      referenceValuesByField: {
        image_urls: ['a', 'b'],
        video_urls: ['c'],
      },
      pendingReceipt,
      deps: {
        getBytePlusArkConfigFn: () =>
          ({
            seedanceModelId: 'standard-id',
            seedanceFastModelId: 'fast-id',
            seedanceMiniModelId: 'mini-id',
          }) as never,
        getBytePlusModelArkClientFn: () => ({
          createSeedanceFastTask: async () => {
            clientRequests += 1;
            return { providerJobId: 'must_not_exist', status: 'queued' };
          },
        }),
        getBytePlusSeedanceAllowedResolutionsFn: () => ['720p'] as never,
        getBytePlusUserSafeErrorMessageFn: () => 'Reference limit exceeded',
        scrubBytePlusErrorFn: () => 'reference budget exceeded',
        queryFn: async () => undefined,
        rollbackPendingPaymentFn: async () => {
          rollbacks += 1;
        },
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.body.error, 'BYTEPLUS_REFERENCE_BUDGET_EXCEEDED');
    assert.equal(clientRequests, 0);
    assert.equal(rollbacks, 1);
  } finally {
    console.warn = originalWarn;
  }
});
```

- [ ] **Step 2: Run payload/submission tests and verify the red state**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts
```

Expected: FAIL because builder and submission budget/provenance parameters do not exist.

- [ ] **Step 3: Make typed items the provenance source whenever a budget exists**

Extend `buildBytePlusSeedancePayload` parameters:

```ts
referenceBudget?: ResolvedEngineReferenceBudget;
referenceMediaItems?: ReferenceBudgetMediaItem[];
```

Before normalizing reference arrays:

```ts
const referenceMediaItems = params.referenceBudget
  ? params.referenceMediaItems ?? []
  : null;
const budgetFieldIds = params.referenceBudget
  ? new Set(params.referenceBudget.fieldIds)
  : null;
if (params.referenceBudget) {
  const valuesByField = referenceMediaItems!
    .filter((item) => budgetFieldIds!.has(item.fieldId))
    .reduce<Record<string, string[]>>(
    (acc, item) => {
      (acc[item.fieldId] ??= []).push(item.url);
      return acc;
    },
    {}
  );
  const evaluation = evaluateReferenceBudget({
    budget: params.referenceBudget,
    valuesByField,
    getIdentity: (value) => value,
  });
  if (!evaluation.ok) {
    throw new BytePlusModelArkError(
      `BytePlus Seedance supports up to ${evaluation.maxTotal} total references for this mode.`,
      { code: 'BYTEPLUS_REFERENCE_BUDGET_EXCEEDED' }
    );
  }
}

const resolveTypedPayloadUrls = (
  kind: ReferenceBudgetMediaItem['kind'],
  requestedUrls: string[] | undefined
) => {
  const requested = uniqueNonEmptyUrls(requestedUrls);
  if (!referenceMediaItems) return requested;
  const typedByUrl = new Map(
    referenceMediaItems
      .filter((item) => item.kind === kind)
      .map((item) => [item.url.trim(), item] as const)
  );
  return requested.map((url) => {
    const item = typedByUrl.get(url);
    if (!item) {
      throw new BytePlusModelArkError(
        'BytePlus reference payload is missing original field provenance.',
        { code: 'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH' }
      );
    }
    return item.url.trim();
  });
};

const referenceImageUrls = uniqueNonEmptyUrls(
  resolveTypedPayloadUrls('image', params.referenceImageUrls)
);
const referenceVideoUrls = uniqueNonEmptyUrls(
  resolveTypedPayloadUrls('video', params.referenceVideoUrls)
);
const referenceAudioUrls = uniqueNonEmptyUrls(
  resolveTypedPayloadUrls('audio', params.referenceAudioUrls)
);
if (budgetFieldIds && referenceMediaItems) {
  const selectedByKind = {
    image: new Set(referenceImageUrls),
    video: new Set(referenceVideoUrls),
    audio: new Set(referenceAudioUrls),
  };
  const omittedBudgetItem = referenceMediaItems.find(
    (item) =>
      budgetFieldIds.has(item.fieldId) &&
      !selectedByKind[item.kind].has(item.url.trim())
  );
  if (omittedBudgetItem) {
    throw new BytePlusModelArkError(
      'BytePlus budgeted reference is missing from the provider payload.',
      { code: 'BYTEPLUS_REFERENCE_BUDGET_INPUT_MISMATCH' }
    );
  }
}
```

This evaluates duplicate budget entries before the existing payload
deduplication, rejects any provider-selected URL that lost its original field
provenance, and preserves source media outside the aggregate budget.

- [ ] **Step 4: Resolve and pass budget items in submission**

Add optional submission parameters:

```ts
inputSchema?: EngineInputSchema | null;
referenceValuesByField?: ReferenceBudgetValuesByField<string>;
```

Inside the guarded `try`, before payload construction:

```ts
const referenceBudget = resolveEngineReferenceBudget(
  params.inputSchema,
  params.mode
);
const referenceMediaItems =
  referenceBudget && params.inputSchema
    ? buildReferenceMediaItems(
        params.inputSchema,
        params.mode,
        params.referenceValuesByField ?? {}
      )
    : undefined;
```

Pass the new builder keys conditionally so the exact current-engine payload
shape stays unchanged:

```ts
...(referenceBudget
  ? { referenceBudget, referenceMediaItems: referenceMediaItems ?? [] }
  : {}),
```

The current normalized arrays remain the provider-selection allowlist, while
typed items prove their field provenance.
In `route.ts`, pass `engine.inputSchema` and the `referenceValuesByField`
produced in Task 5 into `submitBytePlusGenerateTask`.

Current engines take the legacy array branch because none declares a budget.

- [ ] **Step 5: Run provider, submission, and server tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/generate-attachment-references.test.ts \
  tests/generate-validation-payload.test.ts \
  tests/validate-request.test.ts
```

Expected: PASS; overflow is normally rejected before billing by Task 5 and is also rejected before provider access in direct submission tests.

- [ ] **Step 6: Commit the final payload defense**

```bash
git add \
  frontend/src/server/video-providers/byteplus-modelark-payload.ts \
  frontend/app/api/generate/_lib/byteplus-submission.ts \
  frontend/app/api/generate/route.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts
git commit -m "feat: guard BytePlus reference budgets"
```

## Final Verification

- [ ] **Step 1: Prove no current engine enables the capability**

```bash
if rg -n "referenceBudget" frontend/src/config frontend/config; then
  echo "A current engine unexpectedly enables aggregate reference budgets"
  exit 1
fi
```

Expected: no matches and exit 0.

- [ ] **Step 2: Run the complete focused suite**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/reference-budget.test.ts \
  tests/workspace-assets.test.ts \
  tests/workspace-assets-split-contract.test.ts \
  tests/workspace-input-schema-hook-contract.test.ts \
  tests/workspace-generation-inputs.test.ts \
  tests/generate-attachment-references.test.ts \
  tests/generate-validation-payload.test.ts \
  tests/validate-request.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/generate-request-options.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 3: Run repository policy checks**

```bash
pnpm model:registry:check
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: every command exits 0; current engine and pricing projections remain unchanged.

- [ ] **Step 4: Inspect the implementation range**

```bash
REFERENCE_BUDGET_BASE_SHA="$(
  git rev-parse "$(
    git log --format=%H \
      --grep='^feat: define aggregate reference budgets$' \
      -n 1
  )^"
)"
git diff "$REFERENCE_BUDGET_BASE_SHA"..HEAD -- \
  frontend/types/engines.ts \
  frontend/lib/reference-budget.ts \
  frontend/app/\(core\)/\(workspace\)/app \
  frontend/app/api/generate \
  frontend/src/server/video-providers/byteplus-modelark-payload.ts \
  tests
```

Expected: the new property is optional, current schemas omit it, original
field IDs reach validation, and every selected BytePlus payload URL has typed
field provenance while only declared budget fields consume the aggregate.

- [ ] **Step 5: Commit verification corrections only when required**

If a guard required a scoped correction, make the correction and repeat Final
Verification Steps 1–4 in full. Do not commit until every repeated command is
green. Then run:

```bash
git add \
  frontend/types/engines.ts \
  frontend/lib/reference-budget.ts \
  frontend/app/\(core\)/\(workspace\)/app/AppClient.tsx \
  frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceAssetState.ts \
  frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceAssets.ts \
  frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceReferenceAssets.ts \
  frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceInputSchemaState.ts \
  frontend/app/\(core\)/\(workspace\)/app/_lib/workspace-assets.ts \
  frontend/app/\(core\)/\(workspace\)/app/_lib/workspace-generation-inputs.ts \
  frontend/app/api/generate/_lib/attachment-references.ts \
  frontend/app/api/generate/_lib/validation-payload.ts \
  frontend/app/api/generate/_lib/validate.ts \
  frontend/app/api/generate/_lib/validate-media-inputs.ts \
  frontend/app/api/generate/_lib/byteplus-submission.ts \
  frontend/app/api/generate/route.ts \
  frontend/src/server/video-providers/byteplus-modelark-payload.ts \
  tests/reference-budget.test.ts \
  tests/workspace-assets.test.ts \
  tests/workspace-assets-split-contract.test.ts \
  tests/workspace-input-schema-hook-contract.test.ts \
  tests/workspace-generation-inputs.test.ts \
  tests/generate-attachment-references.test.ts \
  tests/generate-validation-payload.test.ts \
  tests/validate-request.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts
git commit -m "test: complete reference budget verification"
```

If no correction was needed, do not create an empty commit.

- [ ] **Step 6: Inspect the final verified commit range**

```bash
REFERENCE_BUDGET_BASE_SHA="$(
  git rev-parse "$(
    git log --format=%H \
      --grep='^feat: define aggregate reference budgets$' \
      -n 1
  )^"
)"
git diff --check "$REFERENCE_BUDGET_BASE_SHA"..HEAD
git diff "$REFERENCE_BUDGET_BASE_SHA"..HEAD -- \
  frontend/types/engines.ts \
  frontend/lib/reference-budget.ts \
  frontend/app/\(core\)/\(workspace\)/app \
  frontend/app/api/generate \
  frontend/src/server/video-providers/byteplus-modelark-payload.ts \
  tests
```

Expected: the committed range is whitespace-clean and contains only the
verified optional budget contract, workspace enforcement, original-field API
provenance, and BytePlus payload defense.
