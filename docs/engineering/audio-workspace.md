# Audio creation workspace

Audio owns standalone voice, instrumental music, songs, punctual sound effects and continuous ambiences. Studio owns placement, timeline and persistence; Toolbox owns transformations. Provider routes are technical adapters, not additional public model identities. No model registry publication changes are part of this work.

## Decision and integration contract — 2026-09-08

Five photographic intention selectors lead to a compact editor. The user explicitly rejected selling model names: the main choice is Standard / High quality. High quality stays unavailable until per-intent routing and live quality are qualified. On 2026-09-08 the user chose provider cost ×3 with round totals; the implemented versioned policy rounds the combined tripled subtotal upward to the next 5 USD cents. Effective model identity stays in result details, stored snapshots and technical contracts. Script is spoken text; lyrics preserve line breaks and are sent to the song model, never to TTS. Sound descriptions are separate. Video soundtrack and narration mixing remain available in the existing workflow. A single native result reader and original downloads accompany reusable settings. No procedural waveform represents a generated result.

`/app/audio?intent=voice|music|song|sfx|ambience|video` is the entry contract. Existing `?job=` restoration stays supported. Source/result identity follows `ToolAssetRef` from `src/lib/toolbox/contract.ts`: exact asset ID or exact job+output ID; no invented output IDs. Requested duration and measured output duration are distinct. A result may carry a real job ID before output identities have been resolved. Studio consumes persisted media through its own library adapter.

The existing `/api/audio/generate` remains the only execution route. Read-only `/api/audio/quote` validates the same request and uses `computeCanonicalAudioBillingSnapshot`. Configuration-bound quote data cannot survive edits, session changes or expiry. Generate compares the confirmed amount to a fresh canonical quote before debit. Missing configuration fails before billing. Provider errors never choose another paid model automatically.

## Audited baseline

Seed Audio voice supports preset/reference speech. Lyria 3 music is a separate Vertex path before the Fal roster; original pricing always quotes Lyria even when the old enabled-by-default fallback ran MiniMax/Stable/ElevenLabs. Cinematic sound design begins with Mirelo. Studio commit `652a32ef0` adds `sfx_only`, strictly MMAudio V2 text, 3–30s, 0.1 cent/s, no fallback. It is imported unchanged before this work.

## Provider evidence (documentation, no paid qualification)

Checked 2026-09-08. These are vendor facts; existing canonical policy computes customer totals.

