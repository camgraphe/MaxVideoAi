# AI Strategist Continuous Evaluation Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an English-first continuous evaluation and improvement loop for the MaxVideoAI AI Strategist so Codex can run simulated real-life conversations, find failures, fix the highest-impact issue, test, commit, and repeat.

**Architecture:** Keep the existing deterministic strategist pipeline as the system under test. Add a larger English-first scenario generator, a judge/reporting layer, and a loop runner that repeatedly runs evaluations and produces actionable failure clusters. The loop does not auto-edit source code by itself; Codex uses the report to make targeted fixes, run tests, commit, then continue.

**Tech Stack:** TypeScript, `tsx`, Node test runner, existing `frontend/lib/ai-strategist/*`, existing Vertex local LLM adapter when enabled, deterministic fallback when LLM/env is unavailable.

---

## Operating Principle

The strategist should be tested like real users arrive on the site, not like ideal prompt engineers.

Default target mix:

- 70% English user conversations.
- 15% messy English: typos, vague messages, half-sentences, slang.
- 10% multilingual: French, Spanish, mixed language.
- 5% safety/catalog/edge cases: uploaded assets, real people, logos, price, credits, unsupported claims.

The final creative prompts should remain English unless the user explicitly asks otherwise, but conversational answers can follow the user language when useful.

## Files

- Create: `docs/ai-strategist/evals/scenario-seeds.json`
  - Source seed bank for realistic user personas, goals, starting messages, and follow-up patterns.
- Create: `docs/ai-strategist/evals/continuous-loop-policy.md`
  - Human-readable scoring policy and stop criteria.
- Create: `scripts/generate-ai-strategist-scenarios.ts`
  - Expands seeds into versioned eval scenarios.
- Create: `scripts/judge-ai-strategist-conversations.ts`
  - Scores transcripts with deterministic checks and optional local Vertex judge.
- Create: `scripts/run-ai-strategist-improvement-loop.ts`
  - Runs scenario generation, deterministic eval, optional judge, writes reports, and exits with useful failure codes.
- Modify: `scripts/evaluate-ai-strategist-conversations.ts`
  - Add report fields needed by the loop: owner, route state, selected model, warnings, funnel stage, language.
- Modify: `tests/ai-strategist-playground.test.ts`
  - Add contract tests for the new generator and report format.
- Create: `tests/ai-strategist-continuous-eval-loop.test.ts`
  - Unit tests for scenario generation, quality scoring, clustering, and stop criteria.

## Command Target

After implementation, the command to run a long local improvement pass should be:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/run-ai-strategist-improvement-loop.ts \
  --iterations 20 \
  --batch-size 80 \
  --english-first \
  --write-reports \
  --stop-after-clean-runs 3
```

Optional live judge mode:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/run-ai-strategist-improvement-loop.ts \
  --iterations 20 \
  --batch-size 80 \
  --english-first \
  --live-judge \
  --write-reports \
  --stop-after-clean-runs 3
```

The loop must never run generation, spend credits, publish, or apply generator UI actions.

---

### Task 1: Add English-First Scenario Seed Bank

**Files:**
- Create: `docs/ai-strategist/evals/scenario-seeds.json`
- Test: `tests/ai-strategist-continuous-eval-loop.test.ts`

- [x] **Step 1: Write the failing test**

Add this test to `tests/ai-strategist-continuous-eval-loop.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('AI Strategist scenario seeds are English-first and cover real-life client behavior', () => {
  const fixture = JSON.parse(readFileSync('docs/ai-strategist/evals/scenario-seeds.json', 'utf8')) as {
    version: number;
    seeds: Array<{
      id: string;
      language: string;
      persona: string;
      category: string;
      turns: string[];
      expected: {
        primaryTask: string;
        shouldRecommend?: boolean;
        shouldAskClarification?: boolean;
        shouldAnswerHelp?: boolean;
        shouldPreserveContext?: boolean;
      };
    }>;
  };

  assert.equal(fixture.version, 1);
  assert.ok(fixture.seeds.length >= 60, 'seed bank should be large enough to simulate real traffic');

  const englishCount = fixture.seeds.filter((seed) => seed.language === 'en').length;
  assert.ok(englishCount / fixture.seeds.length >= 0.7, 'seed bank must be English-first');

  const categories = new Set(fixture.seeds.map((seed) => seed.category));
  for (const category of [
    'greeting',
    'new_brief',
    'model_advice',
    'pricing',
    'examples',
    'workflow_help',
    'prompt_improvement',
    'asset_reference',
    'state_follow_up',
    'messy_input',
  ]) {
    assert.ok(categories.has(category), `missing category: ${category}`);
  }
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-continuous-eval-loop.test.ts
```

