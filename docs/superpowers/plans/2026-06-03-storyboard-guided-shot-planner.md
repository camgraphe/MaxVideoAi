# Storyboard Guided Shot Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a deterministic live shot planner to the Storyboarder tool so users see a useful panel-by-panel plan before generating a storyboard image.

**Architecture:** Add a pure shot-plan helper under the storyboard tool library, feed it from `StoryboardWorkspace`, render it with a dedicated `StoryboardShotMap` component, and include it in the hidden GPT Image 2 prompt. Extract the result panel to keep `StoryboardWorkspace.tsx` from growing further.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node test runner with `tsx`, existing MaxVideoAI UI primitives, existing `AssetDropzone`, Browser plugin QA.

---

### Task 1: Shot Planner Helper

**Files:**
- Create: `frontend/src/components/tools/storyboard/_lib/storyboard-shot-plan.ts`
- Test: `tests/storyboard-shot-plan.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/storyboard-shot-plan.test.ts` with tests that import `buildStoryboardShotPlan` and assert:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStoryboardShotPlan } from '../frontend/src/components/tools/storyboard/_lib/storyboard-shot-plan.ts';

test('builds deterministic 4, 6, and 8 panel shot maps', () => {
  const four = buildStoryboardShotPlan({
    subject: 'Coffee bag',
    action: 'Reveal the packaging',
    style: 'cinema',
    targetModel: 'kling',
    durationSec: 6,
    frameCount: 4,
  });
  const six = buildStoryboardShotPlan({
    subject: 'Coffee bag',
    action: 'Reveal the packaging',
    style: 'cinema',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 6,
  });
  const eight = buildStoryboardShotPlan({
    subject: 'Coffee bag',
    action: 'Reveal the packaging',
    style: 'cinema',
    targetModel: 'kling',
    durationSec: 15,
    frameCount: 8,
  });

  assert.equal(four.shots.length, 4);
  assert.equal(six.shots.length, 6);
  assert.equal(eight.shots.length, 8);
  assert.match(four.shots[0].title, /Establishing/i);
  assert.match(four.shots[3].title, /End frame/i);
  assert.match(six.shots[2].title, /Main action/i);
  assert.match(eight.shots[4].title, /Secondary angle/i);
});

test('allocates dialogue across middle panels and keeps speaker labels', () => {
  const plan = buildStoryboardShotPlan({
    subject: 'Founder in a product demo',
    action: 'Show the product and react',
    dialogue: 'Founder: This is ready for launch.\\nCustomer: It feels premium.',
    style: 'ugc',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 6,
  });

  const dialogueBeats = plan.shots.map((shot) => shot.dialogueBeat).filter(Boolean);
  assert.equal(dialogueBeats.length, 2);
  assert.match(dialogueBeats[0] ?? '', /Founder:/);
  assert.match(dialogueBeats[1] ?? '', /Customer:/);
  assert.equal(plan.shots[0].dialogueBeat, undefined);
  assert.equal(plan.shots[5].dialogueBeat, undefined);
});

