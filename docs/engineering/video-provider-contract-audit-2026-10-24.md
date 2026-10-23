# Video provider contract corrections — 2026-10-24

This correction covers the currently exposed Kling 2.5 Pro, Kling 2.6 Pro and LTX guidance controls. It adds no endpoint or pricing policy. Evidence was captured from Fal OpenAPI on 2026-10-23/24; `tests/fixtures/video-provider-contracts-2026-10-24.json` records each relevant endpoint, source URL, capture timestamp, source SHA-256, accepted keys and required keys. These are provider input contracts, not evidence of render quality or a paid generation test.

`frontend/src/config/fal-engines/` owns the UI fields. `frontend/src/lib/fal-legacy-video-contracts.ts` owns the final scoped request projection after attachments and extra settings have been collected. `fal-request-body.ts` delegates once, before application metadata is added. This final projection prevents older saved settings from leaking controls unsupported by the selected mode; it mutates only the newly built provider body, never the caller's stored settings or attachment originals.

- Kling 2.6 I2V projects the existing `image_url` UI attachment to `start_image_url`, exposes `end_image_url`, and retains prompt, negative prompt, duration, audio, safety and voice IDs. I2V omits unsupported CFG/aspect ratio. T2V retains its CFG/aspect ratio controls. Both endpoints receive string duration and omit unsupported seed/resolution.
- Kling 2.5 Pro I2V exposes the existing `end_image_url` UI control and projects it to Fal's `tail_image_url`. Pro text/image duration is serialized as a string; the historical `duration_seconds` UI field remains intact. The historical `i2i` Standard endpoint/alias and its control schema are unchanged.
- LTX 2.3 I2V (regular/Fast) omits `guidance_scale`. LTX 2.3 regular A2V retains its valid guidance control and optional first frame.
- LTX 2.5 A2V (Pro/Fast) omits `guidance_scale`; optional first frame, source audio and aspect ratio remain supported.

`tests/video-provider-audit-contracts.test.ts` verifies complete real-builder bodies, supported fields, stale-control omission, unchanged caller settings, original attachment URLs, and conformance to the compact dated snapshots. Existing P0 and Seedance Draft suites cover surrounding capabilities, including FLUX Draft. Generated engine catalog changes must come from `pnpm engine:catalog`; validate with `pnpm model:registry:check`.

No live render, provider submission, billing operation, production mutation or deployment is part of this verification. Provider changes after the evidence date require a fresh contract review.
