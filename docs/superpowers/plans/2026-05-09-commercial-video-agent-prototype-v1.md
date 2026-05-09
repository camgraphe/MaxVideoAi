# Commercial Video Agent Prototype V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first functional Commercial Video Agent prototype from user request to structured brief, feasibility check, confirmation summary, and visible Seedance 2.0 test prompt package, without image-reference support.

**Architecture:** Keep `/app/video-agents` as the first-class app family. Add a route-local agent pipeline with a global public chat layer, a commercial intake state machine, scenario builder, Seedance 2.0 prompt builder, reviewer, and visible prompt package inspector; do not call paid generation until a later task explicitly wires payment and provider submission. The prototype uses deterministic local logic first so the product flow, schema, tests, and UI states are stable before replacing internals with GPT/Agents SDK calls. Keep the orchestration LLM configurable (`gpt-5.4-mini` default) and model the future Seedream image-preparation stage without exposing it in V1.

**Tech Stack:** Next.js App Router, React client components, route-local TypeScript helpers, Node `test`, existing workspace shell/components, existing frontend lint/tsc/test commands.

---

## Scope

Included:

- Global public chat behavior that can explain the Video Agents offer.
- Commercial Video Agent intake with one focused missing-field question at a time.
- No image upload, no library image, no start image, no image-to-video mode.
- Structured `VideoAgentBrief` for text-to-video only.
- Prompt package output with Seedance settings, structured scenario, final prompt, avoid list, warnings, and reviewer checklist.
- Safety/feasibility gate before confirmation.
- UI states: public chat, intake, confirm, prompt-ready inspector.

Excluded:

- Actual Seedance provider call.
- Payment or wallet reservation.
- Product/reference image handling.
- Storyboard validation.
- Subtitles, voiceover, music, montage, multi-scene editing.

## File Structure

- Modify `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-config.ts`
  - Keep the preset engine metadata and force V1 `generationMode` to `t2v`.
- Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-brief.ts`
  - Own brief types, required field list, completeness helpers.
- Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-intake.ts`
  - Own deterministic intake extraction and next-question selection.
- Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-safety.ts`
  - Own unsupported-content checks and model limitation warnings.
- Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/commercial-video-scenario.ts`
  - Own category inference, duration-aware timeline beats, camera, lighting, composition, and final frame.
- Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/commercial-video-reviewer.ts`
  - Own reviewer checklist booleans for duration fit, Seedance fit, brand safety, CTA, and prompt clarity.
- Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/seedance-commercial-prompt.ts`
  - Own final Seedance prompt construction from the structured brief and scenario.
- Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/commercial-video-prompt-package.ts`
  - Own final V1 package assembly after user confirmation.
- Modify `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-state.ts`
  - Add flow phase and agent output types.
- Modify `frontend/app/(core)/(workspace)/app/video-agents/_hooks/useVideoAgentFlow.ts`
  - Replace the current mock replies with pipeline-driven state transitions.
- Modify `frontend/app/(core)/(workspace)/app/video-agents/_components/VideoAgentChat.tsx`
  - Render confirmation and prompt-ready CTAs from state without calling providers.
- Modify `frontend/app/(core)/(workspace)/app/video-agents/_components/VideoAgentPreview.tsx`
  - Show prototype status, settings, and final prompt instead of only the empty placeholder.
- Create `frontend/app/(core)/(workspace)/app/video-agents/_components/VideoAgentPromptPreview.tsx`
  - Own visible final prompt/settings display for manual Seedance testing.
- Modify `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-copy.ts`
  - Remove image reference copy from V1 and add confirmation/prototype labels.
- Modify `tests/video-agents-family-architecture.test.ts`
  - Keep architecture guardrails and add "no image in V1" expectations.
- Create `tests/video-agent-prototype-pipeline.test.ts`
  - Own behavior tests for intake, safety, prompt building, visible settings, and no-generation-before-confirmation.
- Create `docs/engineering/video-agents-workflow.md`
  - Document V1 workflow, LLM strategy, Seedance doctrine, and future Seedream image-preparation path.

---

## Task 1: Lock V1 Scope To Text-To-Video Only

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-config.ts`
- Modify: `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-copy.ts`
- Modify: `frontend/app/(core)/(workspace)/app/video-agents/_components/VideoAgentChat.tsx`
- Test: `tests/video-agents-family-architecture.test.ts`

