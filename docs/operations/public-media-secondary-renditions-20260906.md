# Public demo rendition review — 2026-09-06

This lot adds display renditions for three exact originals observed in production on `/models/veo-3-1`, `/examples/veo`, and `/examples/hailuo`. It uses the existing source catalogue and v1 encoding profiles. It does not replace original media or change routes, model publication, download/edit sources, SEO schema URLs, or reader policy.

| Asset ID | Original bytes | Desktop bytes | Mobile bytes | Desktop saving | Mobile saving |
|---|---:|---:|---:|---:|---:|
| veo-3-1-model-demo | 3,433,088 | 2,612,009 | 2,004,063 | 23.9% | 41.6% |
| veo-family-featured | 6,806,999 | 5,160,302 | 2,038,169 | 24.2% | 70.1% |
| hailuo-family-featured | 7,414,821 | 2,842,786 | 1,750,267 | 61.7% | 76.4% |

## Content acceptance

All six candidates passed the existing prepare gate: complete decode, faststart, unchanged video duration, frame count, frame cadence and timestamps, preserved aspect ratio, and at least 15% byte savings. There are no failed profiles or omissions in this lot.

Visual comparison sampled each original, desktop and mobile rendition at 0.5 seconds, the midpoint, and 0.5 seconds before the end. The checked subjects were room furnishing (Veo model), a bicycle workshop (Veo family), and a moving dancer on a patterned floor (Hailuo). Composition, color, subject detail and sampled motion positions were accepted for display use. Originals remain the quality reference. This is sampled visual review, not a claim that lossy encodings are pixel-identical.

Audio acceptance is based on exact equality of AAC packet payload SHA-256, channels, sample rate, start and duration in the measured probes for every candidate. The audio is stream-copied; no new perceptual listening result is claimed. Full frame and packet timing gates complement the sampled visual review.

Local preparation checkpoints and comparison frames are retained under `output/audits/public-media-secondary-20260906/` and are not committed to the public repository. The manifest records source/output hashes, measured probes, content acceptance and HTTP evidence.

## Lifecycle and rollback

Use explicit selections for all lifecycle commands, as the default limit is five catalogue entries:

```bash
pnpm --prefix frontend run media:public-renditions prepare --work-dir=/absolute/path --asset-id=veo-3-1-model-demo --asset-id=veo-family-featured --asset-id=hailuo-family-featured
pnpm --prefix frontend run media:public-renditions publish --work-dir=/absolute/path --asset-id=veo-3-1-model-demo --asset-id=veo-family-featured --asset-id=hailuo-family-featured --review-evidence="docs/operations/public-media-secondary-renditions-20260906.md"
pnpm --prefix frontend run media:public-renditions check --http
pnpm --prefix frontend run media:public-renditions activate --asset-id=veo-3-1-model-demo --asset-id=veo-family-featured --asset-id=hailuo-family-featured
pnpm --prefix frontend run media:public-renditions:check
```

Publishing creates immutable derivative objects. Activation changes the browser projection only in this branch until deployed. Reverting the catalogue/manifest/projection commit restores the prior original selection; retain immutable objects and originals. Never delete originals as rollback or restart a whole backfill for this bounded lot.

Before rollout, verify the actual selected reader sources, playback and original actions in preview, and compare production builds under matching mobile/desktop, cold/warm conditions. Smaller files alone do not demonstrate a Core Web Vitals gain. Physical iPhone testing remains unavailable in this session.
