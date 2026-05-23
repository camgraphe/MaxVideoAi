# AI Strategist Conversation Eval Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated local evaluation loop that simulates customer conversations, scores AI Strategist behavior, and produces actionable failure reports for iterative improvements.

**Architecture:** Store conversation scenarios as versioned JSON under `docs/ai-strategist/evals/`. Keep the evaluator deterministic by default, using the existing playground pipeline as the system under test. The runner scores each turn against structured expectations and reports failure categories that point to the likely owner layer: planner, router, knowledge, recommendations, prompt, UI flow, language, or safety.

**Tech Stack:** TypeScript, `tsx`, Node test runner, existing `frontend/lib/ai-strategist/playground-pipeline.ts`, JSON fixtures, Markdown/JSON report output.

---

### Task 1: Externalize Conversation Scenarios

**Files:**
- Create: `docs/ai-strategist/evals/conversation-scenarios.json`
- Modify: `scripts/evaluate-ai-strategist-conversations.ts`
- Test: `tests/ai-strategist-playground.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add a test that reads `docs/ai-strategist/evals/conversation-scenarios.json`, verifies at least 20 scenarios exist, and checks each turn has `label`, `userMessage`, and expectation metadata.

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-playground.test.ts
```

Expected: fail because `conversation-scenarios.json` does not exist yet.

- [ ] **Step 3: Create the JSON fixture**

Move the current script scenarios into a JSON fixture with fields:

```json
{
  "version": 1,
  "scenarios": [
    {
      "id": "pricing-cheapest-fr",
      "label": "Pricing help: cheapest model on the site",
      "category": "pricing_or_catalog_gap",
      "turns": [
        {
          "label": "asks for cheapest model",
          "userMessage": "quelle est le model le moins cher sur le site ?",
          "expect": {
            "task": "pricing_help",
            "mode": "product_help",
            "noRecommendations": true,
            "mustMention": ["moins cher", "$0.04"],
            "mustNotMention": ["open the video generator, choose the workflow"]
          }
        }
      ]
    }
  ]
}
```

- [ ] **Step 4: Verify the test passes**

Run the same test command and confirm the fixture contract passes.

### Task 2: Build The Scoring Harness

**Files:**
- Modify: `scripts/evaluate-ai-strategist-conversations.ts`
- Test: `tests/ai-strategist-playground.test.ts`

- [ ] **Step 1: Write failing tests for scoring**

Add tests for expectation checks: exact action/task/stage/workflow/model, no recommendations, must mention, must not mention, warnings mention, final prompt mention, and selected model preservation.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-playground.test.ts
```

Expected: fail because the generic scorer is not implemented.

- [ ] **Step 3: Implement JSON-driven scoring**

Update the runner to:
- load `conversation-scenarios.json`
- execute turns sequentially
- preserve conversation state
- support `pickTier`, `selectedModel`, `selectedWorkflow`, `uploadedAsset`, and `currentPrompt`
- produce per-turn pass/fail issues
- map each failure to the scenario `category`

- [ ] **Step 4: Verify pass**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts
```

Expected: `Overall: PASS`.

### Task 3: Add Report Output

**Files:**
- Modify: `scripts/evaluate-ai-strategist-conversations.ts`
- Create: `docs/ai-strategist/evals/README.md`

- [ ] **Step 1: Add report options**

Support:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts --json-output .tmp/ai-strategist-eval/latest.json --markdown-output .tmp/ai-strategist-eval/latest.md
```

- [ ] **Step 2: Add documentation**

Document the workflow:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts --case pricing
```

- [ ] **Step 3: Verify report generation**

Run the command with both output flags and inspect that the report includes pass rate, failed scenarios, categories, and assistant message excerpts.

### Task 4: Validate Full AI Strategist Suite

**Files:**
- Modify as needed based on failures.

- [ ] **Step 1: Run the conversation matrix**

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts
```

- [ ] **Step 2: Run AI Strategist tests**

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/ai-strategist-knowledge-llm.test.ts tests/ai-strategist-playground.test.ts tests/ai-strategist-engine-knowledge.test.ts tests/ai-strategist-knowledge.test.ts tests/ai-video-strategist-api.test.ts
```

- [ ] **Step 3: Run repo checks**

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

- [ ] **Step 4: Commit**

```bash
git add docs/ai-strategist/evals docs/superpowers/plans/2026-05-23-ai-strategist-conversation-eval-loop.md scripts/evaluate-ai-strategist-conversations.ts tests/ai-strategist-playground.test.ts
git commit -m "test: automate strategist conversation eval loop"
```