- [ ] **Step 1: Write the failing architecture test**

Add this test to `tests/video-agents-family-architecture.test.ts`:

```ts
test('video agents V1 does not expose image reference inputs', () => {
  const configSource = readFileSync(configPath, 'utf8');
  const chatSource = readFileSync(chatPath, 'utf8');

  assert.match(configSource, /generationMode:\s*'t2v'/, 'V1 should force text-to-video mode');
  assert.doesNotMatch(chatSource, /Add product image/, 'V1 prototype should not expose product image upload');
  assert.doesNotMatch(chatSource, /ImageIcon/, 'V1 prototype should not render image upload icons');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agents-family-architecture.test.ts
```

Expected: FAIL because the current chat renders `Add product image` and config does not expose a fixed `generationMode`.

- [ ] **Step 3: Update config and copy**

In `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-config.ts`, add `generationMode` to `VideoAgentPreset` and the Seedance preset:

```ts
export type VideoAgentGenerationMode = 't2v';

export type VideoAgentPreset = {
  id: string;
  label: string;
  shortLabel: string;
  agentType: VideoAgentType;
  engineFamily: VideoAgentEngineFamily;
  engineId: string;
  engineLabel: string;
  generationMode: VideoAgentGenerationMode;
  maxDurationSec: number;
};

export const VIDEO_AGENT_PRESETS: VideoAgentPreset[] = [
  {
    id: 'commercial-seedance-2',
    label: 'Commercial Video Agent',
    shortLabel: 'Commercial',
    agentType: 'commercial-video',
    engineFamily: 'seedance',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    generationMode: 't2v',
    maxDurationSec: 15,
  },
];
```

In `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-copy.ts`, remove `productImage` and add:

```ts
prototype: {
  noImageNote: 'Text-to-video prototype. Product images will come later.',
}
```

- [ ] **Step 4: Remove the image affordance from chat**

In `frontend/app/(core)/(workspace)/app/video-agents/_components/VideoAgentChat.tsx`:

```tsx
import { FormEvent, useEffect, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';
```

Remove the dashed `Add product image` button entirely. Keep the input form and quick chips.

- [ ] **Step 5: Verify task tests pass**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agents-family-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/video-agents tests/video-agents-family-architecture.test.ts
git commit -m "Constrain video agent prototype to text prompts"
```

---

## Task 2: Add Structured Brief Schema

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-brief.ts`
- Test: `tests/video-agent-prototype-pipeline.test.ts`

- [ ] **Step 1: Write failing brief tests**

Create `tests/video-agent-prototype-pipeline.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REQUIRED_COMMERCIAL_BRIEF_FIELDS,
  getMissingCommercialBriefFields,
  isCommercialBriefComplete,
  type CommercialVideoAgentBrief,
} from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-brief';

test('commercial brief requires the first prototype fields', () => {
  assert.deepEqual(REQUIRED_COMMERCIAL_BRIEF_FIELDS, [
    'product',
    'scene',
    'style',
    'audience',
    'cta',
  ]);
});

test('commercial brief reports missing fields in question order', () => {
  const partial: CommercialVideoAgentBrief = {
    product: 'black connected watch',
    scene: '',
    style: 'premium studio',
    audience: '',
    cta: 'buy now',
    mustInclude: [],
    avoid: [],
  };

  assert.deepEqual(getMissingCommercialBriefFields(partial), ['scene', 'audience']);
  assert.equal(isCommercialBriefComplete(partial), false);
});

test('commercial brief is complete when required text fields are present', () => {
  const complete: CommercialVideoAgentBrief = {
    product: 'black connected watch',
    scene: 'minimal studio',
    style: 'premium product reveal',
    audience: 'urban professionals',
    cta: 'buy now',
    mustInclude: ['close-up on screen'],
    avoid: ['tiny readable text'],
  };

  assert.equal(isCommercialBriefComplete(complete), true);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agent-prototype-pipeline.test.ts
```

