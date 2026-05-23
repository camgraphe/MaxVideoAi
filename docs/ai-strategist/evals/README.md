# AI Strategist Conversation Evals

This folder contains the local evaluation loop for the internal MaxVideoAI AI Video Strategist.

The goal is to make strategist quality measurable before adding public UI, RAG, or wider production exposure.

## What This Evaluates

The deterministic pass simulates customer conversations through the existing playground pipeline:

```text
raw user message
-> conversation planner
-> brief normalization
-> deterministic routing
-> recommendation / help / prompt context
-> prompt writer fallback or local LLM
-> validation and UI action preview
```

It checks whether the strategist:

- recognizes site, pricing, workflow, model, and creative requests
- preserves conversation state across follow-ups
- recommends models only when useful
- redirects to the correct MaxVideoAI area without auto-navigation
- keeps uploaded person and product references distinct
- waits for confirmation before prompt generation
- keeps safety constraints: no generation, no credit spend, no publishing

## Run The Deterministic Regression Pass

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts
```

Run one category or scenario:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts --case pricing
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts --case uploaded-person
```

Write reports:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts \
  --json-output .tmp/ai-strategist-eval/latest.json \
  --markdown-output .tmp/ai-strategist-eval/latest.md
```

## Optional Live LLM Pass

Use this only for local development with configured Vertex/Gemini env vars:

```bash
npx tsx --tsconfig frontend/tsconfig.json scripts/evaluate-ai-strategist-conversations.ts --live
```

The live pass still does not run generation, spend credits, publish anything, or apply UI actions.

## Failure Categories

Each scenario has a category so failures point to the owner layer:

- `routing_error`: conversation planner or intent router
- `state_memory_error`: follow-up handling and conversation state merge
- `knowledge_gap`: structured tools, model catalog, engine catalog, or future RAG
- `bad_answer_copy`: answer template or prompt writer wording
- `prompt_generation_issue`: brief completion, prompt context, prompt writer
- `model_recommendation_issue`: model catalog or recommendation rules
- `pricing_or_catalog_gap`: engine catalog pricing reader
- `site_or_navigation_help`: site navigation knowledge
- `asset_reference_routing`: uploaded image/product/person handling
- `language_issue`: brief refinement or response language behavior
- `safety_or_funnel`: safety and acquisition funnel guidance
- `ui_flow_issue`: admin playground chat UI

## Long-Term Agent Improvement Loop

Use this loop for larger improvement sessions:

```text
1. Add or update scenarios in conversation-scenarios.json.
2. Run the deterministic pass.
3. Fix failures by category in the owner layer.
4. Run focused scenario with --case.
5. Run full deterministic pass.
6. Run optional --live pass for naturalness and prompt-writing quality.
7. Commit the scenario plus the fix together.
```

Future upgrades should add:

- an LLM-as-judge for naturalness and funnel quality
- richer site/product knowledge sources behind explicit tools
- acquisition-funnel scenarios such as pricing objections, comparison intent, examples discovery, and generator onboarding
- trend reports that compare pass rate and failure categories over time
- CI gating for deterministic regressions while keeping live LLM evaluation local-only