Expected: FAIL because `scenario-seeds.json` does not exist.

- [x] **Step 3: Create the seed bank**

Create `docs/ai-strategist/evals/scenario-seeds.json` with at least 60 seeds. Include realistic examples like:

```json
{
  "version": 1,
  "description": "English-first realistic conversation seeds for the MaxVideoAI AI Strategist.",
  "seeds": [
    {
      "id": "en-greeting-001",
      "language": "en",
      "persona": "new visitor",
      "category": "greeting",
      "turns": ["hi", "what can you help me with?"],
      "expected": {
        "primaryTask": "capability_help",
        "shouldAnswerHelp": true
      }
    },
    {
      "id": "en-product-ad-001",
      "language": "en",
      "persona": "ecommerce marketer",
      "category": "new_brief",
      "turns": ["I need a premium product ad for a glass skincare bottle", "choose for me"],
      "expected": {
        "primaryTask": "new_video_brief",
        "shouldRecommend": true,
        "shouldPreserveContext": true
      }
    },
    {
      "id": "en-messy-001",
      "language": "en",
      "persona": "impatient creator",
      "category": "messy_input",
      "turns": ["need quick tiktok shoe vid, cheap, make it pop", "ok value"],
      "expected": {
        "primaryTask": "new_video_brief",
        "shouldRecommend": true,
        "shouldPreserveContext": true
      }
    },
    {
      "id": "en-pricing-001",
      "language": "en",
      "persona": "budget-conscious user",
      "category": "pricing",
      "turns": ["what is the cheapest model on the site?"],
      "expected": {
        "primaryTask": "pricing_help",
        "shouldAnswerHelp": true
      }
    }
  ]
}
```

The final file must not stop at four seeds; add the full 60+ set across the listed categories.

- [x] **Step 4: Run test to verify it passes**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-continuous-eval-loop.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add docs/ai-strategist/evals/scenario-seeds.json tests/ai-strategist-continuous-eval-loop.test.ts
git commit -m "test: add strategist continuous eval seed bank"
```

---

### Task 2: Generate Versioned Conversation Scenarios From Seeds

**Files:**
- Create: `scripts/generate-ai-strategist-scenarios.ts`
- Modify: `tests/ai-strategist-continuous-eval-loop.test.ts`

- [x] **Step 1: Write the failing test**

Add:

```ts
import { generateStrategistScenariosFromSeeds } from '../scripts/generate-ai-strategist-scenarios.ts';

