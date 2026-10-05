# Studio conversation Audio

The conversation exposes the same seven Audio packs as the canonical Audio core: `music_only`, `voice_only`, `sfx_only`, `song`, `ambience_only`, `cinematic`, and `cinematic_voice`. `audio.prepare` selects a pack; saved `voice.prepare` and `music.prepare` actions remain compatible. The model ID is the top-level Audio engine ID, while the provider variant belongs in settings. A successful preparation produces one immutable quote and never starts a media job.

## Owners and validation

- `conversation-audio-generation.ts` owns pure intent validation, exact current-attachment selection and ready project-output preflight. Canonical settings, packs and source roles come from `audio-normalization.ts` and the Audio core. Only explicitly tagged pure selection failures may return to the model for correction within the existing four Responses. Catalog, ownership, provider, wallet and storage failures remain closed.
- `audio-generation-service.ts` intersects canonical modes with exact conversation Audio model/mode tuples in the authored `workspace-model-certification.ts` owner, then uses the canonical Audio quote and confirmation services. Native job outputs must belong to the same account and project, be ready, have a completed visible job and an accepted Studio quote. Confirmation repeats that check and locks the source job/output before charging. Outputs remain native identities; preparation never copies them into the library.
- `audio-capabilities.ts` projects supported settings from validated provider variants. `conversation-capabilities.ts` retains exact reference-role facts and source-duration rules. Music Clip's standalone setting is 30 seconds; Music Pro exposes the full integer range rather than interpreting its minimum as the only allowed value.
- Quote snapshot, currency, funding, reservation, confirmation, idempotence and refunds stay with `agent-api` and the Audio core. The public OAuth Audio gate is unchanged.

## Exact source roles

`references` contains `{role, asset}`. `source_video` requires a video identity; `voice_sample` requires an audio identity. Assets must be explicitly attached to the current turn. Native `job-output` identities must have been returned as ready outputs of the current project. Names and labels never repair or substitute identities, and tool arguments never contain source URLs.

Music accepts optional source-video context. Cinematic packs require source video and use its measured duration, with the core's ten-second limit. Voice packs support a Seed sample for cloning; MiniMax plus a sample is rejected before preparation. Song, SFX and ambience do not accept those source connectors. There is no claim that supplying instrumental audio continues or edits that recording.

Discovery explains the distinction between sound-only work on an existing video
and generative visual edits. Cinematic packs preserve the encoded video stream
through the existing mux owner, replace its original audio with the generated mix,
and may trim narration to the measured clip length. They do not promise lip-sync
or preservation of the original soundtrack. Reference requirements, available
voice variants and source-duration limits remain canonical Audio facts; Studio
does not infer these promises from a generic video-edit model.

Source videos are resolved by the trusted owner reader, then probed by `prepareAudioRun`; caller settings and stored metadata do not replace the probe. The optional `inspectSourceVideo` dependency is a test seam. Production defaults to the existing bounded source probe. The QA runtime permits only an exact seeded fixture URL and returns facts measured from that local file before allocating PostgreSQL; no URL is fetched.

## Certification evidence

`audio-song` / `song` and `audio-ambience` / `ambience_only` are explicitly certified for conversation. Their qualification is separate from Canvas block/workflow certification; the five existing Canvas Audio packs remain unchanged, and song/ambience have no Canvas qualification or controls. The conversation quote path supplies exact lyrics or duration through canonical settings. `studio-audio-certification.test.ts` covers exact conversation tuples, cross-pack rejection, unchanged Canvas qualification, unsupported connectors, factual vendor pricing, normalized output kind and exact injected provider dispatch payloads with one attempt. `studio-audio-catalog-postgres.test.ts` covers all seven real quote preparations, source measurement, project isolation and rejection before debit. Existing Audio confirmation/refund tests remain part of validation.

`studio-call-runtime-postgres.test.ts` exercises all seven packs and the legacy clone action through the real conversation checkpoint path, using all seven existing local fixtures. It asserts one quote, no job or media charge, no external fetch and saved-request replay without another Response. The runtime sends image bytes only for image attachments; video/audio are identity and metadata, without an analysis or transcription claim.