test('adds target, style, and reference guidance', () => {
  const plan = buildStoryboardShotPlan({
    subject: 'Animated cooking object',
    action: 'Pour sauce into a pan',
    style: 'anime',
    targetModel: 'seedance',
    durationSec: 10,
    frameCount: 6,
    referenceImageCount: 2,
  });

  assert.match(plan.summary, /Seedance/i);
  assert.match(plan.targetGuidance, /no real people/i);
  assert.match(plan.styleGuidance, /anime/i);
  assert.match(plan.referenceGuidance ?? '', /2 reference images/i);
  assert.match(plan.shots[3].visualPriority, /reference/i);
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-shot-plan.test.ts
```

Expected: FAIL because `storyboard-shot-plan.ts` does not exist.

- [x] **Step 3: Implement the pure helper**

Create `storyboard-shot-plan.ts` with exported types:

```ts
export type StoryboardShot = {
  id: string;
  panel: number;
  title: string;
  framing: string;
  actionBeat: string;
  visualPriority: string;
  dialogueBeat?: string;
};

export type StoryboardShotPlan = {
  summary: string;
  targetGuidance: string;
  styleGuidance: string;
  referenceGuidance?: string;
  shots: StoryboardShot[];
};
```

Implement deterministic mappings for 4/6/8 frames, style-specific phrasing, target-specific guidance, loose dialogue parsing, and reference guidance.

- [x] **Step 4: Run test to verify it passes**

Run the same test. Expected: PASS.

### Task 2: Prompt Builder Integration

**Files:**
- Modify: `frontend/src/components/tools/storyboard/_lib/storyboard-prompt.ts`
- Test: `tests/storyboard-tool-contract.test.ts`
- Test: `tests/storyboard-shot-plan.test.ts`

- [x] **Step 1: Write the failing contract updates**

Update `tests/storyboard-tool-contract.test.ts` to assert:

```ts
assert.match(workspaceSource, /buildStoryboardShotPlan/);
assert.match(workspaceSource, /StoryboardShotMap/);
assert.match(promptSource, /shotPlan/);
assert.match(promptSource, /Panel \\$\\{shot\\.panel\\}/);
```

Update `tests/storyboard-shot-plan.test.ts` or add a prompt-specific test importing `buildStoryboardPrompt` and passing a `shotPlan`; assert the prompt contains `Shot map:` and `Panel 1:`.

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts tests/storyboard-shot-plan.test.ts
```

Expected: FAIL because the prompt builder has no `shotPlan`.

- [x] **Step 3: Extend `buildStoryboardPrompt`**

Import `StoryboardShotPlan` as a type, add `shotPlan?: StoryboardShotPlan` to `StoryboardPromptInput`, and include hidden shot map guidance:

```ts
input.shotPlan ? 'Shot map:' : null,
...(input.shotPlan?.shots.map((shot) =>
  `Panel ${shot.panel}: ${shot.title}. Framing: ${shot.framing}. Beat: ${shot.actionBeat}. Visual priority: ${shot.visualPriority}${shot.dialogueBeat ? `. Dialogue beat: ${shot.dialogueBeat}` : ''}.`
) ?? []),
```

- [x] **Step 4: Run tests to verify pass**

Run the same focused tests. Expected: PASS.

### Task 3: Shot Map Component

**Files:**
- Create: `frontend/src/components/tools/storyboard/_components/StoryboardShotMap.tsx`
- Test: `tests/storyboard-tool-contract.test.ts`

- [x] **Step 1: Write failing contract checks**

Assert the component file exists and includes `shot.dialogueBeat`, `shot.visualPriority`, and `Panel`.

- [x] **Step 2: Run contract test to verify failure**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts
```

Expected: FAIL because the component file does not exist.

- [x] **Step 3: Implement component**

Create a small presentational component:

```tsx
type StoryboardShotMapProps = {
  title: string;
  emptyTitle: string;
  emptyBody: string;
  plan: StoryboardShotPlan;
};
```

Render a responsive grid of shot cards with panel number, title, framing, action beat, visual priority, and optional dialogue beat.

- [x] **Step 4: Run contract test to verify pass**

Run contract test. Expected: PASS.

### Task 4: Result Panel Extraction

**Files:**
- Create: `frontend/src/components/tools/storyboard/_components/StoryboardResultPanel.tsx`
- Modify: `frontend/src/components/tools/StoryboardWorkspace.tsx`
- Test: `tests/storyboard-tool-contract.test.ts`

- [x] **Step 1: Write failing contract checks**

Assert `StoryboardWorkspace.tsx` imports `StoryboardResultPanel` and no longer contains the large inline generated preview section marker `Generated storyboard` more than once.

- [x] **Step 2: Run contract test to verify failure**

Expected: FAIL before extraction.

- [x] **Step 3: Implement extraction**

Move the right-panel rendering into `StoryboardResultPanel.tsx`. Pass props for `copy`, `selectedImage`, `result`, `running`, `saving`, `saveLabel`, `editInstruction`, `onEditInstructionChange`, `onApplyEdit`, `onDownload`, and `onSave`.

- [x] **Step 4: Run contract test to verify pass**

Expected: PASS.

### Task 5: Workspace Integration

**Files:**
- Modify: `frontend/src/components/tools/StoryboardWorkspace.tsx`
- Modify: `frontend/src/components/tools/storyboard/_lib/storyboard-workspace-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Test: `tests/storyboard-tool-contract.test.ts`

- [x] **Step 1: Write failing contract checks**

Assert workspace computes `shotPlan = useMemo`, passes `shotPlan` to `buildStoryboardPrompt`, and renders `StoryboardShotMap` when no selected image exists.

- [x] **Step 2: Run contract test to verify failure**

Expected: FAIL before integration.

- [x] **Step 3: Integrate shot plan**

In `StoryboardWorkspace`, import `buildStoryboardShotPlan`, compute it from current form state and `readyReferenceImages.length`, pass it into `buildStoryboardPrompt`, and pass it into `StoryboardResultPanel`.

Add copy keys:

```ts
shotMapTitle: 'Shot map',
shotMapEmptyTitle: 'Storyboard preview',
shotMapEmptyBody: 'Fill the brief to preview the planned storyboard beats.',
```

Translate the same keys in EN/FR/ES.

- [x] **Step 4: Run focused tests**

Expected: PASS.

### Task 6: Full Verification and Browser QA

**Files:**
- No planned production edits unless verification reveals a bug.

- [x] **Step 1: Run full focused verification**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/storyboard-tool-contract.test.ts tests/storyboard-shot-plan.test.ts tests/gpt-image-2-pricing.test.ts tests/storyboard-library-category.test.ts
pnpm --prefix frontend exec tsc --noEmit
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: all pass.

- [x] **Step 2: Browser QA**

Use the Browser plugin on:

`http://localhost:3000/app/tools/storyboard?target=kling`

Verify:

- page identity is correct
- no framework overlay
- shot map appears before generation
- filling subject enables generate button
- filling dialogue shows dialogue beats in the visible shot map
- changing frames from 6 to 8 changes visible shot card count
- reference plus slot still renders
- no paid generation is triggered

- [x] **Step 3: Commit**

Commit the implementation:

```bash
git add frontend/src/components/tools frontend/messages tests docs/superpowers/plans/2026-06-03-storyboard-guided-shot-planner.md
git commit -m "Add guided storyboard shot planner"
```
