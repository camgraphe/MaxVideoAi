# MCP Audio Site Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Let the OpenAI channel explicitly reuse the website Audio execution path without a mandatory permanent worker.

**Architecture:** Select site/worker execution centrally. Reuse the canonical executor and existing financial confirmation unchanged; keep worker-mode defaults compatible.

**Tech Stack:** TypeScript, existing Next.js routes, PostgreSQL17 disposable tests.

**Spec:** `docs/superpowers/specs/2026-11-13-mcp-audio-site-runtime-design.md`

## Global Constraints

- Local changes only; no deployment, secret access, providers, paid tests or activation.
- No price/provider/pack changes; preserve exact quote/owner/replay rules.
- Existing default remains worker; explicit site mode is prepared, not enabled.
- Public candidate f39ea636 and PR650 stay available unchanged.

## Review Focus

- An invalid execution-mode value must not expose the extended catalogue.
- A site quote must not be confirmable after switching execution mode.
- Site routing must not enqueue work that lacks a consumer.
- A repeated confirmation must not create a second job or supplier attempt.
- Hosted timeouts are an outstanding qualification, not solved by this selector.

### Task 1: Explicit execution mode and canonical adapter

**Files:** modify `frontend/src/server/agent-api/audio-capabilities.ts`, `frontend/src/server/mcp/server.ts`; create `frontend/src/server/agent-api/audio-execution.ts`; test `tests/mcp-audio-site-runtime.test.ts` and existing Audio suites.

**Interfaces:** `getMcpAudioExecutionMode(env): 'site'|'worker'|null`; `createMcpAudioExecutionDependencies(env): Pick<ConfirmAudioGenerationDependencies,'executeRun'|'enqueueRun'>`. Site returns the canonical execute function without enqueue; qualified worker adds the canonical enqueue function. Mode changes affect catalogue revision, not price or variants.

- [x] Add failing catalogue and actual dependency-selection tests for site, worker, closed and invalid configuration; require real server wiring.
- [x] Run `TSX_TSCONFIG_PATH=frontend/tsconfig.json node --import tsx --test tests/mcp-audio-site-runtime.test.ts`; expected assertion failures for missing mode.
- [x] Implement mode selection and wire the thin MCP adapter.
- [x] Run site/catalogue/service/architecture tests and disposable PG17 reservation/replay/dispatch suites; expected pass, no provider calls.
- [x] Run MCP client checks, TypeScript, frontend lint, exposure and diff checks.
- [x] Document mode, same per-use costs and hosted duration qualification; get independent review, fix substantive findings, commit locally without push.

### Task 2: Activation dossier correction

**Files:** root worktree `docs/operations/openai-directory/` and a new local decision receipt, preserving prior read-only evidence hashes.

- [x] Record 10+5 USD approval without approving a monthly service or production changes.
- [x] Replace the proposed mandatory worker step with the explicit site-mode candidate and its remaining hosted qualification.
- [x] Link local code/test evidence and distinguish previous PR status from the new local branch.
