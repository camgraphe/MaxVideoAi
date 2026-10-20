# Five creator tools

Owner request: Adrien, 19 October 2026. Implementation, routine design decisions,
local verification and reviewable PR delivery are authorized. Paid model trials
have no approved budget; publication must not imply unverified availability.

## Outcome

Build Subtitles, Lip Sync (Photo and Video modes), Product Photo Editor,
Product Video Editor and Motion Transfer as a coherent Tools range. Each needs
an authenticated working path, EN/FR/ES public explanation, owned library inputs,
recoverable outputs, and shared operations consumable by Studio and MCP.

The editing path is source → settings → actual preview → exact quote → explicit
confirmation → recoverable result. Desktop uses the existing ToolWorkbench rail
and stage; mobile retains this reading order. Show one task-oriented adjustment
group, compatible sources, useful errors, source/result playback, downloads and
an explicit next action. Never expose a false percentage, fake benchmark or
unverified provider demonstration as MaxVideoAI evidence.

## Common operation boundary

Tool identity and strict versioned settings live in browser-safe Toolbox owners.
Resolve account-owned original assets on the server, including actual kind and
measured timing; client metadata and arbitrary URLs are not authority. Tool
selection never buys generation. Preparation freezes sources, settings, engine,
price and revision; confirmation is one idempotent attempt. Recovery reuses its
job instead of resubmitting. New outputs preserve source identities and originals.

Reuse canonical generation preparation/confirmation for existing image/video
engines. Add an explicit Toolbox session actor and isolated quote origin; never
pretend a web session is OAuth or Studio. Provider-specific finishing-style
operations reuse existing canonical pricing, wallet, storage and job owners.
MCP and Studio adapters consume the same business service, not independent price
or input validators. Documentary outputs have their own typed contract rather
than pretending SRT/VTT are image/video assets.

## Subtitles

Persist a versioned, owned document containing source identity, source revision,
language, timed words, editable segments and style. Caption corrections and style
changes do not transcribe again. Validate finite ordered timing, stable IDs and
bounded text. Text replacement marks alignment quality honestly. SRT and VTT
export corrected segments; an MP4 render burns the same document/style snapshot.
Styles: clean, active word and high contrast. Preview/export share temporal and
layout rules. Support audio and video transcription, with a visual background
explicitly required for an audio-only burned video.

Scribe v2 is the initial adapter candidate. Keep provider transcription, document
storage, subtitle serialization and media rendering separate. A standalone clip
renderer must not enable full Studio exports. Studio projection clips source-time
segments against source trims and offsets them into sequence time. Current Studio
supports speed 1 only: unsupported speed transformations are rejected. Changed
mixes require transcription bound to that exact mix/version before export.

## Other tools

- Lip Sync is one identity with Photo and Video. Source + owned audio (including
  existing voice output), explicit segment and exact duration compatibility. No
  automatic loop, speed change, hidden cutoff or model substitution. Candidates
  are compared only with real evidence; provider claims are not measured quality.
- Product Photo: studio background, lifestyle or lighting; product source,
  optional style reference, ratio, brief and visible preservation instructions.
  Existing GPT Image 2.5/Nano Banana pricing/execution remain authoritative.
  Prompt-based preservation cannot be represented as a pixel lock.
- Product Video: one bounded continuous source segment and requested change;
  Wan 3 edit initially. Synchronized before/after, duration/audio validation,
  preserved source and explicit add/replace handoff to Studio.
- Motion Transfer: character image + performance clip/segment, orientation and
  explicit audio policy. Natural entry from Character Builder. Wan references
  and Kling Motion Control need distinct truthful capability/quality evidence.

## Marketing and discovery

One route per tool under localized Tools (EN/FR/ES). First fold explains input,
adjustment and output visually. Include workflow, compatible media, actual
limits, quote CTA, useful FAQ and relevant links. Illustrative previews are
labeled; public proof is recorded separately. Canonical, reciprocal hreflang,
JSON-LD, sitemap and hub availability follow the same release state. Never
publish an executable claim for an unavailable operation.

Contextual Library/Studio actions use canonical source IDs. Marketing CTA
context survives sign-in. Instrument only allowlisted tool/mode/event/outcome
facts through existing consented analytics; exclude private text/media/IDs.

## Acceptance

Each tool needs strict input and ownership tests, current canonical price binding,
idempotency/recovery/refund tests where money is involved, output validation,
browser checks for mobile/desktop and errors, localized metadata/link checks,
and MCP schema/confirmation/status tests. Subtitle round-trip, safe escaping,
timeline trims, edited text and rendered frames need behavioral media tests.
Baseline focused Toolbox suite: 19/19 passed on main 66c83120a.

Local fixtures prove behavior, not live provider fidelity, billing or host
selection. Keep those evidence classes separate in the delivery record. Use
GitHub PR → required Quality CI for release; no direct production upload.
