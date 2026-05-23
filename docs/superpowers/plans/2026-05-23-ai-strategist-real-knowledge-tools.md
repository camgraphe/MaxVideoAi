# AI Strategist Real Knowledge Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the AI Video Strategist from a prompt/model advisor into a real MaxVideoAI knowledge orchestrator that can answer model, workflow, pricing, navigation, examples, and future project-context questions using explicit source-backed tools.

**Architecture:** Add a `frontend/lib/ai-strategist/knowledge/` layer behind the existing orchestrator. Each knowledge capability is a deterministic tool with declared sources, confidence, limitations, warnings, and UI actions; LLMs may phrase or synthesize only after the deterministic tool has produced grounded context. Keep RAG and user-project context as later phases behind the same tool contract.

**Tech Stack:** Next.js App Router, TypeScript, existing AI Strategist model/workflow/prompt catalogs, `frontend/config/engine-catalog.json`, admin playground route, Node test runner via `npx tsx --test`.

---

## Product Principle

This is not a generic chatbot project. The target is an intelligent MaxVideoAI advisor that can answer precisely because it knows which internal tool and source of truth to use.

The assistant must:

- understand the current user intent before choosing a tool
- answer from structured MaxVideoAI sources when a fact is requested
- expose source metadata and limitations internally
- use deterministic tools for direct factual answers
- use cheap LLM synthesis only when wording or cross-source summarization is useful
- use strong LLMs only for creative prompt writing or complex strategy
- say what is unknown instead of inventing unsupported facts
- never run generation, spend credits, publish, or apply generator changes without explicit future product approval

The user-facing experience should feel conversational and intelligent, but the underlying behavior should be closer to a tool-using expert system than a classic open-ended bot.

---

## Current Baseline

The strategist can currently answer or preview:

- model recommendations from `frontend/lib/ai-strategist/model-catalog.ts`
- workflow rules from `frontend/lib/ai-strategist/workflow-rules.ts`
- prompt structures from `frontend/lib/ai-strategist/prompt-structures.ts`
- local/dev Vertex LLM prompt writing through `frontend/lib/ai-strategist/llm-adapter.ts`
- basic pricing preview from relative model cost in `prompt-structures.ts`
- basic site/help answers through `frontend/lib/ai-strategist/orchestrator/advisor-tools.ts`

It does **not** yet have complete site knowledge, examples knowledge, live generator settings knowledge, full pricing knowledge, user-project context, or RAG. Until each tool is implemented, the bot must say what it can do now and avoid claiming unsupported access.

---

## Target Architecture

```txt
user turn
→ conversation planner
→ orchestrator task
→ cost router
→ knowledge tool router
→ deterministic source-backed tool result
→ optional cheap LLM wording/synthesis
→ optional strong LLM prompt writer
→ validators
→ UI preview actions only
```

Core contract:

```ts
export type StrategistKnowledgeSourceId =
  | 'ai_strategist_model_catalog'
  | 'ai_strategist_workflow_rules'
  | 'ai_strategist_prompt_structures'
  | 'engine_catalog'
  | 'site_navigation_map'
  | 'examples_catalog'
  | 'project_context'
  | 'docs_rag';

export type StrategistKnowledgeToolName =
  | 'capability_help'
  | 'site_overview'
  | 'model_info'
  | 'model_comparison'
  | 'engine_pricing'
  | 'engine_settings'
  | 'workflow_help'
  | 'navigation_help'
  | 'examples_help'
  | 'prompt_guidance'
  | 'project_context_help'
  | 'docs_search';

export type StrategistKnowledgeToolResult = {
  toolName: StrategistKnowledgeToolName;
  answer: string;
  sources: {
    id: StrategistKnowledgeSourceId;
    label: string;
    path?: string;
    url?: string;
  }[];
  confidence: number;
  limitations: string[];
  warnings: string[];
  uiActions: {
    type: 'SET_MODEL' | 'SET_WORKFLOW' | 'SET_PROMPT' | 'SET_NEGATIVE_PROMPT' | 'SET_ASPECT_RATIO' | 'SET_DURATION' | 'SET_RESOLUTION';
    value: string;
  }[];
};
```

