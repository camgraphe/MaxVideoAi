# Milo reference perception

PR #555, 2026-10-29. Implemented behind separate flags and qualified on the isolated
Neon test branch. Production is unchanged; this is not a rollout approval.

## Tier split

| Milo tier | Writing model | Image content | Video content | Audio content |
| --- | --- | --- | --- | --- |
| Lite | GPT-6 Luna / high | Yes | No new analysis | No new analysis |
| Standard | GPT-6.1 Terra / high | Yes | Confirmed sampled frames | Confirmed sound excerpt |
| Max | GPT-6.1 Sol / xhigh | Yes | Confirmed sampled frames | Confirmed sound excerpt |

These are assistance capabilities, not restrictions on references accepted by the
media-generation model. References can stay attached in Lite. Current content
status is explicit per reference; metadata never becomes a claim of perception.
Standard/Max retain their selected writing tier. Visual analysis uses Terra/Sol
with the existing bounded analysis runtime (medium reasoning); sound uses the
separate native `gpt-audio-1.5` adapter. Selecting a level does not buy credits.

The official [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra) and
[Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) pages were checked
on 2026-10-29: they accept text/images, not raw video/audio in these Responses
calls. The [vision guide](https://developers.openai.com/api/docs/guides/images-vision)
explains image inputs and token costs. The [audio model](https://developers.openai.com/api/docs/models/gpt-audio-1.5)
supports Chat Completions and function calling. Its forced report function returns
data only; no application action is exposed or executed.

## Owners and visible flow

- `prompt-assistance/perception.ts` rechecks each exact owned reference and pairs
  normalized image pixels with canonical labels/roles. Images are at most 1536px,
  JPEG quality 80, 2 MiB normalized each, 16 MiB aggregate, 30 MiB source each,
  with download/decode deadlines. Unsupported/unavailable images fail before the
  paid chat dispatch. No silent omission. Token preflight includes the pixels.
- `PromptReferenceAnalysis.client.tsx` adds a compact **Analyze references** action
  when video/audio references exist. The dialog chooses one reference, visuals or
  sound (including video sound), and source seconds. **Review analysis cost** is
  free preparation. A distinct confirmation shows the exact interval and maximum
  credits before reservation/dispatch. Images require no separate analysis quote.
- `reference-analysis.ts` validates the full current generator draft before creating
  an owned composer session and preparing an analysis. No invented Studio project.
- The existing Studio source/provider/worker/credit ledger owners perform bounded
  extraction, reserve existing credits, dispatch once, save evidence and settle.
  No generation, purchase, tier switch or extra synthesis call follows completion.
- The next explicitly sent Milo message gets the safe observations and coverage.
  Completing/reusing an analysis invalidates an earlier prompt suggestion.

Video coverage is at most 60 seconds and 12 sampled frames. Audio coverage is at
most 30 seconds; timing and speech interpretation remain approximate. The original
must have a known duration and be at most 100 MiB. These are selected intervals,
not complete viewing/listening or beat-accurate timing. The dialog's interval is
for analysis only; it does not trim the generator reference or change settings.

## Cache, ownership and interruptions

Completed composer observations are reusable by the same owner for the exact
reference identity, original URL identity, measured duration/size, selected
interval, assessment and policy. Reuse re-resolves ownership; Studio-project
analyses are not implicitly imported into composer history. A fresh chat can use
saved observations without restoring hidden old conversation messages. The current
session's explicit excerpt selection takes precedence over newer cached excerpts;
an unfinished/failed selected excerpt cannot silently fall back to an older one.

This fingerprint assumes the existing immutable original-storage contract; it is
not a new byte download to prove a remote object is unchanged on every message.
Replacing/removing the reference invalidates its observations. Read-only context
contains validated descriptions, coverage and labels, never private URLs/base64.
Normalization/extraction bytes are transient; temporary media is deleted.

The browser saves only pending session/analysis IDs in account/workspace-scoped
sessionStorage. Reload recovery uses GET and cannot repeat the paid call. It does
not automatically retry a failed POST. The shared worker can settle saved supplier
evidence after a lost wake-up. Unknown dispatched outcomes retain the reservation
and block new spending until recovered; closing the panel is not cancellation.
Session expiry prevents new preparation/confirmation but not reading already paid
evidence. Retention/deletion policy still needs product-wide treatment before a
persistent history release.

## Migration and activation

Apply `89_composer_reference_analysis.sql` explicitly after 64 and 85–88. It makes
Studio project vs. owned composer-session scope exclusive, preserves historical
rows and adds an excerpt-selection binding. No handler creates schema. It was
applied only to the isolated test branch in this work.

In addition to the existing live composer/Studio credit flags:

- `PROMPT_ASSISTANCE_PERCEPTION_ENABLED=true` enables server perception.
- `NEXT_PUBLIC_PROMPT_ASSISTANCE_PERCEPTION=1` enables the analysis action.
- The existing `STUDIO_MEDIA_ANALYSIS_ENABLED`, approved policy version and policy
  JSON enable the qualified profiles. A profile may independently be disabled.
- Keep the existing Studio worker/cron operational. The Next `after()` wake-up uses
  `STUDIO_VERCEL_WORKERS_ENABLED=true`; durable cron recovery is still required.

Disabling perception stops new composer analysis confirmation and image injection.
Keep owned status and the existing recovery worker available for saved work. Do not
drop evidence tables or infer refunds during rollback. Production rollout still
requires final CI, release review and its own migration/flag procedure.

## Validation and practical limits

- 52 focused non-browser tests passed for perception, context, transport, routes,
  provider parsing, extraction and existing Studio analysis behavior.
- 13 disposable PostgreSQL checks passed for shared credits, ownership, preserved
  levels, expiry, exact excerpt selection, concurrent confirmation, exactly-once
  dispatch and saved-usage recovery; historical Studio schema/flows still pass.
- Browser coverage exercises explicit cost confirmation, a changed reference before
  confirmation, account/session handling, pending reload by GET, stale suggestions
  and a 390px dialog. HTTP is intercepted; this is not a physical-device test.
- Real API calls on the isolated database verified image description with no content
  hint on Lite/Standard/Max. Lite correctly reported video/audio as metadata only.
  Terra and Sol inspected different video intervals. Native audio inspected voice
  excerpts; subsequent Standard/Max messages reported coverage and current model,
  duration, resolution, framing, output format and audio toggle.
- Repeating confirmation and requesting unchanged completed analyses reused the
  saved identity without another analysis call. Ordinary chat input tokens still
  apply when observations are reused.

Real calls exposed two adapter issues, now covered: visual JSON token-count input
needed an explicit JSON instruction; native audio needed a typed report and support
for completed function calls with `finish_reason=stop`. The pre-dispatch rejection
charged zero. Malformed/incomplete known responses were rejected and their actual
usage settled; no automatic paid retry was introduced. Evaluation failures remain
in the private test evidence, not erased or described as successful inspections.

Observed examples, not universal estimates: 3-second visual analyses used 60 credits
on Standard and 70 on Max (ceilings 100/150); short voice analyses used 50 credits
with a 330-credit ceiling. They include the existing processing allowance. Broader
creative accuracy, long noisy clips, many images, physical mobile devices and
production runtime/worker timing still require rollout qualification. These tests
do not establish exact transcription, exhaustive visual understanding or a new
pricing guarantee. A separate video-sound attempt used a source without an audio stream: extraction
failed before dispatch and settled zero credits. This is a negative-path check,
not positive native-video-sound or music-quality qualification. Raw media/account
evidence stays under ignored `.local/`.
