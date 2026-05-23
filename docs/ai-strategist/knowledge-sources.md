# AI Strategist Knowledge Sources

Source of truth for the current non-RAG AI Strategist knowledge boundary.

## RAG Status

RAG is not connected yet. The strategist can answer from deterministic structured sources, but it must not claim it searched documents or private projects.

## Allowed Future RAG Sources

- Model docs under `docs/ai-strategist/models/`
- Workflow docs under `docs/ai-strategist/workflows/`
- Prompt structure docs under `docs/ai-strategist/prompt-structures/`
- Decision rules under `docs/ai-strategist/decision-rules/`
- Selected public site documentation approved for user-facing answers
- Selected public examples metadata approved for user-facing answers

## Excluded Until Explicitly Approved

- Private user projects
- Admin-only data
- Raw job prompts from other users
- Credentials, provider secrets, service account data, or provider internals
- Billing records or account-specific credit history unless explicitly provided by the authenticated app context

## Current Deterministic Sources

- `frontend/lib/ai-strategist/model-catalog.ts`
- `frontend/lib/ai-strategist/workflow-rules.ts`
- `frontend/lib/ai-strategist/prompt-structures.ts`
- `frontend/lib/ai-strategist/recommendation-rules.ts`
- `frontend/config/engine-catalog.json`
- `frontend/lib/ai-strategist/knowledge/site-navigation-knowledge.ts`
- `frontend/lib/ai-strategist/knowledge/examples-knowledge.ts`

## Safety Rules

- No generation is run by the strategist.
- No credits are spent by the strategist.
- No output is published by the strategist.
- No real generator UI action is applied by the strategist playground.
- Unknown or unavailable facts must be stated as unknown instead of invented.