- [MiniMax Music 2.6](https://fal.ai/models/fal-ai/minimax-music/v2.6/api): prompt <=2000 characters; lyrics <=3500; `is_instrumental`, `lyrics_optimizer`; no exact duration input. [Price](https://fal.ai/models/fal-ai/minimax-music/v2.6): $0.15 per audio. Preserve full song.
- [MiniMax Speech-02 HD](https://fal.ai/models/fal-ai/minimax/speech-02-hd/api): text <=5000, voice_setting, audio_setting, language_boost. [Price](https://fal.ai/models/fal-ai/minimax/speech-02-hd): $0.10/1000 characters. Historical VO02 request confirms English_FriendlyPerson at speed 1.06, volume 1, pitch 0, neutral; historical success is not current provider qualification.
- [Stable Audio 2.5](https://fal.ai/models/fal-ai/stable-audio-25/text-to-audio/api): text, seconds_total, steps, guidance; [price](https://fal.ai/models/fal-ai/stable-audio-25/text-to-audio) $0.20/audio. Continuous ambience uses this exact route. No seamless-loop guarantee.
- [Seed Audio](https://fal.ai/models/bytedance/seed-audio-1.0/api): reference clips <=30s, <=10MB. Existing reference workflow retained.
- [MMAudio V2](https://fal.ai/models/fal-ai/mmaudio-v2/text-to-audio): $0.001/s; existing Studio adapter retained.

Browser QA uses local fixtures with outbound generation, database and storage calls absent. Production provider entitlement, live quality and invoice reconciliation remain separate qualification.

- [Lyria 3 official limits](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/lyria/lyria-3): Clip 30 s; Pro up to 184 s. Existing Vertex-only execution now fails before billing when unconfigured and never substitutes a Fal model after a failure.
- [Mirelo v1.5 schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=mirelo-ai/sfx-v1.5/video-to-audio): duration 1–10 s, minimum two samples. [Published price](https://fal.ai/models/mirelo-ai/sfx-v1.5/video-to-audio): $0.01/s. The old 184 s cinematic acceptance was incompatible with the executed provider. Source-backed sound design is now bounded at 10 s before debit; no automatic chunking or silent substitution.

## Delivery and validation

The main selector sells creative intent; Standard is the existing offer, High quality is visibly unavailable pending per-intent qualification. The versioned policy now applies the approved ×3 / upward 5-cent rule through canonical pricing. The voice menu shows human presets; its exact adapter remains part of each quote and stored result. Reference voices use the reference-capable adapter. Instrumental duration selects Clip/Pro internally. The separate video soundtrack workflow and historical `?job=` source links remain available.

The reference picker uses `kind=audio` before the library listing limit and retains the exact original URL plus `ToolAssetRef`. Unsupported or unverified reference formats, sizes and durations cannot be selected. Original native readers use `preload="none"`; there is no simulated waveform. Confirmed-account draft keys contain neither anonymous nor last-known-account fallback. Quote keys include account and all normalized inputs; expired, late and edited responses cannot enable generation.

Validation on 2026-09-08:

- Full `test:validate` equivalent: **4506 tests passed**, no failures or skips. Focused coverage includes billing authority, exact adapter inputs, no paid fallback, original-byte persistence, requested/probed duration, account isolation, draft continuity, quote edits/expiry and reference routing.
- Frontend TypeScript, lint, public exposure and `git diff --check` passed. Full isolated production build passed, including registry/media prebuild gates and 862 static pages. `/app/audio` is 15.8 kB route / 273 kB first-load JS in that build. No before/after Core Web Vitals improvement is claimed.
- Real local route: five selectors, FR desktop dark/light, mobile 390×844, no horizontal overflow (document width 378), guest auth entry and existing video auth entry. A single 116 kB WebP sprite supplies the new selection photography.
- Browser fixture: actual workspace/editor/draft/quote/result components with local authentication and billing substitutes, FR/EN/ES, intent navigation, independent script/lyrics/durations, amount in CTA, generation pending/completed, account change masking, original download target, library selection and retained reference. Native reference playback was started with the keyboard and observed playing the one-second local WAV; the second unplayed reader stayed unloaded. A 45-second reference remained disabled.
- Local evidence: `/tmp/audio-full-tests-final.log`, `/tmp/audio-build-final.log`, `/tmp/audio-lint-complete.log`, `/tmp/audio-exposure-final.log`, `/tmp/maxvideoai-audio-qa/audio-mobile-light.png`. The local fixture build/server live under `/tmp/maxvideoai-audio-qa`; they never call a real provider, database, wallet or storage service.

Deferred explicitly: live provider quality/entitlement/invoice qualification and the shared Studio upload/handoff runtime (Studio owner confirmed it is not yet implemented). No nonfunctional Studio handoff action is exposed. Existing upload URLs remain supported; the additive canonical upload contract will be integrated when its owner delivers it. This change does not add a durable background worker or cancellation promise to the synchronous audio endpoint. No push or deployment is included.

## Integration review corrections

Source video inspection now downloads through the shared public-DNS-pinned, redirect-validated and byte-limited media downloader. A single ffprobe invocation reads a temporary local file with restricted protocols/formats, a 15-second timeout and unconditional cleanup. Both quote and execution use the same preparation owner; muxing revalidates the source download as well. Original signed URLs remain unchanged in provider inputs and snapshots.

Each account transition retires the Audio observation surface. Draft and quote callbacks also carry a fresh session identity, so A → B → A never revives an old callback, and unmount invalidates uploads, restoration, submission, polling and retries. Advanced Seed output format, sample rate, delivery, profile and voice type roundtrip through historical reuse and are editable under voice settings.

Review validation: 101 targeted Audio, downloader and billing-authority tests passed, including actual React workspace deferred upload/restoration/generation responses through account roundtrip and unmount/recreate. TypeScript, frontend lint and exposure checks passed. These corrections do not change commercial policy.


## Audio commercial decision — 2026-09-08

The user chose “fois trois puis on arrondit à quelque chose de rond”. The stated implementation is provider cost ×3, then round upward once to a multiple of 5 USD cents. Provider subtotals retain fractions of a cent. The canonical package owns the increment; neither the editor nor MCP calculates customer prices. Example totals: SFX 10 s $0.05; instrumental 30 s $0.15, long $0.25; MiniMax speech 1,000 characters $0.30; song $0.45; ambience $0.60; Seed voice at an estimated 60 s $0.60; Mirelo-only 10 s $0.30. Combined stems round once after addition.

Versioned rule `audio-current` selects the new `audio-tripled-rounded` profile and a 200% markup (3× total), with zero flat fee. Explicit database overrides retain documented precedence and must be reviewed through the existing admin workflow before production activation. No database mutation, push or deployment was performed. Historical receipts and the former profile stay readable. Frozen billing/public fixtures are unchanged; the separately reviewed 15-row Audio commercial delta is recorded in `tests/fixtures/audio-pricing-change-2026-09-08.json`. These historical pricing-hub scenarios do not extend the executable 10-second Mirelo limit.

The web execution boundary requires the current `x-maxvideoai-audio-pricing` revision, supplied by `runAudioGenerate`. A stale open tab gets `409 PRICING_REFRESH_REQUIRED` before preparing or reserving a generation. This also protects callers that predate configuration-bound quotes. Server-side MCP orchestration must use the shared quote and execution owners directly.

183 focused pricing tests passed, including browser/server parity and exact rounding thresholds; the subsequent full suite passed all 4,531 tests, and 25 targeted checks cover the final stale-client guard. TypeScript and frontend lint passed. The public baseline passes all 592 rows with the explicit Audio delta. The read-only billing audit has the same four pre-existing Gemini Omni Flash 2-cent differences before and after this change (isolated baseline `/tmp/maxvideoai-audio-build`); no Audio drift remains. Logs: `/tmp/audio-pricing-tests.log`, `/tmp/audio-pricing-full-tests.log`, `/tmp/audio-pricing-header-tests.log`, `/tmp/audio-pricing-public.log`, `/tmp/audio-pricing-audit-before.log`, `/tmp/audio-pricing-audit.log`.
