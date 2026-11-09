# Optimized connected comparison — 9 November 2026

The exact image012 reader requests **95.99% fewer response-body bytes**, while
decoding the same1024×1536 dimensions: baseline original PNG2,280,434B versus
candidate display WebP91,534B. This is a measured media-role/body-size improvement,
not a global latency or Core Web Vitals result. The WebP is lossy; equal dimensions
do not assert pixel-identical quality. Canonical original identity remains separate.

Root operated the actual optimized application through IAB. Baseline source is
`5135e4e2b7ad04261d26b3f7669eb2ec8aded1db`, candidate source is
`9df0cb33f35f5bdb8f72e043c79455fc542f25e3`. Both normal builds passed their gates.
One Next process ran at a time, without concurrent builds or test suites. The same
synthetic media seed, actual SQL owners, jobs complement v2 and registered bytes
were reset between passes. No timestamp/product ordering rewrite was applied.

Three rounds alternate baseline→candidate for each condition: desktop1440×900 or
mobile390×844 (DPR1), cache disabled or cache enabled after an explicit prime.
That yields24 passes, each with10 operations: saved-image load, scroll, exact012
open, close, recent-video load, exact097 open, Play, Save, close, saved-video revisit.
All24 image decodes,24 video Plays and24 exact-output saves pass; all48 closes have
no dialog or audio/video readers. Video097 decodes960×540, duration5s, with playback
progress and no media error. Save requests target `fixture-job-0/fixture-097`.

The raw recorder has250 entries. Ten qualification entries are explicitly excluded;
one Save wall interval of32,633ms contains a controller gap and was replaced by the
complete measured pass. The240 retained entries form24 complete passes, with no
timeout or truncated capture. Exclusions remain recorded rather than erased.

| Exact012 cold HTTP, three repetitions per cell | Baseline | Candidate |
| --- | ---: | ---: |
| Response body, desktop and mobile | 2,280,434B original PNG | 91,534B display WebP |
| Decoded dimensions, desktop and mobile | 1024×1536 | 1024×1536 |
| CDP start→finish range, desktop | 7.274–7.701ms | 1.782–2.292ms |
| CDP start→finish range, mobile | 7.431–10.711ms | 2.121–2.337ms |

These requests are actual private S3 HTTP200 responses, completed and not marked
disk/service-worker/cache-served. Body length agrees with CDP decoded data bytes;
browser encoded length includes additional protocol bytes and is recorded separately.
The local request durations above exclude UI decode/controller latency and do not
predict WAN/CDN or real-device behavior. The12 cache-enabled exact012 requests also
report no cache hit; “primed” describes the protocol, not proven private-cache reuse.

| Descriptive first-load geometry (all six observations per variant/viewport) | Baseline | Candidate |
| --- | ---: | ---: |
| Desktop mounted cards | 30 | 30 |
| Desktop grid top / height | 241 /631px | 299 /526px |
| Mobile mounted cards | 30 | 12 virtualized |
| Mobile grid top / height | 263 /2,826px document grid | 351 /366px inner scroller |

The initial30 saved-image sets differ at tied timestamps030/031. Mounting and scroll
models differ too. These counts/geometries are descriptive; they do not establish a
causal whole-page speedup. The separate native mobile correction reduced candidate
grid top from632px to351px while retaining accessible controls, bottom navigation
and focus return; that before/after observation is not the baseline comparison.

RPC wall intervals include IAB/controller overhead (including different click and
Space playback primitives). The machine-readable output preserves their min/median/
max per operation/condition but labels them **not product latency**. No aggregate
wall-time speedup, LCP, INP, CLS or field CWV conclusion is claimed. Public synthetic
generated media use scoped IAB Image/Media body fulfillment, distinct from private
S3 HTTP; queued fulfillment bytes are not TCP delivery measurements. Request counts
are per-operation captures and are not summed as unique network traffic.

## Reproducible evidence and retention

Run the offline standard-library analyzer against the retained raw IAB file:

```sh
python3 experiments/media-library/connected-fixture/analyze-comparison.py \
  <local-investigation-directory>/iab-comparison.json \
  experiments/media-library/connected-fixture/comparison-results.json
```

[comparison-results.json](comparison-results.json) is an explicit allowlisted
projection: input basename/SHA256, exclusions, source pins, measured roles, byte
counts, cache flags, raw-derived CDP intervals and grouped observations. It contains
no origin, signed URL, cookie, session, capability, request headers or body text.
The raw input SHA256 is
`50b42c2c61163fcce5e9d6395801e3864956f1102ccac6662214205645b1ff26`.
[comparison-provenance.json](comparison-provenance.json) preserves seed, media
identity projection, source/installed locks, Node, harness and jobs-builder/migration
hashes. Historical source locks and startup/bootstrap helpers differ explicitly;
installed dependencies and actual paired media/jobs inputs match. The baseline's
older reset needs the guarded jobs complement reapplied, as described in README.

The measured baseline's frontend tree is exactly equal to public commit
`6e12d08ca07c423615e862b6ca1bd47d0f5ffa59`: both Git trees are
`79b792aad5286b1841edfa6ff02ddb32dcfbcf51`, and both root-lock Git blobs are
`b6550a6829ac9d6497d6f02f40fe744c90bdefc6`. This was verified with `git rev-parse`
for both revisions. A reproduction can export that public commit with the same
fixture, installed dependencies and explicit jobs complement, without publishing
prototype scratch history. Measurements remain attributed to5135; no second run
on6e12 is asserted. The final preview also has a later Subtitle-only correction;
its normal build and source identity are documented separately in VERIFICATION.md,
without reattributing these9df measurements to that later source.

Raw IAB observations, screenshots, runtime/build manifests, journals and original
redacted logs remain in the local investigation directory. They are not committed.
Retain them with this summary before deleting ignored SDD scratch. A raw evidence
review must redact again before any external sharing. Native Creator/Studio execution
remains release-gated locally; generic download remains constrained by existing SSRF
policy. No paid generation, live customer service, remote CI or deployment is claimed.
