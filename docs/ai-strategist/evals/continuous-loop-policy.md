# AI Strategist Continuous Evaluation Policy

## Goal

The continuous loop improves the internal MaxVideoAI Strategist by testing realistic conversations, fixing the highest-impact issue, committing, and repeating.

## Language Mix

- English is the primary product and QA language.
- Final generated creative prompts should default to English.
- The assistant may answer site/help questions in the user's language when that improves clarity.
- Multilingual input should not break routing, pricing answers, or context memory.

## User Realism

Scenarios must include:

- greetings and vague openers;
- users who do not know model names;
- users who ask price before prompt creation;
- users who ask examples before paying;
- typo-heavy and incomplete messages;
- duration, format, budget, and model changes after confirmation;
- users who ask the assistant to choose;
- uploaded product/person/reference asset cases;
- model capability questions;
- prompt paste and prompt improvement flows.

## Critical Failures

These must be fixed before continuing:

- wrong task routing for pricing, examples, upload, or prompt edit;
- lost previous brief or selected model;
- prompt generated before confirmation;
- visible person/reference safety warning missing;
- product logo/text warning missing;
- response says or implies generation or credits were used;
- debug/internal terms leaked to the user;
- English user receives an unrelated language by default.

## Stop Criteria

The loop can pause when:

- deterministic eval suite passes three clean runs in a row;
- targeted AI Strategist tests pass;
- frontend lint passes;
- exposure lint passes;
- `git diff --check` passes;
- no critical judge issue remains.

## Commit Rule

Every successful correction loop should commit with a focused message:

- `test: add strategist conversation scenarios`
- `fix: route strategist pricing follow ups`
- `fix: preserve strategist model selection context`
- `fix: improve strategist product help answer`
