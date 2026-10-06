# Studio media analysis

Code candidate, isolated branch `codex/studio-media-analysis-design`, 2026-10-06.
This guide does not establish production activation or provider qualification.

Studio creates first. Both models retain image vision and simple edits. Known
clips, end images and supplied music can be assembled from explicit timing without
content analysis. A delivered result ends the request: generation completion,
polling and montage delivery never enqueue an inspection or buy another model call.

## Owners and client flow

`frontend/lib/studio/media-analysis-contract.ts` owns strict requests, effective
capabilities, safe observations and exact client confirmation. The server area
`frontend/src/server/studio/media-analysis/` owns policy, bounded extraction,
native providers, persistence, service and worker. Route-local analysis card/hook
own review and session-safe status polling. Existing timeline commands own edits;
the existing credit owner funds both chat and the separate analysis consumer.

An analysis must serve a client request or a concrete observation required for
unfinished requested work. Preparation on Luna is a nonspending Sol handoff; it
does not inspect, dispatch, reserve or buy credits. The review card identifies
the source, goal, interval and maximum credits. Client confirmation selects Sol
for that frozen run without buying a pack or resuming suspended purchased usage.

Safe results distinguish observations/inferences and expose source intervals and
sparse coverage. They never initiate a montage, regeneration, export or creative
review. `analysis_read` can read paid saved observations on either model. Audio
uses a separately qualified `gpt-audio-1.5` Chat Completions adapter, including
sound extracted from a selected video; Sol's Responses
API receives timestamped image inputs for video. Subsequent Sol discussion is an
ordinary explicitly sent metered chat message; no extra synthesis call is hidden
after analysis completion. The candidate has no autonomous review loop.

## Activation and bounds

Explicitly apply migration `64_studio_media_analysis.sql` after 54, 62, 63 and the
connected Studio schema. No API read or import performs schema/bootstrap work.
The migration activates no profile, price or credit grant.

Activation requires the existing approved Studio credit assistance, global
supported OpenAI endpoint/key and an operating dedicated worker, plus:

- `STUDIO_MEDIA_ANALYSIS_ENABLED=true`.
- `STUDIO_MEDIA_ANALYSIS_APPROVED_POLICY` matching the reviewed policy version.
- `STUDIO_MEDIA_ANALYSIS_POLICY_JSON` matching `studioAnalysisPolicySchema`.

No numerical production analysis tariff is supplied. Measure the pilot's processing
cost per source second, input/output bounds, supplier exposure and retail margin
before approving a policy. Video/audio profiles may independently be null.
Audio requires a factual rate version and native text-input/audio-input/text-output
rates; do not substitute Sol rates. Qualification must verify usage counters,
coverage, timing, total cost and observed media quality before exposure.

Initial limits: one interval, video 60 seconds / 12 sparse frames, audio 30 seconds,
original 100 MiB, decoding 60 seconds. Longer work needs explicit portions; no silent
truncation, full-inspection or precise-beat claim. Private temporary source/decoded
files are removed after processing. The candidate retains safe observations and
source identity rather than a frame-derivative gallery; refinement is a newly
reviewed interval. Source offsets and observation times are source seconds.

## Worker and money recovery

`pnpm studio-analysis:worker` runs with the intended runtime environment;
`pnpm studio-analysis:worker:once` handles one available run/recovery. The CLI
copies no env files, creates no keys, migrates no schema and activates no policy.

States: prepared, queued, running, completed, failed, unknown. Preparation grants
and reserves nothing. Confirmation reserves before extraction/provider work.
Every dispatch identity is durable before the call; known output/usage is saved
before settlement. Duplicate confirmation and saved-response recovery do not
redispatch or debit twice. A pre-dispatch failure settles zero and releases its
hold; malformed known paid output settles its usage and is reported as failed.

The preparation phase expires after four minutes (120-second extraction plus
65-second native input count and headroom). Dispatch starts a fresh two-minute
phase. Lease expiry never permits another provider call; a known late reply from
the original fenced worker is persisted and settled. Before recording dispatch,
the transaction rechecks and locks the active owned project, exact source and
its output/job/accepted-quote dependencies through the durable checkpoint.

Unknown supplier usage retains credits/exposure. Switching models or disabling
the feature cannot bypass it. A saved result with interrupted settlement is
recovered without another supplier call, including with the profile disabled.
Missing supplier evidence requires explicit support investigation: never infer
zero usage or rerun the dispatch. Read the exact owned status/evidence first.
Settled identities, snapshots and allocations are immutable.

Free current-month credits precede explicitly enabled purchased packs in FIFO
order, using the same campaign/account locks as chat. Old-month holds retain their
original lots. Sponsored analysis holds/settlements count towards shared campaign
exposure even after disabling analysis or reverting the assistance policy.

## Assembly and music

The canonical revisioned command supports `assemble` with 1–12 insertions applied
atomically in list order, plus optional `sourceInFrame` on inserts. Positions,
durations and source offsets are integer sequence frames. Ownership, measured
source bounds, locked tracks and revisions are rechecked for all sources; a later
invalid source rolls back the complete assembly. MCP's v4 projection shares bounds.

Audio layers on a free audible unlocked lane, preserving voice/visuals. For a music
video the requested whole track/excerpt can define duration: supply it explicitly,
instead of borrowing the manual library helper's shorter-film default. Offset plus
duration must fit the measured original. End images are full-frame inserts;
arbitrary logo overlays, composed exact-text cards, independent sequence variants,
precise beats and rendered-film review require further qualified contracts.
New media/export preserve their existing quote confirmations and flags.

## Verification

Use disposable PostgreSQL 17 for financial/revision tests. Focused suites cover
`studio-media-analysis-*`, actual FFmpeg extraction, shared credit/legacy recovery,
canonical edits and MCP parity. Run editor tests/QA, MCP client check, exposure and
diff checks, and the canonical browser lane for changed interactions. Deterministic
tests do not certify live provider quality or production worker readiness.

The 2026-10-06 branch review identified two important worker defects, fixed with
failing-then-passing PostgreSQL regressions: phase expiry discarding a valid late
response, and unlocked source/project reads before the dispatch checkpoint. The
focused recovery/resolver suite passes 13/13. Editor QA passes 1,139 tests with one
skip, TypeScript and exposure checks pass, and the canonical browser lane passes
11/11, including real desktop/mobile confirmation without duplicate reservations.
MCP client checks pass 151 tests with one skip plus tool-selection QA. Current
`main` (75c64b957) is included; its guest/navigation/hydration tests pass 8/8.
Existing image lint warnings remain. No paid provider request, production schema
write, profile activation or credential mutation was performed.
