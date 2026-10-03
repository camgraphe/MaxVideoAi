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

- [x] Inspect model-guidance, recommendation and capability owners and tests.
- [x] Add behavior tests for the three editorial levels, validity/freshness/provenance, explicit requests and capability filtering.
- [x] Implement a shared validated policy and expose it in Studio/MCP facts without changing model publication or prices.
- [x] Extract/refresh director instructions for general creative work, informed recommendations, canonical live quotes and actual UI help. No mandatory recipe, no static price/model list in the prompt.
- [x] Run focused model/director/MCP tests and record results.

## Task 2 — Request reliability and English errors (agent)

- [x] Extend tests/studio-image-conversation-hook.test.ts for duplicate submission, initial loading and locale-safe errors/recovery.
- [x] Update only useImageConversation and focused error presentation helpers; keep wire/storage/quote identities compatible.
- [x] Expose loading state and accept optional locale (English default); parent passes the active locale.
- [x] Verify existing pending/quote lifecycle tests and focused hook tests.

## Task 3 — Studio visual and interaction finish (parent)

- [x] Capture baseline using the existing authenticated disposable browser integration.
- [x] Add route-local welcome, help and rich reply components, conditional suggestions and focus-safe help; keep StudioImageConversation orchestration focused.
- [x] Replace decorative columns with clear centered hierarchy, preserve theme tokens, add accessible mobile navigation and a jump-to-latest control.
- [x] Add timeline collapse with retained state and edit/export access; retain existing populated timeline behavior.
- [x] Verify keyboard/IME/composer, disclosure/focus, pending/empty/error and both themes in browser. Store screenshots locally.

## Task 3b — Reachable projects entry and read-only pricing

- [x] Add gated primary conversational project creation with stable idempotent retry and retained classic Canvas entry.
- [x] Route connected projects to the appropriate surface while preserving media handoffs and local projects.
- [x] Expose a read-only exact canonical image/video price estimate through the existing director tool loop, with no quote/payment side effects.
- [x] Ensure Studio catalog and estimate modes match current executable Studio authority; preserve MCP mode coverage.
- [x] Test project creation/retry/routing, canonical price changes, owned references and unsupported modes.

## Task 3c — Interactive reference workspace

- [x] Add retained collapsible media shelf, mobile compact mode, file drops and private owned previews.
- [x] Bind friendly drag/keyboard/touch mentions to exact attached IDs, preserving retries, renewals and scoped history.
- [x] Add full-size image inspection, focus restoration and manual video/audio playback.
- [x] Remove response pictogram and refine reply typography; preserve drafts and account/project isolation.
- [x] Cover late-history alias collisions, exact restoration, upload failures, disabled media and mobile behavior.

## Task 4 — Integration and review

- [x] Review agent diffs and run affected contracts together.
- [x] Run test:editor, qa:editor (avoid redundant suite repeats after a passed unchanged suite), lint:exposure and diff checks.
- [x] Run connected conversation and export browser tests against a committed snapshot, including mobile/theme recovery.
- [x] Perform fresh branch review, fix material findings, update engineering documentation and acceptance ledger.
- [x] Leave a concrete local preview and concise release notes for user review. Do not deploy.

## Ledger

- Initial state: clean isolated branch at 6be8e9283; dependencies installed offline from lockfile.
- Scope ruling: carte blanche supersedes intermediate skill approval gates. Production approval remains required.
- Pricing ruling: improve recommendation and presentation, never commercial values or formula owners.
- Research: Higgsfield public skill v0.13.0 explicitly defaults video to Seedance 2.5 and keeps many models for explicit/specialist requests; useful precedent for editorial levels, not independent proof of comparative quality. Source https://raw.githubusercontent.com/higgsfield-ai/skills/main/higgsfield-generate/SKILL.md, consulted 2026-10-03.
- UI/reliability commit a08c5d49d: five composer/reply tests and 37 hook/lifecycle checks passed; connected Chromium test passed with PostgreSQL 17, including help focus, timeline collapse, saved trim/volume, library, mobile and both themes. Baseline and revised screenshots are in output/studio-creative-workspace/.
- Integration finding: the projects entry did not expose conversational Studio, and the director lacked a side-effect-free price inquiry. Task 3b resolves those gaps within existing gates and pricing ownership. No gate is enabled by this work.

- Final editor QA at a4f3b2519: 802 tests, 801 passed, one pre-existing skipped, zero failures; TypeScript and lint pass (seven native-image warnings, no errors).
- Connected conversation browser passes Chromium and Firefox at a4f3b2519. WebKit found click/focus behavior specific to Safari; explicit trigger restoration fixed in e5e9f02b7 and its full browser scenario then passed. The scenario covers real private playback, edits/reload, media mentions, mobile/image enlargement and canonical project creation.
- Connected export quote browser scenario passed; model registry projections and exposure checks passed. No production calls, paid media generation or export worker runs were made.
- Fresh independent reviews found and fixed draft replacement, late-history label collision, pending-label restoration, disabled-media attachment mismatch and Safari focus return. Final reviewed implementation has no remaining P1/P2 findings. Artistic judgment remains outside deterministic fixtures.
- Final MCP alignment at 48549b73f: 19 focused tests passed; 70 offline tool-selection fixtures and 39 policy checks passed. No real-host qualification is claimed.
- Visible authenticated local preview opened from product source 3e9232601, using owned disposable data and repository sample media. Sixteen empty/populated, Charcoal/Olive captures at 320/390/768/1440 pixels passed without page exceptions. Final visual review confirms narrow-screen starters fit and the main media action remains visible beside the open timeline. Preview launch instructions and captures are under output/studio-creative-workspace; production remains untouched.

## Visual correction after Adrien’s review

- [x] Restore the earlier constellation intent: protected centered chat, bounded asymmetric references, contextual controls and reduced-motion support.
- [x] Replace onboarding cards with quiet text starts; center the compact timeline and show its inspector only after explicit clip interaction.
- [x] Keep private preview access, exact mentions, keyboard/touch alternatives and narrow-screen overflow working; preserve real media ownership.
- [x] Rerun editor QA with bounded PostgreSQL concurrency: 801 passed, one existing skip. Verify Chromium/Firefox/WebKit and capture both themes at 320/390/768/1440.
- [ ] Leave the final motion-enabled local preview open after the mobile selection refinement.
