# Milo reference perception — agreed scope

Product decision, 2026-10-29, for PR #555. **This document specifies the next integration; composer perception is still metadata-only.**

## Confirmed tier split

| Milo tier | Writing model | Image content | Video content | Audio content |
| --- | --- | --- | --- | --- |
| Lite | GPT-6 Luna / high | Yes | No | No |
| Standard | GPT-6.1 Terra / high | Yes | Yes | Yes |
| Max | GPT-6.1 Sol / xhigh | Yes | Yes | Yes |

These are assistance capabilities, not restrictions on references accepted by the media-generation model. A video/audio reference can remain attached in Lite; Milo must distinguish metadata from content it has actually analysed. The paid tiers keep their selected writing model when using a separate perception adapter.

## Verified implementation basis

The official [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra) and [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) pages were fetched on 2026-10-29. All three list text and image input. Their Responses calls do not directly accept audio/video media in this design. The official [vision guide](https://developers.openai.com/api/docs/guides/images-vision) describes labelled image inputs and their token costs; [audio Chat Completions](https://developers.openai.com/api/docs/guides/audio-chat-completions) supports native audio input through an audio-capable model.

Existing code to reuse:

- `server/studio/conversation-reference-mentions.ts`: owned, labelled image inputs already used in Studio.
- `server/studio/media-analysis/source.ts`: bounded original downloads, timestamped video frames and audio-window extraction, with temporary-file cleanup.
- `server/studio/media-analysis/provider.ts`: visual observations and the native `gpt-audio-1.5` adapter. Audio analysis covers sound, not only a speech transcript.
- `server/studio/media-analysis/service.ts` and `worker.ts`: immutable identity, quoted credit ceiling, dispatch/settlement evidence, recovery and unknown-usage handling.
- `server/prompt-assistance/context.ts`: current operation, controls and owned reference identities; reuse this mapping rather than introducing new image/video numbering.

Existing Studio analysis is explicitly scoped to a real Studio project and its worker, and its prepared quote currently selects Max. It cannot simply be called from a composer or claimed available for Standard. Adapt ownership to composer sessions, preserve the selected tier, and qualify the pricing/provider path before activation. Do not create a synthetic Studio project or bypass credit reservations to make the call work.

## Proposed integration

1. Supply owned images to the current Milo request, preserving labels, start/end roles, token counting and the existing input budget. Keep transient bytes/signed access out of persisted context and logs.
2. For Standard/Max, analyse the selected video/audio interval using the existing bounded extraction and accounting owners. Video coverage is a timestamped sample, not a complete viewing; audio observations identify the analysed interval and uncertainty.
3. Reuse saved observations for the exact unchanged owned source and interval. Recheck access on reuse. A changed excerpt, replaced reference or analysis profile requires fresh evidence. A repeat message must not silently redispatch the same analysis. Reusing observations still adds ordinary chat input tokens.
4. Present the applicable analysis ceiling through a compact reference action before a separately charged analysis, consistent with the existing Studio flow. Exact limits and customer cost need validation against the chosen adapter; no new pack or automatic tier switch.
5. Carry coverage/status per reference into the current context. Missing, failed, unavailable or Lite-ineligible perception must never look like successful analysis. Existing stale-proposal guards continue to cover edits during analysis.

## Acceptance evidence needed

- Real image-only identification with no identifying hint in the prompt, on all three writing models.
- Standard/Max video motion and sound checks, including extracted video audio and audio without speech.
- Lite receives image content but does not dispatch video/audio perception.
- Exact excerpt, role and label consistency; no stale observations after replacing/removing references.
- Owned-source isolation, deleted-asset rejection, bounded downloads/decoding and no media URL leakage.
- Input-count/credit correctness, replay without duplicate analysis charges, known-usage settlement and unknown-usage recovery.

This decision adds no migration, runtime flag or paid call by itself. Any required schema/worker change belongs in the same isolated PR, with test-environment validation before activation.
