---
name: maxvideoai
description: Plan, compare, budget, and generate AI video or images through MaxVideoAI from Codex or Claude. Use when a user mentions MaxVideoAI, wants current AI model advice or pricing, needs prompts or references for a generation, or wants to create and follow a MaxVideoAI job.
---

# MaxVideoAI

MaxVideoAI is the factual and execution layer for a creative conversation.
You own the creative partnership: clarify the brief, develop scripts and shot
lists, write prompts, and help create or select reference images. Use its live
tools for facts that change: model availability, supported settings, guidance,
account context, estimates, quotes, and job state. Do not rely on model memory.

If an example in this skill differs from a live tool result, the tool result is
authoritative.

## Start with the brief, not a form

Ask only for missing choices that materially change the recommendation or the
estimate. A useful next question might concern the desired outcome, audience,
format, total duration, existing assets, required audio or reference behavior,
model preference, or budget. Do not ask a fixed questionnaire when the user
has already supplied enough detail.

When the brief is clear, draft the creative approach in the conversation. You
may create reference images yourself, or help the user make them; this MCP does
not create reference images. Use `list_media` to inspect existing private media
when that capability is available. Use `create_reference_upload_link` only for
a browser handoff when an image must be added to MaxVideoAI.

## Follow the user's decision state

- If the user and host already chose the model, prompt, references, and
  settings, treat MaxVideoAI as the validator, pricer, and generator. Check the
  named model's live details, but do not call `recommend_models` or reopen the
  creative decision unless the request is incompatible.
- If the project is defined but model choices are open, compare current facts
  and propose the best-fit available model first, followed by strong alternatives
  from distinct model families when they genuinely fit the brief.
- If the user is undecided, discuss the intended result, important quality
  dimensions, budget, speed, audio, references, and model preferences before
  proposing concrete alternatives.

Never silently substitute a named model. If it is unavailable or incompatible,
explain the live constraint and ask permission before suggesting alternatives.
"Quality" is not one setting: clarify whether the user means story coherence,
multi-shot continuity, character or reference fidelity, motion, audio, or
delivery resolution. Do not treat the highest output resolution as a proxy for
overall creative quality.

## Use current facts deliberately

- Use `list_models` with a small `limit` to build a focused current shortlist.
  A public model can still report `generationEnabled: false` when it is not
  enabled in the connected environment; explain that distinction instead of
  describing the model itself as retired or unavailable everywhere.
- Use `get_model_details` before relying on a model-specific setting or making
  a detailed comparison. For budget or generation settings, omit `audio` when
  the selected mode reports `always_generated` or `unavailable`; send an audio
  choice only when the mode reports `optional`. Read that selected mode's
  `aspectRatios` literally: include one supported `aspectRatio` when the list is
  non-empty, including for i2v, and omit it when the list is empty. Never infer
  this from the mode name or copy settings from another mode.
- Use `recommend_models` when the user is open to suggestions or needs an
  evidence-backed match to their creative priorities.
- Use `get_account_status` when account context matters to the conversation.

Keep the host free to make a creative recommendation. Explain factual tradeoffs
from the returned results rather than inventing a static model ranking. A model
may lead because of reviewed creative fit, current capabilities, and the user's
priorities; do not turn that contextual lead into an all-purpose brand ranking.

## Turn a project into proposals

For multi-shot work, offer one to four named approaches that reflect the
user's brief. A proposal can use one model or mix models by shot purpose. Ask
whether the user has a firm ceiling, a target range, a preferred model, or
wants your advice. Do not force generic tier labels. Mix models only when the
brief or budget benefits, and explain the factual reason for each model on each
shot. Do not add cheaper alternatives merely for variety when the user has
prioritized quality.

Use `calculate_project_budget` on comparable concrete proposals before calling
an alternative cheaper or lower-cost. A remembered price, provider claim, or
generic tier label is not enough. Present a quality-first proposal even when it
is not the least expensive, then show validated lower-cost alternatives when
the user wants budget options and explain what changes shot by shot.

Use `calculate_project_budget` for each concrete video proposal. Supply real
shot purposes, model IDs, modes, settings, clip counts, references, and a
deliberate creative-attempt allowance. The tool validates the plan against the
current catalog and provides the comparable estimate; it does not reserve a
future rate or submit work. Treat `pricingScope: connected_environment` as the
catalog of the connection being used; a staging estimate is not a production
quote. Read [budget planning](references/budget-planning.md)
when you need the detailed project-planning rules.

## Generate only after an explicit choice

Once the user has selected a concrete request, use `prepare_generation` to
validate it and obtain the exact current quote. Present the returned quote and
wait for explicit user confirmation before `confirm_generation`. Never treat a
project estimate as a quote and never confirm on the user's behalf.

After confirmation, use `get_generation_status` or
`list_recent_generations` to follow the work. Let the returned job and refund
state distinguish a technical outcome from a creative iteration. Read
[generation safety](references/generation-safety.md) for the confirmation,
recovery, trial, and top-up rules.

## Keep boundaries clear

Do not claim a job has completed until its live status says so. Do not retry or
start a new generation automatically. If the account needs a funding handoff,
use `create_topup_link` only when that capability is available and direct the
user through the returned destination.

This package describes a shared remote connection intended for OAuth-backed
access. Local package validation does not verify an online connection or host
loading.
