# Fal V4 refresh —22 October 2026

Read-only refresh at 2026-10-21T23:10:09Z (22 October in Europe/Madrid). All four official OpenAPI documents returned HTTP200 and are semantically identical to the 21 October capture in `provider-evidence-2026-10-21.md`.

| Endpoint suffix | SHA-256 of captured response |
| --- | --- |
| text-to-video | `84c22dde3aae24d0a74a19de259cab2966a6eb70200d94c2979f31f2f1404278` |
| image-to-video | `7198dcad6587d18962f48398378421a5558c72427b2a6db672a388a859c086ca` |
| reference-to-video | `b2826a7e5ec226f4bf28fa826d03c13edb68311760eedf010cdd2cc06fe3b8cd` |
| video-to-video/edit | `45aefa323ddbe6c4aa0bea0efb059b23f73e6245d82ff552e162780db1b8b372` |

Source pattern: `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/{suffix}`. Private raw captures and response metadata are retained under `.local/kling-v4/research/2026-10-22-fal-refresh/`.

The user opened the fal integration account in Chrome. The authenticated [T2V playground](https://fal.ai/models/kling/v4/text-to-video) displayed an enabled Run button,5-second 1080p 16:9 controls, a prompt or multi-prompt option, and list rates USD 0.157/s at 720p and USD 0.235/s at 1080p. Its result state was Idle. Run was not clicked. The page still states API coming soon while offering playground/Agent access.

This is UI evidence, not a successful generation, paid invoice, queue/API entitlement, credential validation or proof that the application can execute V4. No account key was created, copied or changed. Initial fal qualification can proceed only with an approved bounded generation and an actually available submission channel; direct account recovery is independent.