---

## Phase 1: Knowledge Tool Contract

**Files:**
- Create: `frontend/lib/ai-strategist/knowledge/types.ts`
- Create: `frontend/lib/ai-strategist/knowledge/tool-router.ts`
- Modify: `frontend/lib/ai-strategist/orchestrator/types.ts`
- Modify: `frontend/lib/ai-strategist/playground-pipeline.ts`
- Test: `tests/ai-strategist-playground.test.ts`

- [ ] **Step 1: Add failing tests for source-backed tool output**

Add tests that require every knowledge answer to expose source metadata and no prompt writer usage:

```ts
test('AI Strategist knowledge answers include grounded sources and no prompt writer', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'What can Seedance 2 do?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.equal(result.llm.promptWriter.used, false);
  assert.ok(result.knowledgeToolResults?.length);
  assert.match(result.knowledgeToolResults[0].answer, /Seedance 2\.0/i);
  assert.ok(result.knowledgeToolResults[0].sources.some((source) => source.id === 'ai_strategist_model_catalog'));
});
```

Expected before implementation: FAIL because `knowledgeToolResults` does not exist.

- [ ] **Step 2: Create the shared knowledge types**

Create `frontend/lib/ai-strategist/knowledge/types.ts` with the contract in the Target Architecture section. Export `StrategistKnowledgeToolResult`, `StrategistKnowledgeToolName`, and `StrategistKnowledgeSourceId`.

- [ ] **Step 3: Add a minimal tool router**

Create `frontend/lib/ai-strategist/knowledge/tool-router.ts`:

```ts
import type { StrategistOrchestratorTask } from '../orchestrator';
import type { StrategistKnowledgeToolName } from './types';

export function selectStrategistKnowledgeTool(task: StrategistOrchestratorTask, message: string): StrategistKnowledgeToolName | null {
  const text = normalizeSearchText(message);
  if (task === 'capability_help') return 'capability_help';
  if (task === 'site_overview_help') return 'site_overview';
  if (task === 'pricing_help') return 'engine_pricing';
  if (task === 'workflow_help') return 'workflow_help';
  if (task === 'navigation_help' || task === 'asset_reference_help') return 'navigation_help';
  if (/\b(example|examples|sample|gallery|exemples?)\b/.test(text)) return 'examples_help';
  if (/\b(settings?|resolution|duration|audio|lip sync|lip-sync|mode)\b/.test(text)) return 'engine_settings';
  if (/\b(model|seedance|kling|veo|ltx|pika|hailuo|sora|happy horse)\b/.test(text)) return 'model_info';
  return null;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4: Add response fields to the playground result**

Modify `AiStrategistPlaygroundResult` in `frontend/lib/ai-strategist/playground-pipeline.ts`:

```ts
import type { StrategistKnowledgeToolResult } from './knowledge/types';

export type AiStrategistPlaygroundResult = {
  // existing fields
  knowledgeToolResults?: StrategistKnowledgeToolResult[];
};
```

- [ ] **Step 5: Run tests**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-playground.test.ts
```

Expected after Phase 1: source-backed contract tests pass with at least capability/site/model stubs.

---

## Phase 2: Model And Workflow Knowledge Tools

**Files:**
- Create: `frontend/lib/ai-strategist/knowledge/model-knowledge.ts`
- Create: `frontend/lib/ai-strategist/knowledge/workflow-knowledge.ts`
- Modify: `frontend/lib/ai-strategist/orchestrator/intent-router.ts`
- Modify: `frontend/lib/ai-strategist/orchestrator/tool-registry.ts`
- Modify: `frontend/lib/ai-strategist/orchestrator/advisor-tools.ts`
- Test: `tests/ai-strategist-playground.test.ts`

