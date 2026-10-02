# Studio creative workspace implementation plan

> Execution: independent server guidance and client reliability tasks use the dispatching-parallel-agents skill; the parent implements UI and integration. User carte blanche covers design and implementation decisions. Review before production.

**Goal:** Deliver a polished English-first workspace for flexible creative work, with editorial model recommendations and truthful live pricing.

**Spec:** ../specs/2026-10-03-studio-creative-workspace-design.md

**Architecture:** Existing canonical project, quote, timeline and export owners remain authoritative. Presentation is route-local; shared model guidance is data-driven and validated.

**Tech:** Next.js, React, CSS modules, TypeScript, Node test runner, Playwright, disposable PostgreSQL.

## Global constraints

- Worktree: codex/studio-creative-workspace, based on 6be8e9283.
- English first; preserve French behavior and app theme preference.
- No production, pricing policy, model publication, credentials, paid generation or real export changes.
- Git commands use GIT_WORK_TREE="$PWD" to avoid inherited checkout configuration.

## Review focus

- Stale reads after account/project change must not expose a previous conversation.
- Rapid keyboard submission must start at most one request; draft text must remain usable.
- A preferred model incompatible with references must not win simply through editorial weight.
- Quote values and expiry must remain canonical and explicit; accepted work must recover without another purchase.
- Small viewports and collapsed panels must retain navigation, chat, keyboard focus and timeline edits.

## Task 1 — Shared editorial guidance and creative director (agent)

- [ ] Inspect model-guidance, recommendation and capability owners and tests.
- [ ] Add behavior tests for the three editorial levels, validity/freshness/provenance, explicit requests and capability filtering.
- [ ] Implement a shared validated policy and expose it in Studio/MCP facts without changing model publication or prices.
- [ ] Extract/refresh director instructions for general creative work, informed recommendations, canonical live quotes and actual UI help. No mandatory recipe, no static price/model list in the prompt.
- [ ] Run focused model/director/MCP tests and record results.

## Task 2 — Request reliability and English errors (agent)

- [ ] Extend tests/studio-image-conversation-hook.test.ts for duplicate submission, initial loading and locale-safe errors/recovery.
- [ ] Update only useImageConversation and focused error presentation helpers; keep wire/storage/quote identities compatible.
- [ ] Expose loading state and accept optional locale (English default); parent passes the active locale.
- [ ] Verify existing pending/quote lifecycle tests and focused hook tests.

## Task 3 — Studio visual and interaction finish (parent)

- [ ] Capture baseline using the existing authenticated disposable browser integration.
- [ ] Add route-local welcome, help and rich reply components, conditional suggestions and focus-safe help; keep StudioImageConversation orchestration focused.
- [ ] Replace decorative columns with clear centered hierarchy, preserve theme tokens, add accessible mobile navigation and a jump-to-latest control.
- [ ] Add timeline collapse with retained state and edit/export access; retain existing populated timeline behavior.
- [ ] Verify keyboard/IME/composer, disclosure/focus, pending/empty/error and both themes in browser. Store screenshots locally.

## Task 4 — Integration and review

- [ ] Review agent diffs and run affected contracts together.
- [ ] Run test:editor, qa:editor (avoid redundant suite repeats after a passed unchanged suite), lint:exposure and diff checks.
- [ ] Run connected conversation and export browser tests against a committed snapshot, including mobile/theme recovery.
- [ ] Perform fresh branch review, fix material findings, update engineering documentation and acceptance ledger.
- [ ] Leave a concrete local preview and concise release notes for user review. Do not deploy.

## Ledger

- Initial state: clean isolated branch at 6be8e9283; dependencies installed offline from lockfile.
- Scope ruling: carte blanche supersedes intermediate skill approval gates. Production approval remains required.
- Pricing ruling: improve recommendation and presentation, never commercial values or formula owners.
- Research: Higgsfield public skill v0.13.0 explicitly defaults video to Seedance 2.5 and keeps many models for explicit/specialist requests; useful precedent for editorial levels, not independent proof of comparative quality. Source https://raw.githubusercontent.com/higgsfield-ai/skills/main/higgsfield-generate/SKILL.md, consulted 2026-10-03.
