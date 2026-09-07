# Audio creation workspace

Audio owns standalone voice, instrumental music, songs, punctual sound effects and continuous ambiences. Studio owns placement, timeline and persistence; Toolbox owns transformations. Provider routes are technical adapters, not additional public model identities. No model registry publication changes are part of this work.

## Decision and integration contract — 2026-09-08

Five illustrated intention selectors lead to a compact editor and explicit model. Script is spoken text; lyrics preserve line breaks and are sent to the song model, never to TTS. Sound descriptions are separate. Video soundtrack and narration mixing remain available in the existing workflow. A single native result reader and original downloads accompany reusable settings. No procedural waveform represents a generated result.

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