- [ ] **Step 1: Add failing model knowledge tests**

```ts
test('AI Strategist answers model capability questions from the model catalog', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'What is Seedance 2 best for and what should I avoid?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'model_info_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /Seedance 2\.0/i);
  assert.match(result.assistantMessage, /Best for/i);
  assert.match(result.assistantMessage, /Avoid/i);
  assert.ok(result.knowledgeToolResults?.[0].sources.some((source) => source.id === 'ai_strategist_model_catalog'));
});
```

- [ ] **Step 2: Add failing workflow support tests**

```ts
test('AI Strategist lists models that support image-to-video from structured catalogs', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Which models support image-to-video?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'workflow_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /image-to-video/i);
  assert.match(result.assistantMessage, /Kling/i);
  assert.ok(result.knowledgeToolResults?.[0].sources.some((source) => source.id === 'ai_strategist_model_catalog'));
  assert.ok(result.knowledgeToolResults?.[0].sources.some((source) => source.id === 'ai_strategist_workflow_rules'));
});
```

- [ ] **Step 3: Implement `model-knowledge.ts`**

Use `AI_STRATEGIST_MODELS` as the source of truth. Resolve aliases with the existing model alias patterns from `conversation-planner.ts`.

Output should include:
- label
- bestFor
- avoidFor
- supportedWorkflows
- cost/speed/quality levels
- prompt guidance summary
- warnings when person-reference compatibility is conditional or avoid

- [ ] **Step 4: Implement `workflow-knowledge.ts`**

Use `AI_STRATEGIST_WORKFLOWS` and `AI_STRATEGIST_MODELS`. For a workflow, return:
- workflow description
- bestFor / avoidFor
- planning steps
- models supporting the workflow
- prompt structure expectations

- [ ] **Step 5: Route model info questions**

Add task types:

```ts
| 'model_info_help'
| 'engine_settings_help'
| 'examples_help'
```

Model info questions must not become creative recommendations unless the user asks “which model should I use for this brief?”

- [ ] **Step 6: Run tests**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-playground.test.ts
```

---

## Phase 3: Engine Pricing And Settings Knowledge

**Files:**
- Create: `frontend/lib/ai-strategist/knowledge/engine-catalog-knowledge.ts`
- Create: `tests/ai-strategist-engine-knowledge.test.ts`
- Modify: `frontend/lib/ai-strategist/orchestrator/advisor-tools.ts`
- Modify: `frontend/lib/ai-strategist/playground-pipeline.ts`

Source of truth:
- `frontend/config/engine-catalog.json`
- `frontend/lib/ai-strategist/model-catalog.ts` for strategist model IDs and aliases
- existing generate validation helpers only as references; do not import server-only modules into client-safe files

- [ ] **Step 1: Add failing engine pricing tests**

```ts
test('engine knowledge resolves Kling 3 Pro pricing from engine catalog', async () => {
  const { answerEnginePricingQuestion } = await import('../frontend/lib/ai-strategist/knowledge/engine-catalog-knowledge.ts');

  const result = answerEnginePricingQuestion({
    rawUserMessage: 'How much is Kling 3 Pro for 10 seconds with audio?',
  });

  assert.match(result.answer, /Kling 3 Pro/i);
  assert.match(result.answer, /10 seconds/i);
  assert.ok(result.sources.some((source) => source.id === 'engine_catalog'));
  assert.equal(result.limitations.includes('The generator quote shown before rendering is authoritative.'), true);
});
```

- [ ] **Step 2: Add failing settings tests**

```ts
test('engine knowledge answers available durations and resolution settings', async () => {
  const { answerEngineSettingsQuestion } = await import('../frontend/lib/ai-strategist/knowledge/engine-catalog-knowledge.ts');

  const result = answerEngineSettingsQuestion({
    rawUserMessage: 'What settings does Kling 3 4K support?',
  });

  assert.match(result.answer, /Kling 3 4K/i);
  assert.match(result.answer, /4K/i);
  assert.ok(result.sources.some((source) => source.path === 'frontend/config/engine-catalog.json'));
});
```

- [ ] **Step 3: Implement safe engine catalog reader**

`engine-catalog-knowledge.ts` should import JSON and normalize only fields needed by the strategist:

```ts
type StrategistEngineCatalogEntry = {
  engineId: string;
  label: string;
  availability?: string;
  modes: string[];
  pricing?: {
    currency?: string;
    unit?: string;
    base?: number;
    notes?: string;
  };
  pricingDetails?: {
    currency?: string;
    perSecondCents?: Record<string, number>;
  };
  supportedSettings: string[];
};
```

Do not expose provider secrets, internal account IDs, or admin-only provider details in user-facing answers.

- [ ] **Step 4: Map strategist model IDs to engine catalog entries**

Use `AiStrategistModelEntry.appEngineAliases` where available. If a strategist model has multiple engine entries, answer with a range and say the generator quote wins.

- [ ] **Step 5: Wire pricing/settings tool into playground**

Pricing questions should use `engine_catalog` first. If no exact engine match is found, fall back to the current strategist preview estimate and include a limitation:

```txt
I could not find a precise engine catalog match, so this is a strategist preview estimate.
```

- [ ] **Step 6: Run tests**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-engine-knowledge.test.ts tests/ai-strategist-playground.test.ts
```