test('scenario generator creates runnable English-first eval scenarios', () => {
  const generated = generateStrategistScenariosFromSeeds({
    seedPath: 'docs/ai-strategist/evals/scenario-seeds.json',
    batchSize: 40,
    englishFirst: true,
  });

  assert.equal(generated.version, 1);
  assert.ok(generated.scenarios.length === 40);
  assert.ok(generated.scenarios.every((scenario) => scenario.turns.length >= 1));

  const englishCount = generated.scenarios.filter((scenario) => scenario.id.includes('en-')).length;
  assert.ok(englishCount / generated.scenarios.length >= 0.7);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-continuous-eval-loop.test.ts
```

Expected: FAIL because the generator does not exist.

- [x] **Step 3: Implement the generator**

Create `scripts/generate-ai-strategist-scenarios.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Seed = {
  id: string;
  language: string;
  persona: string;
  category: string;
  turns: string[];
  expected: {
    primaryTask: string;
    shouldRecommend?: boolean;
    shouldAskClarification?: boolean;
    shouldAnswerHelp?: boolean;
    shouldPreserveContext?: boolean;
  };
};

type SeedFixture = {
  version: 1;
  seeds: Seed[];
};

type GeneratedScenario = {
  id: string;
  label: string;
  category: string;
  turns: Array<{
    label: string;
    userMessage: string;
    expect: Record<string, unknown>;
  }>;
};

export function generateStrategistScenariosFromSeeds(input: {
  seedPath: string;
  batchSize: number;
  englishFirst: boolean;
}) {
  const fixture = JSON.parse(readFileSync(input.seedPath, 'utf8')) as SeedFixture;
  const ordered = input.englishFirst
    ? [...fixture.seeds.filter((seed) => seed.language === 'en'), ...fixture.seeds.filter((seed) => seed.language !== 'en')]
    : fixture.seeds;

  const selected = ordered.slice(0, input.batchSize);
  return {
    version: 1,
    description: 'Generated AI Strategist conversation scenarios.',
    scenarios: selected.map(seedToScenario),
  };
}

function seedToScenario(seed: Seed): GeneratedScenario {
  return {
    id: seed.id,
    label: `${seed.persona}: ${seed.category}`,
    category: mapCategory(seed.category),
    turns: seed.turns.map((message, index) => ({
      label: index === 0 ? 'initial user message' : `follow-up ${index}`,
      userMessage: message,
      expect: buildExpectation(seed, index),
    })),
  };
}

function buildExpectation(seed: Seed, turnIndex: number): Record<string, unknown> {
  if (seed.expected.shouldAnswerHelp) {
    return {
      task: seed.expected.primaryTask,
      noRecommendations: true,
      quality: {
        actionableNextStep: true,
        avoidsTechnicalJargon: true,
        preservesSafety: true,
        acquisitionFunnelForward: true,
      },
    };
  }

  if (seed.expected.shouldAskClarification) {
    return {
      action: 'ask_clarification',
      noRecommendations: true,
      quality: {
        actionableNextStep: true,
        avoidsTechnicalJargon: true,
        conversationalAdvisor: true,
      },
    };
  }

  if (turnIndex > 0 && seed.expected.shouldPreserveContext) {
    return {
      notStage: 'awaiting_model_choice',
      selectedModelPresent: true,
      quality: {
        actionableNextStep: true,
        conversationalAdvisor: true,
        acquisitionFunnelForward: true,
      },
    };
  }

  return {
    task: seed.expected.primaryTask,
    hasRecommendations: seed.expected.shouldRecommend ? true : undefined,
    quality: {
      actionableNextStep: true,
      avoidsTechnicalJargon: true,
      conversationalAdvisor: true,
      acquisitionFunnelForward: true,
    },
  };
}

function mapCategory(category: string): string {
  if (category === 'pricing') return 'pricing_or_catalog_gap';
  if (category === 'examples' || category === 'workflow_help') return 'site_or_navigation_help';
  if (category === 'prompt_improvement') return 'prompt_generation_issue';
  if (category === 'asset_reference') return 'asset_reference_routing';
  if (category === 'state_follow_up') return 'state_memory_error';
  if (category === 'messy_input') return 'language_issue';
  return 'routing_error';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = resolve(process.cwd(), process.argv[2] ?? 'docs/ai-strategist/evals/generated-conversation-scenarios.json');
  const generated = generateStrategistScenariosFromSeeds({
    seedPath: 'docs/ai-strategist/evals/scenario-seeds.json',
    batchSize: Number(process.env.AI_STRATEGIST_EVAL_BATCH_SIZE ?? 80),
    englishFirst: true,
  });
  writeFileSync(outputPath, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`Wrote ${generated.scenarios.length} generated scenarios to ${outputPath}`);
}
```

- [x] **Step 4: Run test**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-continuous-eval-loop.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add scripts/generate-ai-strategist-scenarios.ts tests/ai-strategist-continuous-eval-loop.test.ts
git commit -m "test: generate strategist conversation scenarios"
```

---

### Task 3: Add Quality Judge And Failure Clustering

**Files:**
- Create: `scripts/judge-ai-strategist-conversations.ts`
- Modify: `scripts/evaluate-ai-strategist-conversations.ts`
- Modify: `tests/ai-strategist-continuous-eval-loop.test.ts`

- [x] **Step 1: Write the failing test**

Add:

```ts
import {
  clusterStrategistFailures,
  scoreStrategistTranscript,
} from '../scripts/judge-ai-strategist-conversations.ts';

test('quality judge scores advisor behavior and clusters failures by owner', () => {
  const score = scoreStrategistTranscript({
    userMessage: 'hi',
    assistantMessage: 'What video are you trying to create or improve?',
    task: 'new_video_brief',
    action: 'recommend_models',
    stage: 'collecting_brief',
  });

  assert.ok(score.score < 7);
  assert.ok(score.issues.some((issue) => issue.includes('generic clarification')));

  const clusters = clusterStrategistFailures([
    { owner: 'conversation state merge / planner follow-up handling', message: 'lost selected model' },
    { owner: 'conversation state merge / planner follow-up handling', message: 'lost previous brief' },
    { owner: 'engine catalog pricing tool', message: 'missing quote' },
  ]);

  assert.equal(clusters[0]?.owner, 'conversation state merge / planner follow-up handling');
  assert.equal(clusters[0]?.count, 2);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-continuous-eval-loop.test.ts
```

Expected: FAIL because judge module does not exist.

- [x] **Step 3: Implement deterministic judge**

Create `scripts/judge-ai-strategist-conversations.ts`:

```ts
type TranscriptInput = {
  userMessage: string;
  assistantMessage: string;
  task: string;
  action: string;
  stage: string;
};

type FailureInput = {
  owner: string;
  message: string;
};

export function scoreStrategistTranscript(input: TranscriptInput) {
  const issues: string[] = [];
  let score = 10;
  const user = input.userMessage.toLowerCase();
  const assistant = input.assistantMessage.toLowerCase();

  if (/^(hi|hello|hey|bonjour|hola)$/.test(user.trim()) && assistant.includes('what video are you trying')) {
    score -= 3;
    issues.push('generic clarification after greeting');
  }

  if (user.includes('cheapest') && !assistant.includes('$')) {
    score -= 3;
    issues.push('pricing question without price anchor');
  }

  if ((user.includes('choose for me') || user.includes('you decide')) && input.stage === 'awaiting_model_choice') {
    score -= 4;
    issues.push('failed to act on user delegation');
  }

  if (assistant.includes('normalizedbrief') || assistant.includes('orchestration') || assistant.includes('json')) {
    score -= 2;
    issues.push('technical implementation language exposed');
  }

  if (!assistant.includes('credit') && !assistant.includes('generation') && !assistant.includes('prompt') && !assistant.includes('model')) {
    score -= 1;
    issues.push('weak funnel progression');
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}

export function clusterStrategistFailures(failures: FailureInput[]) {
  const byOwner = new Map<string, FailureInput[]>();
  for (const failure of failures) {
    byOwner.set(failure.owner, [...(byOwner.get(failure.owner) ?? []), failure]);
  }

  return Array.from(byOwner.entries())
    .map(([owner, ownerFailures]) => ({
      owner,
      count: ownerFailures.length,
      examples: ownerFailures.slice(0, 5).map((failure) => failure.message),
    }))
    .sort((a, b) => b.count - a.count);
}
```

- [x] **Step 4: Run test**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-continuous-eval-loop.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add scripts/judge-ai-strategist-conversations.ts tests/ai-strategist-continuous-eval-loop.test.ts
git commit -m "test: add strategist conversation quality judge"
```

---

### Task 4: Add Continuous Loop Runner

**Files:**
- Create: `scripts/run-ai-strategist-improvement-loop.ts`
- Modify: `tests/ai-strategist-continuous-eval-loop.test.ts`

- [x] **Step 1: Write the failing test**

Add:

```ts
import { shouldStopStrategistLoop } from '../scripts/run-ai-strategist-improvement-loop.ts';

test('continuous loop stops only after repeated clean runs', () => {
  assert.equal(shouldStopStrategistLoop({ cleanRuns: 0, stopAfterCleanRuns: 3, iteration: 1, maxIterations: 20 }), false);
  assert.equal(shouldStopStrategistLoop({ cleanRuns: 2, stopAfterCleanRuns: 3, iteration: 10, maxIterations: 20 }), false);
  assert.equal(shouldStopStrategistLoop({ cleanRuns: 3, stopAfterCleanRuns: 3, iteration: 10, maxIterations: 20 }), true);
  assert.equal(shouldStopStrategistLoop({ cleanRuns: 0, stopAfterCleanRuns: 3, iteration: 20, maxIterations: 20 }), true);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-continuous-eval-loop.test.ts
```

Expected: FAIL because loop runner does not exist.

- [x] **Step 3: Implement loop runner**

Create `scripts/run-ai-strategist-improvement-loop.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

type StopInput = {
  cleanRuns: number;
  stopAfterCleanRuns: number;
  iteration: number;
  maxIterations: number;
};

export function shouldStopStrategistLoop(input: StopInput): boolean {
  return input.cleanRuns >= input.stopAfterCleanRuns || input.iteration >= input.maxIterations;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  let cleanRuns = 0;
  const reportDir = resolve(process.cwd(), 'reports/ai-strategist');
  mkdirSync(reportDir, { recursive: true });

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const fixturePath = resolve(reportDir, `generated-scenarios-${iteration}.json`);
    const jsonReportPath = resolve(reportDir, `eval-report-${iteration}.json`);
    const markdownReportPath = resolve(reportDir, `eval-report-${iteration}.md`);

    run('npx', [
      'tsx',
      '--tsconfig',
      'frontend/tsconfig.json',
      'scripts/generate-ai-strategist-scenarios.ts',
      fixturePath,
    ], {
      AI_STRATEGIST_EVAL_BATCH_SIZE: String(options.batchSize),
    });

    const evalResult = run('npx', [
      'tsx',
      '--tsconfig',
      'frontend/tsconfig.json',
      'scripts/evaluate-ai-strategist-conversations.ts',
      '--fixture',
      fixturePath,
      '--json-output',
      jsonReportPath,
      '--markdown-output',
      markdownReportPath,
    ]);

    const passed = evalResult.status === 0;
    cleanRuns = passed ? cleanRuns + 1 : 0;

    const summary = [
      `# AI Strategist Loop Iteration ${iteration}`,
      '',
      `- Passed: ${passed ? 'yes' : 'no'}`,
      `- Clean runs: ${cleanRuns}/${options.stopAfterCleanRuns}`,
      `- Fixture: ${fixturePath}`,
      `- JSON report: ${jsonReportPath}`,
      `- Markdown report: ${markdownReportPath}`,
      '',
      passed
        ? 'No deterministic failures found in this iteration.'
        : 'Fix the highest-impact failure cluster, run targeted evals, run full evals, commit, then restart the loop.',
      '',
    ].join('\n');

    writeFileSync(resolve(reportDir, 'latest-loop-summary.md'), summary);
    console.log(summary);

    if (shouldStopStrategistLoop({
      cleanRuns,
      stopAfterCleanRuns: options.stopAfterCleanRuns,
      iteration,
      maxIterations: options.iterations,
    })) {
      process.exitCode = passed ? 0 : 1;
      return;
    }

    if (!passed) {
      process.exitCode = 1;
      return;
    }
  }
}

function parseArgs(args: string[]) {
  return {
    iterations: numberArg(args, '--iterations', 20),
    batchSize: numberArg(args, '--batch-size', 80),
    stopAfterCleanRuns: numberArg(args, '--stop-after-clean-runs', 3),
  };
}

function numberArg(args: string[], key: string, fallback: number): number {
  const direct = args.find((arg) => arg.startsWith(`${key}=`));
  if (direct) return Number(direct.slice(key.length + 1)) || fallback;
  const index = args.indexOf(key);
  if (index >= 0) return Number(args[index + 1]) || fallback;
  return fallback;
}

function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [x] **Step 4: Run test**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-continuous-eval-loop.test.ts
```

Expected: PASS.

- [x] **Step 5: Smoke run one iteration**

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/run-ai-strategist-improvement-loop.ts \
  --iterations 1 \
  --batch-size 20 \
  --stop-after-clean-runs 1
```

Expected: writes reports under `reports/ai-strategist/` and exits 0 if clean, 1 if failures found.

- [x] **Step 6: Commit**

```bash
git add scripts/run-ai-strategist-improvement-loop.ts tests/ai-strategist-continuous-eval-loop.test.ts
git commit -m "test: add strategist continuous eval loop runner"
```

---

### Task 5: Add Policy, Reports, And Stop Criteria

**Files:**
- Create: `docs/ai-strategist/evals/continuous-loop-policy.md`
- Modify: `scripts/evaluate-ai-strategist-conversations.ts`
- Modify: `scripts/run-ai-strategist-improvement-loop.ts`

- [x] **Step 1: Create policy doc**

Create `docs/ai-strategist/evals/continuous-loop-policy.md`:

```md
# AI Strategist Continuous Evaluation Policy

## Goal

The loop improves the internal AI Strategist by testing realistic conversations, fixing the highest-impact issue, committing, and repeating.

## Language Mix

- English is the primary language for the product and QA.
- Final generated creative prompts should default to English.
- The assistant may answer site/help questions in the user's language when helpful.
- Multilingual input should not break routing or context memory.

## User Realism

Scenarios must include:

- greetings and vague openers
- users who do not know model names
- users who ask price before prompt
- users who ask examples before paying
- users who type badly
- users who change duration/format after confirmation
- users who ask the assistant to choose
- users with uploaded product/person/reference assets
- users who ask model capability questions
- users who paste prompts for improvement

## Critical Failures

These must be fixed before continuing:

- wrong task routing for pricing, examples, upload, or prompt edit
- lost previous brief or selected model
- prompt generated before confirmation
- visible person/reference safety warning missing
- product logo/text warning missing
- response says or implies generation/credits were used
- debug/internal terms leaked to user

## Stop Criteria

The loop can pause when:

- deterministic eval suite passes three clean runs in a row
- targeted AI Strategist tests pass
- frontend lint passes
- exposure lint passes
- git diff check passes
- no critical judge issue remains

## Commit Rule

Every successful correction loop should commit with a focused message:

- `test: add strategist conversation scenarios`
- `fix: route strategist pricing follow ups`
- `fix: preserve strategist model selection context`
- `fix: improve strategist product help answer`
```

- [x] **Step 2: Ensure reports expose failure clusters**

Modify `scripts/evaluate-ai-strategist-conversations.ts` so JSON/Markdown reports include:

```ts
failureClusters: Array<{
  owner: string;
  count: number;
  examples: string[];
}>;
```

Use `clusterStrategistFailures()` from `scripts/judge-ai-strategist-conversations.ts`.

- [x] **Step 3: Run eval with report output**

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts \
  --json-output reports/ai-strategist/manual.json \
  --markdown-output reports/ai-strategist/manual.md
```

Expected: report files include pass rate and failure clusters.

- [x] **Step 4: Commit**

```bash
git add docs/ai-strategist/evals/continuous-loop-policy.md scripts/evaluate-ai-strategist-conversations.ts scripts/run-ai-strategist-improvement-loop.ts
git commit -m "docs: define strategist continuous eval policy"
```

---

### Task 6: Add The Codex Launch Prompt

**Files:**
- Create: `docs/ai-strategist/evals/continuous-improvement-prompt.md`

- [x] **Step 1: Create the launch prompt**

Create `docs/ai-strategist/evals/continuous-improvement-prompt.md`:

```md
# Codex Prompt: Run AI Strategist Continuous Improvement

You are working on the MaxVideoAI AI Strategist.

Goal:
Run repeated English-first conversation QA loops, fix the highest-impact failure cluster, test, commit, and continue until the loop reaches the stop criteria.

Important:
- English is the primary product language.
- Keep multilingual robustness, but prioritize English coherence.
- Simulate real users, not perfect prompt engineers.
- Include greetings, vague questions, typo-heavy messages, pricing questions, model questions, examples/navigation questions, uploaded assets, prompt improvement, duration changes, and funnel objections.
- Do not add RAG.
- Do not expose publicly.
- Do not run video generation.
- Do not spend credits.
- Do not publish.
- Do not apply uiActions to the real generator.
- Keep the admin playground internal-only.
- Commit after each successful fix loop.

Loop:
1. Run:

   ```bash
   npx tsx --tsconfig frontend/tsconfig.json scripts/run-ai-strategist-improvement-loop.ts \
     --iterations 20 \
     --batch-size 80 \
     --english-first \
     --write-reports \
     --stop-after-clean-runs 3
   ```

2. If failures appear, inspect:

   ```bash
   reports/ai-strategist/latest-loop-summary.md
   reports/ai-strategist/eval-report-*.md
   reports/ai-strategist/eval-report-*.json
   ```

3. Fix only the highest-impact failure cluster.

4. Run targeted evals for the failed category.

5. Run the full conversation eval:

   ```bash
   npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts
   ```

6. Run:

   ```bash
   npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-knowledge-llm.test.ts tests/ai-strategist-playground.test.ts tests/ai-strategist-engine-knowledge.test.ts tests/ai-strategist-knowledge.test.ts tests/ai-video-strategist-api.test.ts tests/ai-strategist-continuous-eval-loop.test.ts
   npm --prefix frontend run lint
   npm run lint:exposure
   git diff --check
   ```

7. Commit:

   ```bash
   git add <changed-files>
   git commit -m "fix: <focused strategist issue>"
   ```

8. Repeat from step 1 until three clean runs pass or no critical issue remains.

Final report:
- number of loop iterations
- failures fixed by category
- remaining known weaknesses
- commands run
- commits created
```

- [x] **Step 2: Commit**

```bash
git add docs/ai-strategist/evals/continuous-improvement-prompt.md
git commit -m "docs: add strategist continuous improvement prompt"
```

---

## Final Verification

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/run-ai-strategist-improvement-loop.ts \
  --iterations 1 \
  --batch-size 20 \
  --stop-after-clean-runs 1

npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts

npx tsx --tsconfig frontend/tsconfig.json --test \
  tests/ai-strategist-knowledge-llm.test.ts \
  tests/ai-strategist-playground.test.ts \
  tests/ai-strategist-engine-knowledge.test.ts \
  tests/ai-strategist-knowledge.test.ts \
  tests/ai-video-strategist-api.test.ts \
  tests/ai-strategist-continuous-eval-loop.test.ts

npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected:

- The loop writes reports.
- The existing strategist suite still passes.
- Lint passes.
- Exposure lint passes.
- Diff check passes.

---

## How To Run The Long Improvement Loop After Implementation

Use this command for deterministic continuous QA:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/run-ai-strategist-improvement-loop.ts \
  --iterations 20 \
  --batch-size 80 \
  --english-first \
  --write-reports \
  --stop-after-clean-runs 3
```

Use this Codex prompt to keep the agent working:

```txt
Run the AI Strategist continuous improvement loop.

Use the English-first scenario bank and simulate real users: greetings, vague inputs, typos, pricing questions, model questions, site navigation, uploaded assets, prompt improvements, and follow-up edits.

For each loop:
1. Run the loop command.
2. Inspect the highest-impact failure cluster.
3. Fix only that cluster.
4. Run targeted evals.
5. Run full evals, AI Strategist tests, frontend lint, exposure lint, and git diff check.
6. Commit the focused fix.
7. Repeat until three clean runs pass or no critical issue remains.

Do not add RAG.
Do not expose publicly.
Do not run video generation.
Do not spend credits.
Do not publish.
Do not apply uiActions to the real generator.
Prioritize English UX quality while preserving multilingual robustness.
```

---

## Self-Review

- Spec coverage: The plan covers English-first realism, messy users, multilingual fallback, pricing/site/model/workflow questions, prompt improvement, context memory, loop runner, reports, stop criteria, and commit-per-loop workflow.
- Placeholder scan: No task uses TODO/TBD placeholders; code snippets and commands are explicit.
- Type consistency: Scenario seed, generated scenario, judge, and loop runner types are defined before use.
