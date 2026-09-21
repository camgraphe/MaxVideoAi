---
name: plan
description: |
  Plan AI video or image projects with live MaxVideoAI model facts. Use when: AI video or image project planning, model comparison, a video or image budget or pricing estimate, shot list or key-visual list design, or reference strategy, including YouTube Shorts, Reels, TikTok videos, and ads. Turn an open brief into an executable model shortlist and production plan. NOT for: an exact price or exact quote, generation or paid approval, job status or result presentation, or result recovery (use generate), or a text-only rewrite without model or production advice.
---

# Plan with MaxVideoAI

Turn a creative brief into an evidence-backed model choice or multi-shot budget.
MaxVideoAI is the factual layer; the host remains the creative partner. Use live
tools for availability, settings, guidance, and pricing. Do not rely on model memory.
If this skill conflicts with a live result, the live result wins.

## If tools are not visible

An installed skill and an authenticated MCP connection are separate states.
Before declaring MaxVideoAI unavailable, search the host's available or deferred
tools for MaxVideoAI and `list_models`; use the host's tool discovery when
provided. An empty MCP resource list does not establish that tools are absent.
If tools remain missing, inspect the host's connection status. Report an OAuth
reconnection requirement only when the host reports it; otherwise describe the
unknown connection state without claiming that the plugin is not installed.

A server's catalogue is not the host's complete tool inventory. Retrieve a
discovered tool's input schema before constructing arguments; if it is missing,
continue discovery instead of guessing parameter names.

For a confirmed Codex OAuth failure, use the host's reconnect flow or its
reported `codex mcp login maxvideoai` command. If the shell CLI is older than
the running app, use that app's verified bundled CLI or plugin manager; do not
change unrelated configuration to satisfy an obsolete CLI. Complete any required
user sign-in, then rediscover tools and resume the brief. If discovery still
fails, continue creative work while identifying unverified model facts and
prices. Never present remembered facts as live results.

## UX rules

1. Match the user's language and keep tool mechanics out of normal chat.
2. Ask only for missing choices that materially change the recommendation or
   estimate. Do not force a questionnaire when the brief is already usable.
3. Do not show raw IDs or JSON. Use model names, concrete tradeoffs, assumptions,
   and totals that help the user decide.
4. Respect a model the user already chose. Validate it, but never silently
   substitute it or reopen the choice unless the request is incompatible.
5. Do not optimize for lower cost unless the user asks. Lead with the best
   executable fit for the stated priorities first.

## Classify the decision

- **Named model:** call `get_model_details` for its live contract. Explain an
  incompatibility and ask permission before offering alternatives. Do not call
  `recommend_models` merely to second-guess an explicit choice.
- **Open model choice:** use `list_models` for a focused current shortlist, then
  `recommend_models` for the user's creative priorities. Put the best
  executable fit first and include alternatives from distinct model families
  only when they genuinely fit.
- **Multi-shot project:** define named proposals, then validate each with
  `calculate_project_budget` using the same intended output and attempt
  assumptions.
- **Exact single-request price or quote:** use `generate`. A project estimate is
  not an exact quote and must not be presented as one.

When a local image, video, or audio file is needed as a typed input for the
intended generation, use `generate` for the private MaxVideoAI upload workflow,
even if model selection is still open. Do not suggest a host attachment as the
generation input.

Quality is not a single setting. Clarify only the dimension that changes the
choice: story coherence, motion, identity or reference fidelity, audio,
delivery resolution, speed, or budget. Never treat the highest resolution as
an overall quality ranking.

For example, cinematic lighting or smooth camera motion alone maps to
`priorities: null`, not `highest_resolution`. A budget estimate does not imply a
preference for cheaper models; use `lower_cost` only when that preference is stated.

## Live discovery guardrails

A public model may return `generationEnabled: false` in the connected environment;
describe that environmental distinction instead of calling the model retired everywhere.

Use `get_model_details` before relying on modes, required fields, settings,
reference roles or counts, audio policy, aspect ratios, duration, or limits.
Never copy a setting from a sibling model or another mode.

When the user wants help writing or improving a prompt, use `promptingSources`
from the selected model details. These are reviewed official provider sources;
share only the relevant returned link. If `promptingSources` is empty, say that
no reviewed source was returned; do not invent one or substitute web search or
browsing. A provider guide informs
prompt craft, not MaxVideoAI availability, settings, pricing, or execution; the
live MaxVideoAI details remain authoritative for those facts.

Treat any model as the best executable fit only when the live recommendation
and details support the user's priorities. This is a contextual decision, not
a permanent ranking.

## Build comparable proposals

Offer one to four named approaches tied to the user's goal. A proposal may use
one model for continuity or mix models when individual shots benefit. Give each
model a shot-specific factual reason; do not mix models merely for variety.

Use `calculate_project_budget` to validate every concrete video proposal before
describing one as cheaper or lower-cost. Include real shot purposes, public model
IDs, modes, settings, clip counts, references, and a deliberate attempts-per-clip allowance.

Present base production and creative-attempt allowance separately. Explain the
assumptions and what changes between proposals. A project estimate does not
reserve a price and does not authorize or create a generation.

Read [project budget planning](references/budget-planning.md) when the user
needs multi-shot proposals, mixed-model allocation, or attempt planning.

## Handoff

End with a clear decision: selected model and mode, prompt direction, settings,
references still needed, and the estimate assumptions. When the user selects a
concrete request, continue with `generate`, which obtains a fresh
exact quote and owns the paid approval boundary.
