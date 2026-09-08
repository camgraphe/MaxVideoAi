# Local Studio decode fixtures

Synthetic test media only. No provider, external recording, production storage or user media.

Two short, visibly distinct moving test patterns with different audible tones let browser tests check decoded frames, source seek time and audio instead of only the editor clock. They are served by test-only request interception, not published as product examples.

Generated with the local FFmpeg binary using `testsrc2=size=320x180:rate=30`, 6 seconds, H.264/yuv420p, GOP 30, AAC 48 kHz, faststart. `pattern-a.mp4` uses the unmodified pattern and a 440 Hz sine; `pattern-b.mp4` uses `hue=h=90` and 880 Hz. Decode facts are verified with ffprobe after generation. Regeneration must use `-n` (no overwrite) or an explicitly reviewed fixture replacement.

Measured on 2026-09-08: both contain a 320×180 H.264 video stream at 30 fps and a 48 kHz AAC audio stream, each exactly 6 seconds. SHA-256 and file sizes:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `pattern-a.mp4` | 115331 | `99da2fdd865874d6856d1cc9155fc2f9fb4003a69079d87b667d2d6e432c5813` |
| `pattern-b.mp4` | 115453 | `df8389de05d910b530e8e23e33c016bdd318ba5330840ff058a15c8ade0e0739` |

These files do not establish provider output quality, real S3/CDN behavior, or production browser performance.