---

## Phase 4: Site Navigation And Examples Knowledge

**Files:**
- Create: `frontend/lib/ai-strategist/knowledge/site-navigation-knowledge.ts`
- Create: `frontend/lib/ai-strategist/knowledge/examples-knowledge.ts`
- Modify: `frontend/lib/ai-strategist/orchestrator/advisor-tools.ts`
- Test: `tests/ai-strategist-playground.test.ts`

Sources:
- hardcoded public route map for core pages
- `frontend/lib/model-families.ts`
- `frontend/lib/examples-links.ts`
- `frontend/lib/examples/modelLandingData.en.ts`
- later: `/api/examples` if server/API usage is needed

- [ ] **Step 1: Add failing navigation tests**

```ts
test('AI Strategist routes example questions to examples pages without auto-navigation', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Show me Kling examples',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'examples_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /Kling examples/i);
  assert.match(result.assistantMessage, /\/examples\/kling/i);
  assert.equal(result.safety.uiActionsApplied, false);
});
```

- [ ] **Step 2: Add failing site action tests**

```ts
test('AI Strategist explains where to compare models and where to generate', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Where do I compare models before generating?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.mode, 'product_help');
  assert.match(result.assistantMessage, /Compare/i);
  assert.match(result.assistantMessage, /Generate/i);
  assert.equal(result.recommendations, undefined);
});
```

- [ ] **Step 3: Implement `site-navigation-knowledge.ts`**

Include stable routes:

```ts
const AI_STRATEGIST_SITE_ROUTES = [
  { label: 'Video generator', href: '/app', intents: ['generate', 'upload image', 'image-to-video'] },
  { label: 'Pricing', href: '/pricing', intents: ['pricing', 'credits', 'cost'] },
  { label: 'Models catalog', href: '/models', intents: ['models', 'engines'] },
  { label: 'Examples', href: '/examples', intents: ['examples', 'gallery'] },
  { label: 'Compare', href: '/compare', intents: ['compare', 'versus'] },
  { label: 'Workflows', href: '/workflows', intents: ['workflow', 'text-to-video', 'image-to-video'] },
];
```

Return navigation suggestions only; do not navigate automatically.

- [ ] **Step 4: Implement `examples-knowledge.ts`**

Resolve model family from model alias. Return:
- examples hub URL
- family examples URL when known
- one-line guidance on what examples are useful for
- source metadata