Expected: FAIL because `video-agent-brief.ts` does not exist.

- [ ] **Step 3: Implement the brief module**

Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-brief.ts`:

```ts
export type CommercialVideoAgentBriefField = 'product' | 'scene' | 'style' | 'audience' | 'cta';

export type CommercialVideoAgentBrief = Record<CommercialVideoAgentBriefField, string> & {
  mustInclude: string[];
  avoid: string[];
};

export const REQUIRED_COMMERCIAL_BRIEF_FIELDS: CommercialVideoAgentBriefField[] = [
  'product',
  'scene',
  'style',
  'audience',
  'cta',
];

export const EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF: CommercialVideoAgentBrief = {
  product: '',
  scene: '',
  style: '',
  audience: '',
  cta: '',
  mustInclude: [],
  avoid: [],
};

function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

export function getMissingCommercialBriefFields(
  brief: CommercialVideoAgentBrief
): CommercialVideoAgentBriefField[] {
  return REQUIRED_COMMERCIAL_BRIEF_FIELDS.filter((field) => !hasValue(brief[field]));
}

export function isCommercialBriefComplete(brief: CommercialVideoAgentBrief): boolean {
  return getMissingCommercialBriefFields(brief).length === 0;
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agent-prototype-pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-brief.ts tests/video-agent-prototype-pipeline.test.ts
git commit -m "Add commercial video agent brief schema"
```

---

## Task 3: Add Deterministic Intake Engine

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-intake.ts`
- Modify: `tests/video-agent-prototype-pipeline.test.ts`

- [ ] **Step 1: Add failing intake tests**

Append to `tests/video-agent-prototype-pipeline.test.ts`:

```ts
import {
  askNextCommercialBriefQuestion,
  applyCommercialIntakeMessage,
} from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-intake';

test('commercial intake extracts labeled user fields', () => {
  const next = applyCommercialIntakeMessage(EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF, [
    'Product: black connected watch',
    'Scene: minimal studio with soft reflections',
    'Style: premium cinematic product reveal',
    'Audience: urban professionals',
    'CTA: buy now',
    'Include: close-up on the screen',
    'Avoid: tiny readable text',
  ].join('\\n'));

  assert.equal(next.product, 'black connected watch');
  assert.equal(next.scene, 'minimal studio with soft reflections');
  assert.equal(next.style, 'premium cinematic product reveal');
  assert.equal(next.audience, 'urban professionals');
  assert.equal(next.cta, 'buy now');
  assert.deepEqual(next.mustInclude, ['close-up on the screen']);
  assert.deepEqual(next.avoid, ['tiny readable text']);
});

test('commercial intake asks only the next missing question', () => {
  const brief = {
    ...EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    product: 'black connected watch',
  };

  assert.equal(
    askNextCommercialBriefQuestion(brief),
    'Where should the scene take place?'
  );
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agent-prototype-pipeline.test.ts
```

Expected: FAIL because `video-agent-intake.ts` does not exist.

- [ ] **Step 3: Implement intake parsing**

Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-intake.ts`:

```ts
import {
  getMissingCommercialBriefFields,
  type CommercialVideoAgentBrief,
  type CommercialVideoAgentBriefField,
} from './video-agent-brief';

const FIELD_LABELS: Record<CommercialVideoAgentBriefField, RegExp> = {
  product: /^(product|produit|offer|offre)\\s*:\\s*(.+)$/i,
  scene: /^(scene|lieu|location|place)\\s*:\\s*(.+)$/i,
  style: /^(style|look|mood)\\s*:\\s*(.+)$/i,
  audience: /^(audience|target|cible)\\s*:\\s*(.+)$/i,
  cta: /^(cta|call to action|appel à l'action)\\s*:\\s*(.+)$/i,
};

const QUESTION_BY_FIELD: Record<CommercialVideoAgentBriefField, string> = {
  product: 'What product or offer should the video promote?',
  scene: 'Where should the scene take place?',
  style: 'What visual style should the commercial use?',
  audience: 'Who is the target audience?',
  cta: 'What call to action should the video end with?',
};

function parseListLine(line: string, label: 'include' | 'avoid'): string | null {
  const pattern =
    label === 'include'
      ? /^(include|must include|inclure)\\s*:\\s*(.+)$/i
      : /^(avoid|exclude|éviter|eviter)\\s*:\\s*(.+)$/i;
  const match = line.match(pattern);
  return match?.[2]?.trim() || null;
}

export function applyCommercialIntakeMessage(
  current: CommercialVideoAgentBrief,
  message: string
): CommercialVideoAgentBrief {
  const next: CommercialVideoAgentBrief = {
    ...current,
    mustInclude: [...current.mustInclude],
    avoid: [...current.avoid],
  };

  for (const rawLine of message.split('\\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    for (const [field, pattern] of Object.entries(FIELD_LABELS) as Array<
      [CommercialVideoAgentBriefField, RegExp]
    >) {
      const match = line.match(pattern);
      if (match?.[2]) {
        next[field] = match[2].trim();
      }
    }

    const include = parseListLine(line, 'include');
    if (include) next.mustInclude.push(include);

    const avoid = parseListLine(line, 'avoid');
    if (avoid) next.avoid.push(avoid);
  }

  if (!next.product && message.trim() && !message.includes(':')) {
    next.product = message.trim();
  }

  return next;
}

export function askNextCommercialBriefQuestion(brief: CommercialVideoAgentBrief): string | null {
  const [field] = getMissingCommercialBriefFields(brief);
  return field ? QUESTION_BY_FIELD[field] : null;
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agent-prototype-pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-intake.ts tests/video-agent-prototype-pipeline.test.ts
git commit -m "Add commercial video agent intake engine"
```

---

## Task 4: Add Safety And Feasibility Gate

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-safety.ts`
- Modify: `tests/video-agent-prototype-pipeline.test.ts`

- [ ] **Step 1: Add failing safety tests**

Append:

```ts
import {
  reviewCommercialVideoRequest,
} from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-safety';

test('safety blocks explicit sexual requests before confirmation', () => {
  const result = reviewCommercialVideoRequest({
    ...EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    product: 'perfume',
    scene: 'bedroom',
    style: 'nude explicit commercial',
    audience: 'adults',
    cta: 'buy now',
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'explicit-sexual-content');
});

test('safety warns for exact logo or readable text requests', () => {
  const result = reviewCommercialVideoRequest({
    ...EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    product: 'coffee cup with exact logo text',
    scene: 'kitchen counter',
    style: 'realistic ad',
    audience: 'coffee lovers',
    cta: 'read the label',
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.warnings, [
    'Exact logos and readable text may vary in generated video.',
  ]);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agent-prototype-pipeline.test.ts
```

Expected: FAIL because `video-agent-safety.ts` does not exist.

- [ ] **Step 3: Implement safety review**

Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-safety.ts`:

```ts
import type { CommercialVideoAgentBrief } from './video-agent-brief';

export type CommercialVideoSafetyReason =
  | 'explicit-sexual-content'
  | 'hate-or-harassment'
  | 'graphic-violence'
  | 'misleading-regulated-claim';

export type CommercialVideoSafetyReview =
  | { allowed: false; reason: CommercialVideoSafetyReason; warnings: string[] }
  | { allowed: true; reason: null; warnings: string[] };

function briefText(brief: CommercialVideoAgentBrief): string {
  return [
    brief.product,
    brief.scene,
    brief.style,
    brief.audience,
    brief.cta,
    ...brief.mustInclude,
    ...brief.avoid,
  ]
    .join(' ')
    .toLowerCase();
}

export function reviewCommercialVideoRequest(
  brief: CommercialVideoAgentBrief
): CommercialVideoSafetyReview {
  const text = briefText(brief);
  const warnings: string[] = [];

  if (/\\b(nude|nudity|explicit sex|porn|sexual explicit)\\b/.test(text)) {
    return { allowed: false, reason: 'explicit-sexual-content', warnings };
  }
  if (/\\b(hate|racial slur|harass)\\b/.test(text)) {
    return { allowed: false, reason: 'hate-or-harassment', warnings };
  }
  if (/\\b(gore|graphic violence|blood splatter)\\b/.test(text)) {
    return { allowed: false, reason: 'graphic-violence', warnings };
  }
  if (/\\b(cure cancer|guaranteed profit|legal advice)\\b/.test(text)) {
    return { allowed: false, reason: 'misleading-regulated-claim', warnings };
  }
  if (/\\b(exact logo|logo text|readable text|read the label|small text)\\b/.test(text)) {
    warnings.push('Exact logos and readable text may vary in generated video.');
  }

  return { allowed: true, reason: null, warnings };
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agent-prototype-pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-safety.ts tests/video-agent-prototype-pipeline.test.ts
git commit -m "Add commercial video agent safety review"
```

---

## Task 5: Build Final Seedance Test Prompt

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/video-agents/_lib/seedance-commercial-prompt.ts`
- Modify: `tests/video-agent-prototype-pipeline.test.ts`

- [ ] **Step 1: Add failing prompt builder test**

Append:

```ts
import {
  buildSeedanceCommercialPrompt,
} from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/seedance-commercial-prompt';

test('Seedance prompt builder creates a structured final prompt', () => {
  const prompt = buildSeedanceCommercialPrompt(
    {
      product: 'black connected watch',
      scene: 'minimal studio with soft reflections',
      style: 'premium cinematic product reveal',
      audience: 'urban professionals',
      cta: 'buy now',
      mustInclude: ['close-up on the screen'],
      avoid: ['tiny readable text'],
    },
    {
      durationSec: 10,
      aspectRatio: '9:16',
      resolution: '1080p',
      audioEnabled: true,
    }
  );

  assert.match(prompt, /Seedance 2\\.0 commercial video/);
  assert.match(prompt, /black connected watch/);
  assert.match(prompt, /minimal studio with soft reflections/);
  assert.match(prompt, /9:16 vertical composition/);
  assert.match(prompt, /Duration: 10 seconds/);
  assert.match(prompt, /Avoid: tiny readable text/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agent-prototype-pipeline.test.ts
```

Expected: FAIL because `seedance-commercial-prompt.ts` does not exist.

- [ ] **Step 3: Implement prompt builder**

Create `frontend/app/(core)/(workspace)/app/video-agents/_lib/seedance-commercial-prompt.ts`:

```ts
import type { VideoAgentSettings } from './video-agent-config';
import type { CommercialVideoAgentBrief } from './video-agent-brief';

function aspectLanguage(aspectRatio: VideoAgentSettings['aspectRatio']): string {
  if (aspectRatio === '9:16') return '9:16 vertical composition';
  if (aspectRatio === '16:9') return '16:9 widescreen composition';
  return '1:1 square composition';
}

function listOrFallback(items: string[], fallback: string): string {
  return items.length ? items.join(', ') : fallback;
}

export function buildSeedanceCommercialPrompt(
  brief: CommercialVideoAgentBrief,
  settings: VideoAgentSettings
): string {
  return [
    'Seedance 2.0 commercial video.',
    `Product or offer: ${brief.product}.`,
    `Scene: ${brief.scene}.`,
    `Visual style: ${brief.style}.`,
    `Target audience: ${brief.audience}.`,
    `Call to action: ${brief.cta}.`,
    `Composition: ${aspectLanguage(settings.aspectRatio)}.`,
    `Duration: ${settings.durationSec} seconds.`,
    `Resolution target: ${settings.resolution}.`,
    `Audio: ${settings.audioEnabled ? 'include natural commercial audio atmosphere' : 'silent video'}.`,
    `Must include: ${listOrFallback(brief.mustInclude, 'clear product focus, premium reveal, polished camera movement')}.`,
    `Avoid: ${listOrFallback(brief.avoid, 'distorted hands, unreadable small text, visual clutter, off-brand mood')}.`,
    'Use smooth cinematic movement, coherent product presentation, and a clear final product moment.',
  ].join('\\n');
}
```

- [ ] **Step 4: Verify tests pass**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agent-prototype-pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/video-agents/_lib/seedance-commercial-prompt.ts tests/video-agent-prototype-pipeline.test.ts
git commit -m "Add Seedance commercial prompt builder"
```

---

## Task 6: Wire Prototype Flow Into Chat

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-state.ts`
- Modify: `frontend/app/(core)/(workspace)/app/video-agents/_hooks/useVideoAgentFlow.ts`
- Modify: `frontend/app/(core)/(workspace)/app/video-agents/_components/VideoAgentChat.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/video-agents/_components/VideoAgentPreview.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-copy.ts`
- Test: `tests/video-agents-family-architecture.test.ts`

- [ ] **Step 1: Add flow architecture expectations**

Add to `tests/video-agents-family-architecture.test.ts`:

```ts
test('video agent flow uses the route-local prototype pipeline', () => {
  const flowSource = readFileSync(join(videoAgentsDir, '_hooks/useVideoAgentFlow.ts'), 'utf8');

  assert.match(flowSource, /applyCommercialIntakeMessage/, 'flow should parse user intake into a brief');
  assert.match(flowSource, /reviewCommercialVideoRequest/, 'flow should run safety before confirmation');
  assert.match(flowSource, /confirmPrototype[\\s\\S]*buildSeedanceCommercialPrompt/, 'flow should build the final Seedance test prompt only after confirmation');
  assert.doesNotMatch(flowSource, /fetch\\(/, 'prototype should not call provider APIs yet');
});
```

- [ ] **Step 2: Run architecture test and verify failure**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agents-family-architecture.test.ts
```

Expected: FAIL because `useVideoAgentFlow.ts` still uses mock replies.

- [ ] **Step 3: Extend state types**

In `frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-state.ts`, add:

```ts
export type VideoAgentFlowPhase = 'public' | 'intake' | 'blocked' | 'confirm' | 'prompt-ready';

export type VideoAgentPromptSettingsSnapshot = {
  engineLabel: string;
  generationMode: 't2v';
  durationSec: number;
  aspectRatio: string;
  resolution: string;
  audioEnabled: boolean;
  estimatedPriceCents: number;
};

export type VideoAgentConfirmation = {
  summary: string;
  settings: VideoAgentPromptSettingsSnapshot;
  warnings: string[];
};

export type VideoAgentPrototypeResult = VideoAgentConfirmation & {
  finalPrompt: string;
};
```

- [ ] **Step 4: Update hook to use pipeline**

In `frontend/app/(core)/(workspace)/app/video-agents/_hooks/useVideoAgentFlow.ts`, import the new helpers. Keep the final prompt builder behind the explicit confirmation action so the prototype does not run the agent sequence before the user says yes:

```ts
import {
  EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
  isCommercialBriefComplete,
  type CommercialVideoAgentBrief,
} from '../_lib/video-agent-brief';
import {
  applyCommercialIntakeMessage,
  askNextCommercialBriefQuestion,
} from '../_lib/video-agent-intake';
import { reviewCommercialVideoRequest } from '../_lib/video-agent-safety';
import { buildSeedanceCommercialPrompt } from '../_lib/seedance-commercial-prompt';
import type {
  VideoAgentConfirmation,
  VideoAgentFlowPhase,
  VideoAgentPrototypeResult,
} from '../_lib/video-agent-state';
```

Use these state values:

```ts
const [phase, setPhase] = useState<VideoAgentFlowPhase>('public');
const [brief, setBrief] = useState<CommercialVideoAgentBrief>(EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF);
const [confirmation, setConfirmation] = useState<VideoAgentConfirmation | null>(null);
const [prototypeResult, setPrototypeResult] = useState<VideoAgentPrototypeResult | null>(null);
```

When sending a message:

```ts
const nextBrief = applyCommercialIntakeMessage(brief, text);
const nextQuestion = askNextCommercialBriefQuestion(nextBrief);
setBrief(nextBrief);

if (nextQuestion) {
  setPhase('intake');
  assistantReply = nextQuestion;
} else {
  const review = reviewCommercialVideoRequest(nextBrief);
  if (!review.allowed) {
    setPhase('blocked');
    assistantReply = 'I cannot generate that request. Please rewrite it without unsupported content.';
  } else {
    setPhase('confirm');
    setConfirmation({
      settings: {
        engineLabel: preset.engineLabel,
        generationMode: preset.generationMode,
        durationSec: settings.durationSec,
        aspectRatio: settings.aspectRatio,
        resolution: settings.resolution,
        audioEnabled: settings.audioEnabled,
        estimatedPriceCents: estimatedPriceCents,
      },
      warnings: review.warnings,
      summary: `One ${preset.engineLabel} commercial video, ${settings.durationSec}s, ${settings.aspectRatio}, ${settings.resolution}, audio ${settings.audioEnabled ? 'on' : 'off'}.`,
    });
    assistantReply = [
      'I have enough to prepare the commercial video.',
      `Summary: one ${preset.engineLabel} video, ${settings.durationSec}s, ${settings.aspectRatio}, ${settings.resolution}.`,
      review.warnings.length ? `Note: ${review.warnings.join(' ')}` : '',
      'Say yes with the button and I will prepare the final Seedance prompt and settings for manual testing.',
    ].filter(Boolean).join('\\n');
  }
}
```

Return `phase`, `brief`, `confirmation`, `prototypeResult`, and a `confirmPrototype` action:

```ts
const confirmPrototype = useCallback(() => {
  if (!confirmation || !isCommercialBriefComplete(brief)) return;
  const finalPrompt = buildSeedanceCommercialPrompt(brief, settings);
  setPrototypeResult({
    ...confirmation,
    finalPrompt,
  });
  setPhase('prompt-ready');
  setMessages((current) => [
    ...current,
    createVideoAgentMessage('assistant', 'Prompt package ready. Copy the final prompt and settings to test manually; provider generation and payment will be wired in the next version.'),
  ]);
}, [brief, confirmation, settings]);
```

- [ ] **Step 5: Render confirmation controls and prompt package CTA**

In `VideoAgentChat.tsx`, add props:

```ts
phase: VideoAgentFlowPhase;
confirmation: VideoAgentConfirmation | null;
prototypeResult: VideoAgentPrototypeResult | null;
onConfirmPrototype: () => void;
```

Render a CTA above the input only when `phase === 'confirm'`:

```tsx
{phase === 'confirm' && confirmation ? (
  <div className="mb-3 rounded-[8px] border border-border bg-bg p-3">
    <p className="text-sm font-semibold text-text-primary">{confirmation.summary}</p>
    <button
      type="button"
      className="mt-3 inline-flex h-10 items-center justify-center rounded-[8px] bg-text-primary px-4 text-sm font-semibold text-bg"
      onClick={onConfirmPrototype}
    >
      Prepare test prompt
    </button>
  </div>
) : null}
```

- [ ] **Step 6: Render preview prototype status and visible prompt package**

Create `frontend/app/(core)/(workspace)/app/video-agents/_components/VideoAgentPromptPreview.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { VideoAgentPrototypeResult } from '../_lib/video-agent-state';

type VideoAgentPromptPreviewProps = {
  result: VideoAgentPrototypeResult;
};

export function VideoAgentPromptPreview({ result }: VideoAgentPromptPreviewProps) {
  const [copied, setCopied] = useState(false);
  const rows = [
    ['Engine', result.settings.engineLabel],
    ['Mode', result.settings.generationMode],
    ['Duration', `${result.settings.durationSec}s`],
    ['Format', result.settings.aspectRatio],
    ['Resolution', result.settings.resolution],
    ['Audio', result.settings.audioEnabled ? 'on' : 'off'],
    ['Estimated price', `$${(result.settings.estimatedPriceCents / 100).toFixed(2)}`],
  ];

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(result.finalPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="w-full max-w-[520px] rounded-[8px] border border-border bg-bg p-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">Final Seedance prompt</p>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border px-3 text-xs font-medium text-text-primary"
          onClick={copyPrompt}
        >
          <Copy className="size-4" aria-hidden="true" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-[6px] border border-border/70 bg-surface p-2">
            <dt>{label}</dt>
            <dd className="mt-1 font-medium text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <pre className="mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[8px] border border-border bg-surface p-3 text-xs leading-5 text-text-primary">
        {result.finalPrompt}
      </pre>
    </div>
  );
}
```

In `VideoAgentPreview.tsx`, accept `phase`, `confirmation`, and `prototypeResult`. Under the placeholder text, render:

```tsx
{phase === 'confirm' && confirmation ? (
  <p className="mt-3 max-w-[240px] text-xs leading-5 text-text-muted">
    Brief complete. The final prompt package is ready to prepare.
  </p>
) : null}
{phase === 'prompt-ready' && prototypeResult ? (
  <VideoAgentPromptPreview result={prototypeResult} />
) : null}
```

- [ ] **Step 7: Verify tests pass**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-agents-family-architecture.test.ts tests/video-agent-prototype-pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/(core)/(workspace)/app/video-agents tests/video-agents-family-architecture.test.ts
git commit -m "Wire commercial video agent prototype flow"
```

---

## Task 7: Browser QA And Final Verification

**Files:**
- No source files unless QA finds a concrete issue.

- [ ] **Step 1: Start local server**

Run:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key pnpm --dir frontend exec next dev -p 3001
```

Expected: server starts on `http://localhost:3001`.

- [ ] **Step 2: Open prototype page**

Open:

```text
http://localhost:3001/app/video-agents
```

Expected:

- Page title is `Video Agents - MaxVideoAI Workspace — MaxVideoAI`.
- Sidebar highlights `Video Agents`.
- Chat starts with the public agent message.
- No image upload button appears.

- [ ] **Step 3: Exercise complete intake**

Send this message:

```text
Product: black connected watch
Scene: minimal studio with soft reflections
Style: premium cinematic product reveal
Audience: urban professionals
CTA: buy now
Include: close-up on the screen
Avoid: tiny readable text
```

Expected:

- Chat displays a summary.
- Confirmation CTA appears.
- Final prompt is not generated until the user confirms.
- Preview says the final prompt package is ready to prepare.

- [ ] **Step 4: Confirm prototype**

Click:

```text
Prepare test prompt
```

Expected:

- Chat says the prompt package is ready for manual testing.
- Preview shows the final Seedance prompt.
- Preview shows the settings: Seedance 2.0, `t2v`, duration, aspect ratio, resolution, audio, and estimated price.
- No network request to `/api/generate` is made by this prototype flow.

- [ ] **Step 5: Run full verification**

Run:

```bash
pnpm run test:validate
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend run i18n:check
```

Expected:

- All tests pass.
- TypeScript exits `0`.
- ESLint exits `0`.
- Public exposure check passes.
- i18n parity passes.

- [ ] **Step 6: Commit QA-only fixes if needed**

If QA required source fixes:

```bash
git add frontend/app/(core)/(workspace)/app/video-agents tests/video-agent-prototype-pipeline.test.ts tests/video-agents-family-architecture.test.ts
git commit -m "Polish commercial video agent prototype"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan implements the first prototype flow from request to visible prompt package, keeps Video Agents as a first-class app family, preserves Seedance 2.0 configuration, records the `gpt-5.4-mini` orchestration default, models future Seedream image preparation, and removes image-reference support from V1 UI.
- Scope check: Actual provider generation, payment, images, subtitles, voice, music, and storyboard remain out of scope.
- Placeholder scan: No task uses placeholder markers. Each code task includes file paths, commands, and expected outcomes.
- Type consistency: `CommercialVideoAgentBrief`, `CommercialVideoScenario`, `CommercialVideoPromptPackage`, `VideoAgentFlowPhase`, `VideoAgentPrototypeResult`, and `VideoAgentSettings` are defined before later tasks depend on them.
