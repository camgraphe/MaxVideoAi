# Character library, looks and Recast handoff implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Save named characters durably, generate and retain identity-bound looks, and open either image directly in Recast.
**Architecture:** Account-owned PostgreSQL records reference verified completed Character Builder outputs and their server snapshots. A saved identity anchors the existing image generation pipeline. UI library, save dialog and Recast handoff are colocated, account-scoped consumers; no second generation pipeline.
**Tech Stack:** Existing Next.js, React, SWR, PostgreSQL 17, TypeScript; no new dependencies.
**Spec:** `docs/redesign/2026-11-03-character-studio-usability-audit.md`, P0 identity/looks/direct handoff, explicitly approved for implementation in the current conversation.

## Global Constraints

- Same branch `codex/character-studio-v2`; no production writes or deployment.
- New records require authenticated ownership of the exact completed output; client snapshots and thumbnails are not trusted.
- No schema creation during API reads; migration and explicit bootstrap own DDL.
- Identity remains fixed in New look. Hair, clothes, accessories and scene may change.
- Recast receives the exact original image. Existing video/prompt remain; actual paid Recast generation is out of this slice.
- EN/FR/ES copy, existing account/request guards, no fake successful persistence when the database is absent.

## Review Focus

- Cross-account IDs and exact image URL substitution must fail without exposing records.
- Retried saves must not duplicate characters/looks, including concurrent requests.
- Delayed saves/generations and account changes must not attach a result to the current wrong character.
- Reload and historical settings reuse must preserve the original character context.
- Recast transfers must replace only the portrait, revoke only local blob URLs, and preserve the source video/prompt.

### Task 1: Durable library and API

**Files:** `frontend/types/character-studio.ts`; `neon/migrations/93_character_studio.sql`; `frontend/server/character-studio/{store,source,http}.ts`; `frontend/app/api/character-studio/characters/route.ts`; `[characterId]/route.ts`; `tests/character-studio-library-postgres.test.ts`; explicit schema bootstrap.
**Interfaces:** `listStudioCharacters(userId, before?) -> {characters,nextCursor}`; `getStudioCharacter(userId,id) -> StudioCharacter`; `saveStudioCharacterOutput(userId,{name,jobId,imageUrl}) -> {character,kind}`; `renameStudioCharacter(userId,id,name)`.
`StudioCharacter` has id/name/identity/looks/createdAt. `StudioImage` has jobId/imageUrl/thumbUrl/settingsSnapshot; a look adds id/name/createdAt. Saving a job with a stored builder.characterId attaches a look to that owned identity, not a new character.

- [x] Write PG17 tests: owned completed output succeeds; foreign, pending, hidden and mismatched URL fail; stored snapshot wins; duplicate save is idempotent; same output cannot attach to a different identity; rename/list remain scoped.
- [x] Run `tsx --tsconfig frontend/tsconfig.json --test tests/character-studio-library-postgres.test.ts`; expect failure before implementation, then pass after schema/store/routes.
- [x] Add bounded GET/POST/PATCH routes, private no-store responses, migration/bootstrap and server-derived media identity.
- [x] Commit tested persistence slice.

### Task 2: Identity-bound generation and draft recovery

**Files:** `frontend/src/lib/character-studio-look.ts`; request/state/snapshot types and existing sanitizer/snapshot/runner; `frontend/server/character-studio/look.ts`; `tests/character-studio-look.test.ts`.
**Interfaces:** `buildStudioLookDraft(previous, character)` initializes a look with the exact saved identity; `bindStudioLookRequest(input, character)` enforces identity traits and references server-side. Optional `characterId` travels through request, builder snapshot, drafts and settings reuse.

- [x] Write tests covering stale identity/photo overrides, mutable clothing/hair/scene, strict identity reference, snapshot round trip, resetting to a new character, preserved completed runs.
- [x] Watch tests fail, implement pure transitions plus owned server lookup before generation, rerun focused tests.
- [x] Commit tested identity contract.

### Task 3: Saved library, save dialog, look editor and Recast handoff

**Files:** colocated `CharacterStudioLibrary`, `CharacterStudioSaveDialog`, `CharacterStudioWorkspaceView`, `useCharacterStudioLibrary` and copy; existing result cards/gallery/composer/Recast/workspace; architecture/account/UI tests.
**Interfaces:** Results expose Save character/look and Recast actions. Library exposes New look and Recast for identity/looks. Parent owns Recast image selection with a fresh transfer id; Recast remains mounted between modes and receives `selection`.

- [x] Add integration tests for result-specific save context, delayed/account-switched requests, persisted new-look context and Recast portrait/video preservation.
- [x] Extract workspace presentation to keep the orchestrator bounded, update architecture contracts, implement named save dialog with keyboard handling, paginated library and locked-identity look mode.
- [x] Verify real rendered empty/error/loading states and desktop/mobile navigation via CUA; use test fixtures only in automated tests for successful save/generation states.
- [x] Run focused suites, TypeScript, lint, exposure and diff checks. Document migration and local/provider verification limits.
- [x] Fresh-context review of the finished change, fix important issues, commit final slice on the same branch.

## Delivery evidence

Implemented in `18c6a4dde` and `6bcdfa41d`, followed by the review race fixes.
The independent review identified two important same-account draft races. Four
workspace regressions reproduced them before the fix and pass afterwards; the
focused suite totals 63 passing tests. Draft loads/uploads now share an intent
revision; completed generation jobs and durable saves keep account scope.

Decisions: tasks 1/2 shipped together because they share the optional characterId
contract; list/detail pages are bounded to 12/24 items; layout, overlays and draft
transitions were extracted to preserve the existing orchestrator size contract.
The tradeoffs are a coupled backend commit, additional pagination requests and
small component interfaces. Explicit approval of this implementation slice
allowed native execution without another design confirmation.

No minor findings were deferred. Actual Recast generation and billing, provider
fidelity canaries, hosted migration/live authenticated persistence, and broader
audit enhancements (undo, catalogue additions and example videos) are outside
this delivery. Local browser QA covers navigation/loading/unavailable states;
successful persistence was verified on disposable PG17 and client fixtures.
Migration 93 and a configured application database are prerequisites for live
saving. The branch/worktree remain in place without push, merge or deployment.