- [ ] **Step 5: Run tests**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-playground.test.ts
```

---

## Phase 5: Tool-Aware LLM Synthesis

**Files:**
- Modify: `frontend/lib/ai-strategist/llm-contracts.ts`
- Modify: `frontend/lib/ai-strategist/llm-adapter.ts`
- Modify: `frontend/lib/ai-strategist/playground-pipeline.ts`
- Create: `tests/ai-strategist-knowledge-llm.test.ts`

Goal: LLMs may phrase answers, but must not invent facts outside tool context.

- [ ] **Step 1: Add failing validator tests**

```ts
test('knowledge answer validator flags claims not present in tool context', async () => {
  const { validateKnowledgeSynthesisOutput } = await import('../frontend/lib/ai-strategist/llm-contracts.ts');

  const validation = validateKnowledgeSynthesisOutput(
    {
      assistantMessage: 'Kling is free and supports unlimited 8K generation.',
      warnings: [],
      uiActions: [],
    },
    {
      toolResults: [
        {
          toolName: 'engine_pricing',
          answer: 'Kling has preview pricing. The generator quote wins.',
          sources: [{ id: 'engine_catalog', label: 'Engine catalog' }],
          confidence: 0.8,
          limitations: ['The generator quote shown before rendering is authoritative.'],
          warnings: [],
          uiActions: [],
        },
      ],
    }
  );

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue) => /unsupported/i.test(issue.message)));
});
```

- [ ] **Step 2: Add knowledge synthesis request contract**

Create `buildKnowledgeSynthesisLLMRequest(toolResults, conversationContext)` in `llm-contracts.ts`.

Rules:
- cite only source labels available in `toolResults`
- do not claim unavailable routes/settings/prices
- keep answers short
- if source confidence is below `0.65`, ask one clarification or say what is missing
- no generation, no credit spend, no publishing

- [ ] **Step 3: Add cost routing**

Use cheap LLM only when:
- user asks a broad question requiring synthesis across two or more tool results
- answer is not a prompt
- deterministic tool confidence is high enough

Keep no-LLM answers for direct pricing, direct model info, direct navigation, and direct capabilities.

- [ ] **Step 4: Run tests**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-knowledge-llm.test.ts tests/ai-strategist-playground.test.ts
```

---

## Phase 6: RAG Preparation Without RAG Activation

**Files:**
- Create: `frontend/lib/ai-strategist/knowledge/rag-contract.ts`
- Create: `docs/ai-strategist/knowledge-sources.md`
- Test: `tests/ai-strategist-knowledge.test.ts`

Goal: define the RAG boundary before adding any retriever.

- [ ] **Step 1: Document allowed RAG sources**

Create `docs/ai-strategist/knowledge-sources.md` with:
- model docs under `docs/ai-strategist/models/`
- workflow docs under `docs/ai-strategist/workflows/`
- prompt structure docs under `docs/ai-strategist/prompt-structures/`
- selected public site docs
- selected public examples metadata

Excluded until explicitly approved:
- private user projects
- admin-only data
- raw job prompts from other users
- credentials or provider internals

- [ ] **Step 2: Define RAG result contract**

`rag-contract.ts`:

```ts
export type StrategistRagSearchInput = {
  query: string;
  allowedSourceIds: string[];
  maxResults: number;
};

export type StrategistRagSearchResult = {
  excerpt: string;
  sourceId: string;
  sourcePath?: string;
  sourceUrl?: string;
  confidence: number;
};
```

- [ ] **Step 3: Add tests ensuring RAG is not called yet**

```ts
test('AI Strategist does not call RAG while RAG is disabled', async () => {
  const playground = await loadPlaygroundModule();
  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Search your docs for Seedance lip sync limits',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.doesNotEqual(result.orchestrationPlan.task, 'docs_search');
  assert.match(result.assistantMessage, /not connected|available structured/i);
});
```

