# Task 4 — persisted connected Studio montage

Status: **APPROVED_AND_QUALIFIED**. The server/MCP lot and the final connected client, local persistence boundary and creation UI have independent Approved reviews with no remaining Important finding. They pass the root-owned real-browser acceptance suites and the fresh general Studio suite. Public `studioMontageCreation` remains `false`, so this report does not announce a production launch.

The implementation is on `codex/studio-connected-editor` in the assigned dce6 worktree. No push, merge, deployment, paid generation, remote database, inherited database URL, `.env` edit or external storage request was performed. No subagent was spawned. The separate generation workspace and former Studio sources were not modified.

## Delivered contract

The UI route and MCP tool call the same server command, `createStudioMontageProject(actor, input)`. The authenticated owner is transport-derived and is never accepted from the business payload.

The strict version-1 input is:

```ts
{
  title: string;
  settings: {
    fps: 24 | 25 | 30 | 60;
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '21:9';
    resolution: '720p' | '1080p';
    audioMode: 'preserve' | 'mute';
  };
  clips: Array<{
    assetId: `ma_${string}`; // exactly ma_ + 32 lowercase hex characters
    sourceInFrame: number;   // non-negative integer
    durationFrames: number; // positive integer
  }>;
  idempotencyKey: string;
}
```

It accepts 2–12 caller-ordered occurrences and at most 180 seconds total. Only canonical owned, ready videos with server-stored measured duration facts qualify. URLs, owner IDs, project IDs, client snapshots and duration-like client fields are rejected by the strict schema. A repeated asset creates distinct clip occurrences but one project asset.

Both `POST /api/studio/montages` and MCP `create_studio_montage` return the same safe business value. HTTP wraps it as `{ok:true,montage}`, while MCP exposes the value as structured content:

```ts
{
  schemaVersion: 1;
  status: 'studio_project';
  persisted: true;
  title: string;
  projectId: string;
  sequenceId: string;
  revision: number;
  studioUrl: string;
  clipCount: number;
  totalFrames: number;
  totalSeconds: number;
  orderingBasis: 'caller_supplied';
}
```

The result contains no owner, original URL, signed URL or client-supplied media fact. The trusted Studio URL is returned only after the transaction commits. Expected MCP failures are mapped to actionable bounded codes instead of `INTERNAL_ERROR`: changed-payload idempotency conflict, missing/ineligible media, deleted replay target, disabled feature and temporarily unavailable schema.

`prepare_montage` remains the separate read-only planning operation with `persisted:false`. Its gate and behavior were not promoted to persistence.

## Durable model and transaction

Migration `42_studio_connected_montages.sql` is additive:

- `studio_projects.revision BIGINT NOT NULL DEFAULT 0`, constrained non-negative;
- `studio_projects.persistence_mode TEXT NOT NULL DEFAULT 'legacy'`, constrained to `legacy|connected`;
- `studio_project_commands`, with `user_id`, `command_kind`, `command_version`, `idempotency_key`, `request_hash`, `project_id`, `sequence_id`, `request_payload`, `safe_result` and `created_at`;
- unique receipt scope `(user_id, command_kind, command_version, idempotency_key)`.

Creation takes an owner/version/key advisory transaction lock, checks an existing receipt, resolves and locks every distinct media source and its related source job/output ownership, then writes the connected project, sequence and receipt in one transaction. A canonical SHA-256 covers the command kind/version and validated business payload, including clip order. Exact retry returns the original project at its current revision without resetting later edits. Changed content with the same key returns 409, owners have independent key spaces, and a deleted replay target returns 410 rather than being resurrected.

Every persisted occurrence stores immutable `montageSource` provenance: command kind/version, zero-based order, canonical asset ID, original `sourceInFrame`, original `durationFrames` and creation fps. Later UI trim edits may change timeline seconds, while the originating command remains unambiguous. The command receipt also keeps the exact validated `request_payload` and safe result.

Measured duration comes only from the qualified server media resolver. Flat historical/requested SQL durations and client workspace facts are not promoted to evidence. Known embedded-audio state is preserved; `mute` changes the clip mix explicitly; unknown audio remains unknown and no fabricated audio track is added.

Schema readiness is read-only. Missing migration 42 produces an explicit 503 and performs no DDL or partial write.

## Atomic connected workspace and legacy coexistence

The connected client reads `GET /api/studio/projects/:projectId/workspace`, which returns `{ok:true,project,sequences}` from one transaction under a shared parent lock. It does not combine independently timed project and sequence reads.

It saves through one aggregate CAS endpoint:

```ts
PUT /api/studio/projects/:projectId/workspace
{
  expectedRevision: number,
  snapshot: { name, canvasTemplateId, settings, workspaceState }
}
// { ok: true, projectId, revision }
```

The writer validates bounded graph/sequence/timeline structure before normalization, locks the parent and live sequences, compares the exact expected revision, writes project plus sequence set atomically, and increments once. Invalid values such as `nodes:[null]`, `edges:[null]` or `timelineItems:[null]` return 400 without a write. Unexpected database/storage details are hidden behind an opaque 500. A failure after an early sequence write rolls the whole transaction back.

All historical project and sequence POST/PUT/PATCH/DELETE writers take a parent lock inside their own transaction and refuse connected projects. This includes project creation with a caller-supplied existing ID. Their final guarded writes also preserve exact owner/project identity. Legacy projects retain their prior behavior.

The connected autosave queue has at most one request in flight, coalesces newer snapshots, advances only from acknowledged revisions and stops on 409. A disposed account/project scope ignores late responses and late baseline effects. Canonical snapshot fingerprints prevent hydration or signed-URL renewal from creating revisions. A stale draft retains its original base revision across repeated reloads and can never be silently relabelled to the server revision.

Connected drafts are stored under account plus project with `{dirty,revision,state}`. A conflict or 401/503/offline save remains a visible local draft and is never announced as server-saved. Reopening restores that exact draft; a stale one starts blocked with no PUT. `Reload server version` is the explicit destructive choice that discards it. Manual exit waits for a real ready acknowledgement and stays in Studio on conflict/unavailable/error.

Purely local projects carry an explicit cache-only `persistenceMode:'local-only'` provenance. It survives project and workspace normalization, permits a truthful local Projects exit without invoking a server writer, and is replaced by a server `legacy|connected` value only when that exact ID is returned authoritatively. A recovered server listing retains every authoritative row plus unmatched local-only projects while never promoting an unmarked historical project. A delayed listing response re-reads the current cache, so a local project created while that GET was in flight is not erased. Unresolved connected modes remain fail-closed; after an actual unavailable/not-found result, an existing local snapshot may exit locally without being inferred as legacy or written to the server.

An auth change without remount disposes the old queue, clears nodes, assets, sequences, timeline, title and transient private URLs immediately, ignores late old-account responses, then hydrates only the new scope. Both account A→B and signed-out transitions are covered in the same live document.

## Private original access

Connected persistence strips transient `mediaAccessUrl` and expiry fields. Canonical ref plus exact server-qualified original identity remain durable.

The client posts exact live video asset IDs to:

```ts
POST /api/studio/projects/:projectId/media-access
{ assetIds: string[] }
// { ok: true, projectId, assets: [{ assetId, url, expiresAt }] }
```

The server locks/revalidates the connected owner/project and accepts membership from the project bin or any live sequence occurrence. A historical receipt or dead snapshot does not grant access. Removal from the bin therefore keeps a still-used clip renewable; removal of its final live occurrence returns 404. Owned originals receive a five-minute GET signature without a download filename; qualified external originals preserve their exact semantics.

The browser renews before expiry or once after a playback failure, without changing trims, paused/play intent, playhead or source occurrences. Project-bin, active-timeline and all live-sequence refs are discovered client-side, so reopening a bin-removed clip still mounts its reader. Video originals are never used as `<img>` thumbnails; actual thumbnails remain supported and other videos show the placeholder.

## Ordered creation UI and publication gate

The Projects UI exposes `Create montage from media` only when the server-derived `studioMontageCreation` gate is true. The route uses the same feature-access function as MCP/HTTP. Publication remains false; the bounded local override requires non-production, `STUDIO_MONTAGE_LOCAL_ENABLED=true`, a loopback MCP resource and a request Host matching the configured MCP API host. Preview without that contract does not advertise a guaranteed503 action.

The modal lists real qualified library videos, marks media without a canonical ID/measured original duration ineligible, and owns an explicit ordered list. Add/repeat, move up/down, remove and exact frame trims work with pointer, touch and keyboard. Focus enters the title, is trapped, Escape closes before submission and focus returns to the trigger. During submission the entire intention is frozen and Escape/close are unavailable; a 20-second bounded timeout reports a retryable error while retaining the same idempotency key because the server may already have committed. Retrying unchanged content therefore finds the same receipt.

Current validation reasons are visible while Submit is disabled. Occurrences have contextual accessible group names (`Clip N — name`) and Add buttons name their media. On fps changes, the source start and end boundaries are converted separately, clamped to measured duration, and duration is recomputed from the converted endpoints. This prevents a valid half-frame-boundary trim such as 12+12@24fps on a one-second source becoming 26 frames at 25fps.

