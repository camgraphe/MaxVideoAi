# H3 Max source operations — 24 October 2026

MiniMax H3 Max adds explicit `h3-recast` and `h3-relight` operations in `v2v`.
Base H3 and existing H3 Max creation modes retain their identities and tariffs.
The new Extend, Insert and Reframe operations remain intentionally pending: no
executable operation, paid submission implementation or tariff is authored for them.
Their future quantity/conditioning evidence remains in the dated release evidence.

## Source admission and recovery

`lib/h3-source-operations.ts` owns complete operation schemas, request shapes and
source admission. Recast accepts 5–30 seconds total and 1–4 ordered portraits;
its optional prompt is limited to 2000 characters. Portrait order is semantic.
Each shot must be at most 15 seconds. Duration measurement does not certify shot
boundaries: supplier content rejection follows ordinary fal failure/refund recovery.
Relight accepts a lighting sphere image, without prompt; adaptive or explicit
framing is supported. It requires constant 24 fps, decoded frame count 17n+5,
at least 56 frames and at most 15 seconds. Seed and safety controls are retained.

`server/video-excerpts/h3-relight.ts` inspects exact account-owned storage bytes
through the bounded downloader. It acquires `withVideoExcerptSlot` before signing,
downloading or probing (one task/account, two tasks/process); saturation returns
retryable `RATE_LIMITED`, with HTTP 429 on web preflight/submission. Canonical reference resolution runs it after
ownership resolution, including for admins; website preflight/submission runs
it after the scoped media lookup and rejects origin-URL aliases. ffprobe decoded
frame timestamps establish cadence; rounded duration multiplied by fps cannot
establish count. Canonical quote binding includes source hash, cadence and count.
Studio and canonical resolution share `qualifyH3SourceReference`: only authoritative
reference facts enter the snapshot, excluding probe-only codec/stream details. Studio
rechecks bytes at materialization, including when no reviewed-reference list was
supplied; unchanged facts pass and a changed source hash fails.
Missing or uninspectable source facts fail before spending. Existing fal job
transport/polling and terminal failure recovery remain the execution owners.

## Task6 compatible-copy integration contract

The exported `prepareH3RelightCopy(bytes,mimeType)` is the operation-specific
media preparation owner. It does not persist assets or modify originals. Shared
excerpt HTTP/UI routing and owned-copy persistence are Task6's integration work.
Call it only after account-owned source resolution and explicit compatible-copy
selection, under the existing `withVideoExcerptSlot` concurrency guard. First
show `planH3RelightCopy(selectedSeconds)`: requested span, actual frame count,
actual duration and removed ending. Then persist returned bytes as a NEW private,
owned asset and re-probe/bind that exact identity. Do not overwrite source metadata
or imply that existing timeline cuts retain their old endpoint after shortening.

The profile resamples to constant 24 fps and trims the ending to 17n+5 frames;
it does not change playback speed. Geometry/display orientation and presence of
source audio are verified after encoding H264/AAC. A 25 fps, 139-frame fixture
becomes 124 frames, approximately 5.166667 seconds, with its trimmed audio. The
real user's 5.558333-second iPhone source would have a nominal plan ending at
124/24 seconds (about 0.391666 seconds removed); this is a plan, not evidence
that that original has already passed the application persistence/UI flow.
Generic `trimVideoExcerptBytes` retains its existing rational-fps policy.

## Creation/reference controls

Reference generation accepts owned first/middle/last frame assets. The middle
frame requires both endpoints, native 480P/768P, and `middleFrameTime` strictly
inside the requested frame interval after nearest-24fps rounding. Existing integer
5–15-second creation duration remains unchanged; fractional 0.92–15 creation
needs canonical quote-domain support before publication.

`referenceOrder` is a complete permutation of existing modality slots, for example
`video1,image1,audio1`. It never accepts URLs. The provider adapter translates it
into ordered `reference_conditions` and omits every `reference_*_urls` field.
Explicit order preserves caller order with canonical slots. Modality-dependent
permutation validation waits for owned kinds; it runs again after resolution.
Omission keeps legacy grouped request shape and canonical sorting/hashes. All selected references and frame
assets still undergo ownership/media checks and the existing reference pricing
budget. MCP and Studio use the `middle_frame` role plus canonical scalar settings;
Site uses schema-driven fields. `h3-reference-controls.ts` owns shared validation.

## Pricing boundaries

Published reference cents/second: Recast 30/768P and 45/1080P; Relight 5/480P,
8/768P, 16/1080P, 32/2K. They are dated endpoint references, not verified future
supplier invoices. Recast portraits and the mandatory Relight sphere have no
invented token surcharge. Canonical facts use exact measured source seconds.

`prepareH3OperationTariffFacts` emits six operation-specific selectors, canonical
facts and bounded `input_video_seconds` domains. Task6 owns compiling current
commercial policy into literal continuous bands, full inventory, review and safe
application. Runtime must never evaluate a percentage fallback or alias creation
or Kling tariffs. Until literal cells exist, these new operation prices fail closed.

## Read-only infrastructure boundary

Preflight imports `storage-read.ts` for transient signed GET/HEAD and owned-key
checks, and `storage-keys.ts` for the existing key policy. The legacy storage facade
re-exports those functions; write/bootstrap owners remain outside preflight.
`bounded-media-download.ts` owns byte/MIME/completeness checks and delegates DNS,
redirect and deadline enforcement to the unchanged `public-media-transport.ts`.
Reference-import defaults stay in their existing adapter; the shared downloader
does not import upload sessions or file persistence. The full preflight import
graph contract and private-storage/SSRF tests cover these boundaries.
