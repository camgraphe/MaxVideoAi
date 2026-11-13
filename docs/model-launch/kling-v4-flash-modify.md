# Kling 4.0 Flash Modify

Contract inspected 2026-11-07: [fal API](https://fal.ai/models/kling/v4/flash/video-to-video/api) and [OpenAPI](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/flash/video-to-video).

The `v2v` mode routes only to `kling/v4/flash/video-to-video`. It requires a prompt and one owned source video (`@Video1`), with up to ten image references, four additional video references (`@Video2` onward), and seven subjects (at most three video subjects). The existing product envelope remains fifteen original media occurrences including source and subject views. This envelope is conservative product policy, not a documented mixed fal limit.

Videos require 3–20 seconds, 700–4553 pixels per side, 23.9–60.05 FPS, a 0.4–2.5 aspect ratio and at most 300 MiB. The provider's individual upper tolerance is 20.05 seconds; the combined source/reference/subject video limit remains 20 seconds. Subject videos use the existing 3–8.05-second contract. Images require at least 300 pixels per side, ratio 0.4–2.5 and at most 30 MiB. Every occurrence counts even when URLs repeat. Identity and metadata must come from owned originals.

Output is 720p with source framing. Omitted duration inherits the exact source duration; explicit duration is a whole number from 3 through 20. No aspect-ratio, FPS, audio switch, voice binding, start/end-frame, multi-shot or Extend controls are added.

The route's displayed supplier list rate is USD 0.063 per billable second: output seconds plus the greater of aggregate input video seconds and output seconds. This is distinct from generic endpoint metadata showing USD 0.094. Customer prices require independent reviewed v2v tariff cells; code does not activate production pricing. Existing Create tariffs and paid history stay unchanged.

Qualification in this PR is offline, with mocked provider transport and disposable database tests. No paid provider render or production tariff activation establishes live output quality here.