English, French and Spanish strings are provided by the Studio-local copy owner.

## Commits and provenance

The logical writer chain is:

- `20a181c35` — initial server/routes/migration/tests plus four root QA paths accidentally captured by a shared-index race. The exact 29-path provenance is preserved in `docs/engineering/studio-task4-integration-review.md`; history was not rewritten.
- `87919e9d7` — two whitespace-only follow-ups accidentally given the feature title.
- `1c41f3d16` — isolated shared MCP registration, schema, instructions, transport and publication flag.
- `cdb716027` — isolated MCP error adapter.
- `1c9eafa92`, `7cf6a5b57`, `de02e5825` — aggregate locks/CAS/atomic read, structural validation/provenance/opaque failures, and live-reference access plus exact legacy conflicts.
- `6fd412782`, `1e56fd2a5`, `704c9d974`, `909e37f60`, `4a72b3d04`, `139bf2e01` — connected hydration/autosave/private access, safe thumbnail projection, canonical no-write hydration, late-ACK isolation and actionable conflict UI.
- `c774f6a6e` — isolated strict ten-flag MCP release/preflight/support projection; both persisted and plan gates remain false.
- `89af69248`, `fa48e19b4`, `adfe2f29c` — ordered creation UI, frozen retry intention, visible validation/accessibility/endpoint-safe fps retime and bounded timeout.
- `bccd76266`, `77d05b569` — account/project-scoped recovery, truthful exit/auth purge/live media discovery and preservation of the stale draft base revision.
- `4a1d7499d` — one-line immutable queue binding required by the optimized-build lint gate.
- `6475a3d35`, `b2ee9f500` — unacknowledged-dispose and unresolved-project exit safety, independent retryable media-list failure, and preservation of the 500-line workspace composition boundary.
- `827241cf4` — stable dialog focus through a failed media-list retry, with a controlled React/JSDOM regression test.
- `bdc14614f`, `eb0c7755c`, `112ee3b28`, `18bf21cad` — explicit local-only persistence provenance, truthful no-writer exit, and full retention across later/delayed server listings and 404 recovery without weakening unresolved connected guards or truncating the authoritative forty-row list.

Root-owned QA, fixtures and evidence commits remain distinct where the original index race permitted. This report is documentation-only.

## Verification

All writer runtime commands used Node22. PostgreSQL commands prepend `/opt/homebrew/opt/postgresql@17/bin`. The two writer PG suites create unique socket-only disposable clusters, verify version, socket, `listen_addresses` and the exact `data_directory` before DDL, never read inherited `DATABASE_URL`, and tear down through failure paths.

### Core server writer suite

```sh
PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" \
TSX_TSCONFIG_PATH=frontend/tsconfig.json \
pnpm dlx node@22 --import tsx --test \
  tests/connected-montage-disposable-postgres.test.ts \
  tests/studio-montage-postgres.test.ts \
  tests/studio-montage-command.test.ts \
  tests/studio-montage-feature-access.test.ts \
  tests/studio-montage-builder.test.ts \
  tests/studio-connected-autosave.test.ts
```

Result: 25/25 passed. It includes real PG17 migration/idempotency/rollback/ownership/source-lock/CAS/legacy-writer races plus pure contract, mapping, autosave, draft, gate and UI-builder checks.

### Final architecture and pure contracts

```sh
NODE_PATH="$PWD/frontend/node_modules" \
TSX_TSCONFIG_PATH=frontend/tsconfig.json \
pnpm dlx node@22 --import tsx --test \
  tests/maxvideoai-editor-workspace-architecture.test.ts \
  tests/studio-montage-builder.test.ts \
  tests/studio-connected-autosave.test.ts \
  tests/studio-montage-command.test.ts \
  tests/studio-montage-feature-access.test.ts
```

Result: 58/58 passed on `b2ee9f500`.

The added dialog-focus regression then passed 1/1 on `827241cf4`, and its combined builder DOM/pure run passed 5/5. It covers failed listing, Retry, successful second listing, focus inside the unchanged dialog, Escape and return to the original trigger. The local-only cache/exit tests passed 11/11 on `eb0c7755c`; after review added the exact forty-server-plus-one-local boundary, the suite passed 12/12 on `112ee3b28`; after adding the delayed GET/current-cache boundary it passed 13/13 on `18bf21cad`. The adjacent sequence and autosave pair had passed 26/26 on the first provenance commit.

