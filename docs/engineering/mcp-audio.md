# MCP Audio integration

Audio reuses the web runtime and canonical billing policy. It does not create a separate provider pipeline or ledger. The current first increment qualifies shared contracts; public MCP prepare/confirm registration is still the next increment, not enabled by these helpers alone.

## Requests and discovery

`agent-api/audio-normalization.ts` owns the version-1 `surface: audio` request. Mode and engine must match the actual Audio pack configuration; output count is one. Its settings use the existing Audio semantic validator, preserving scripts, structured lyrics, voice/reference settings, music choices and duration policy. Unknown keys, payment fields, raw source URLs and provider overrides are rejected. References carry exact `ToolAssetRef` identities under distinct `source_video` and `voice_sample` roles. Structural validation is not ownership verification; the prepare/confirm services must resolve originals and source facts on the server.

`audio-capabilities.ts` projects the seven real packs (five creative intents plus the two existing video soundtrack packs), factual provider models, option constants and current configuration checks. High quality remains unavailable. No network call or quote/debit is performed by discovery. Its revision changes with the projected contract/configuration and contains no credentials. Current pricing still comes from the canonical quote owner, not the discovery document.

## Quotes and mixed readers

`quote-repository.ts` retains one SQL/state machine. A surface codec supplies strict normalization, hashing and funding interpretation. The SQL surface predicate applies before owner reads and every individual state mutation. A video/image operation therefore cannot claim or invalidate an Audio row even before its parser runs. Global expiry remains a bounded, shared operation.

The existing exports retain the video/image/trial codec and its authoritative trial checks. `audio-quote-repository.ts` exposes a wallet-only Audio codec and a strict union reader for top-up/recovery. Audio funding snapshots must match stored cents and currency. Mixed activity labels the actual Audio tool; top-up keeps the existing signed payload, invalidates the old quote, and directs fresh Audio preparation/confirmation after funding.

## Reservation and execution

`audio-run-reservation.ts` builds the initial job and trusted in-process execution context from a server-prepared run. `createInitialAudioJobInExecutor` composes the existing wallet/job insertion with a caller's transaction. The web route still prepares and checks its current expected price before its reservation transaction, then invokes the same `executeReservedAudioRun`. That executor never reserves a second charge.

The historical `app_jobs.duration_sec` contract is integer and non-null. Unknown song duration starts at zero in that column; it is not an output estimate. Completion stores the ceiling integer there and the exact probe value in `settings_snapshot.measuredDurationSec`, `settings_snapshot.mediaFacts` and the response. The original audio file remains untrimmed. Downstream timeline code must consume verified original-media facts, not this rounded column. Projection of those exact facts into completed Audio `job_outputs` is part of the result-integration increment.

## Verification and remaining boundaries

Task 1 evidence includes actual disposable PostgreSQL for mixed quote ownership/state isolation, wallet/job/claim rollback and competing same-quote reservations; a bundled real web runner with provider/media boundary fixtures verifies one reservation, intact lyrics/original duration, stale-price rejection and exact failure refund. Existing video/image/trial, top-up, pricing and Audio provider checks remain applicable. These are fixture/local database proofs, not paid provider output qualification.

Before public Audio MCP execution, finish exact preparation and confirmation services, source identity/policy revalidation, cumulative spending limits, failure/refund reconciliation, signed result access and immutable result App presentation. Keep current synchronous execution limitations explicit: a retained claimed job is not permission to restart a provider after a process crash. No new durable worker, paid call, profile activation, deployment or remote migration is implied by this integration.