---

## Phase 7: Project Context Preparation

**Files:**
- Create: `frontend/lib/ai-strategist/knowledge/project-context-contract.ts`
- Modify later only after explicit approval: workspace API/server modules

Goal: define what the strategist may know about the current user/project when connected later.

Allowed future context:
- current generator form values
- selected uploaded asset metadata
- current prompt
- selected model/workflow/settings
- user-owned project/library assets if explicitly provided by the app

Not allowed:
- reading private projects silently
- using another user’s jobs/prompts
- spending credits
- applying generator actions without confirmation

Contract:

```ts
export type StrategistProjectContext = {
  currentPrompt?: string;
  selectedModel?: string;
  selectedWorkflow?: string;
  selectedSettings?: Record<string, string | number | boolean>;
  uploadedAssetMetadata?: {
    type?: string;
    hasPerson?: boolean;
    hasProduct?: boolean;
    hasLogo?: boolean;
    hasText?: boolean;
    isReferenceImage?: boolean;
  };
};
```

---

## Phase 8: Admin Playground UI Debug Upgrade

**Files:**
- Modify: `frontend/app/(core)/admin/ai-strategist-playground/_components/AiStrategistChatClient.tsx`
- Modify: `frontend/app/(core)/admin/ai-strategist-playground/_components/AiStrategistPlaygroundClient.tsx`
- Test: `tests/ai-strategist-playground.test.ts`

Add collapsed debug-only panels:
- `knowledgeToolResults`
- sources used
- cost routing decision
- whether LLM was skipped because deterministic tool was enough

Do not show raw JSON in the primary chat. Main chat can show small source chips:

```txt
Sources: Model catalog, Engine catalog
```

Tests:

```ts
test('AI Strategist chat source details stay secondary', () => {
  const chatSource = readFileSync(join(root, 'frontend/app/(core)/admin/ai-strategist-playground/_components/AiStrategistChatClient.tsx'), 'utf8');
  assert.match(chatSource, /knowledgeToolResults/);
  assert.doesNotMatch(chatSource, /<details[^>]*open/);
});
```

---

## Validation Commands

Run after each phase:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-playground.test.ts tests/ai-strategist-knowledge.test.ts tests/ai-video-strategist-api.test.ts
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Run after engine pricing work:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-engine-knowledge.test.ts
```

Run after knowledge LLM work:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-knowledge-llm.test.ts
```

---

## Acceptance Criteria

- General capability answers distinguish current implemented knowledge from future capabilities.
- Model questions use `AI_STRATEGIST_MODELS`, not generic LLM memory.
- Workflow questions use `AI_STRATEGIST_WORKFLOWS`.
- Pricing/settings questions use `engine-catalog.json` when possible and clearly fall back when not possible.
- Site/navigation questions use a route map and never auto-navigate.
- Example questions route to examples pages or explain unavailable examples without inventing them.
- LLM synthesis cannot introduce unsupported facts, unsupported prices, unsupported resolution claims, or generation side effects.
- No RAG is called until a later explicit implementation approval.
- No generation, no credit spend, no publishing, and no real generator UI actions.

---

## Recommended PR Breakdown

1. **PR 1: Knowledge Tool Contract**
   - types, tool router, result fields, debug visibility

2. **PR 2: Model + Workflow Knowledge**
   - real model info answers, supported workflow answers

3. **PR 3: Engine Catalog Pricing + Settings**
   - source-backed price/settings answers from `engine-catalog.json`

4. **PR 4: Site Navigation + Examples Knowledge**
   - stable route map, model/examples route answers

5. **PR 5: Tool-Aware LLM Synthesis**
   - cheap LLM wording only with tool-grounded validators

6. **PR 6: RAG Contract**
   - no retriever yet; only boundaries, allowed sources, tests

7. **PR 7: Project Context Contract**
   - future app integration contract, no automatic access