Targeted ESLint for the final connected persistence, project reconciliation and montage-builder files and `pnpm --prefix frontend exec tsc --noEmit` passed through the final product edit `18bf21cad`. Locale JSON parsing passed after the locale edits, and `git diff --check` exited 0 after the final product edit.

The coordinator's isolated production-mode composition build on `9deed7a2d` passed prebuild, optimized compilation of 867 pages, types/lint and postbuild sitemap. It included the immutable queue binding but preceded the final unresolved-exit and retry-focus commits, so it is reported as an intermediate composition proof rather than a final Task4 build.

The coordinator's fresh general Studio suite passed **483/483 with no skips in 23.01s** on `16aa22d75`, whose product head is `18bf21cad`, under an allowlisted Node22/PostgreSQL17 environment with `LC_ALL=C`. A first 470/483 attempt had thirteen PostgreSQL startup-only failures from the macOS locale/thread initialization warning; setting the explicit locale and rerunning the complete suite removed them without a product change. The retained log is `/private/tmp/studio-editor-suite.pUGxrb`.

### Independent real HTTP/MCP/browser evidence

- Server HTTP: 3/3 passed on `de02e5825`. Real signed cookie and Bearer auth, fresh PG17/migration 42, UI and MCP creation, exact SQL payload/provenance/order/trims, receipt replay, rollback, missing migration 503, atomic GET, CAS/stale 409, every legacy writer, live-reference access and owner isolation.
- MCP projections: 81/81 passed on `c774f6a6e` across nine serial suites. Tool absent by default, strict schema/audit registry present under explicit test gate, release/preflight/support readers accept exactly ten known false flags. No Vercel or paid-generation call.
- Connected browser: 6/6 passed in 63.36s on the final product snapshot `18bf21cad`. Two repeated conflict reopens retain dirty revision 0 with zero PUT; Projects does not leave on failure; explicit Reload resumes the server state; account A→B and SIGNED_OUT purge private state; 503 draft recovery/retry exit, timeline-only private clip renewal, exact lost-reply UI replay, failed-library retry focus/Escape and real dark-theme DOM all pass.
- Local/legacy browser: 6/6 passed in 43.0s on `18bf21cad`. The strengthened contexts carry the fetch-session hint needed to exercise controlled real HTTP 401, 503, 404 and later 200 responses rather than the client-side no-session shortcut. They cover marked local-only and exact historical unmarked records, Prompt edits, no server writer on Projects exit, persisted edits after reopening, recovery to a forty-row server list plus the local card, and a GET/POST race where a project created after the initial list request remains present. Earlier anonymous 4/4 passes are not counted as HTTP-status evidence.
- The same browser chain separately proved real H264 frames 320×180, Chromium AAC decode, Pause, a rejected expired private GET, a real media-access POST, a distinct newly signed 206 URL, preserved position and a new frame after seeking source B. It also proved no hydration-only autosave and a deliberate stale-tab 409 without data loss.
- The mobile UI subtest passed in 5.69s on `fa48e19b4`: 390×844, focus/Escape/return, A/B/A then remove/reorder, exact trims, real command/SQL receipt, deliberately lost committed response, disabled intention and same-key replay to one project. The final `adfe2f29c` fps/validation/accessibility changes are covered by the passing pure builder tests above.

The server/MCP rereview covering `de02e5825` and `c774f6a6e` is Approved with no remaining Important. Earlier client/UI Needs changes findings were reproduced causally before their additive fixes; the six-part connected and six-part local browser runs above pass their strengthened scenarios. The final corrective rereview of product head `18bf21cad` is **Approved**, with no new finding.

## Explicit limits

- `studioMontageCreation` is deliberately unpublished. Local qualification does not activate a production tool or UI.
- Private-storage evidence uses exact fake S3 credentials, SDK-produced signatures and local H264/AAC bytes. It validates authorization, signature, Range and browser behavior, not AWS/CDN production, PKCE or five minutes of wall-clock expiry.
- The library listing in the creation UI browser test is an explicit shared-data fixture. Authentication, Studio route, media resolution, database transaction and receipt are real in the disposable runtime.
- No advanced audio editing, music, render/export, generation, billing, wallet or existing-project MCP mutation was added or tested.
- The natural 320×180 source initially renders at its existing scale. Presentation-only fit for newly created montage clips and the 24-combination clarity matrix belong to Task5 and are intentionally not changed here.
- No post-`18bf21cad` production build, full repository E2E, remote migration, performance benchmark or production rollout is claimed. The earlier isolated 867-page build is the bounded intermediate proof described above. Task5 presentation polish remains a separate delivery and qualification scope.
