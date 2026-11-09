# Connected import evidence — 9 November 2026

Root performed these real IAB imports on optimized product
`b0fda4bbe1994deafa2020832d43f503dde38ded`. The implementer independently read the
actual disposable PostgreSQL data, S3 journal and persisted bytes; no runtime control,
restart, mutation, browser operation or provider request was used for this analysis.

| Imported media | Stored original | Stored derivatives / facts |
| --- | --- | --- |
| `queue-image-fresh.png` | 553,827 B, PNG 960×540, SHA256 `c65a7be95eee943b4f26f3d47722b7c9ac7a08e02c636817e08aea9c1078b425` | Thumbnail WebP 640×360, 20,640 B; display v1 WebP 960×540, 44,550 B. Actual display source URL/SHA, dimensions and byte count all match. |
| `chunk-upload-6s-720p-cbr.mp4` | 6,369,922 B, exact input SHA256 `e390cc82838de6c5dc5684f8452fae56273ed24b0a1310200e5fa1c9ee5b18fe` | Probed 1280×720, 6 seconds, silent; JPEG thumbnail 640×360, 20,822 B. |
| `ambient.wav` | 448,044 B, exact corpus/input SHA256 `e08357c44a2bc2a35cec0e9a29a33ab02ccbd33402eaf245d5f3bc2f515079b2` | Probed 28 seconds with audio; no image/video derivative. |

The selected PNG has 550,342 B and SHA256
`7990d4898e98764ec6a3cd79a27458212aa8d1b030889d5056505714a6b0d73f`.
The existing image upload owner decodes/rotates/re-encodes PNG before content-addressed
storage. Reproducing that normalization in memory produces exactly the stored hash;
the selected and normalized images have equal decoded pixels. The selected-file hash
must not be mislabeled as the stored-original or display source hash.

The original image key has PUT403 at 09:28:18.226 UTC, then PUT200 at
09:29:01.133 UTC after root's explicit Retry. The two following PUT200 writes are
its thumbnail and display. Video and audio originals each have exactly one PUT200,
at 09:28:19.395 and 09:28:19.696 respectively. Their original/derivative keys have no
PUT after the image Retry in the captured journal window. Root observes native queue
states change from two successful/two failed entries to three successful/one invalid
entry, preserving successful entries across close/reopen. `queue-invalid.png` creates
no canonical asset.

Video upload uses two actual temporary objects. Each has one PUT200, one GET200 for
assembly, and DELETE204 at 09:28:19.482. The completed GET response bodies contain
3,670,016 + 2,699,906 = 6,369,922 bytes. No temporary chunk object remains. The final
video's persisted bytes hash exactly matches the supplied video. PUT journal byte
counts are response-body bytes, not uploaded-byte measurements; chunk body counts
are not a claim about TCP delivery or a live storage service.

SQL has three canonical `media_assets` rows, all `ready` and owned by synthetic A.
Six `user_assets` compatibility rows are projections (two per imported medium), not
six more imports. The real exported browse owner, run with PostgreSQL
`default_transaction_read_only=on`, returns each import once with its canonical
`ma_*` asset reference and a private `readAccessRef`. The common total is 139:
135 seed identities + one deliberately later arrival + three imports.

Reproduce only against the matching b0 candidate data before resetting it (the
current candidate connection may identify a later run):

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json experiments/media-library/connected-fixture/analyze-imports.ts
```

The command emits `connected-import-analysis.json` in the configured investigation
root, containing the actual refs, persisted hashes, journal key hashes and timestamps,
chunk events, read-only qualification and capture cutoff. It never emits control
capabilities, cookies, signed URL queries or the database connection string. It uses
a short-lived local worker to invoke the real exported browse owner with a fake-only
environment and read-only database connection. Its type check and executed assertions
pass. An initial `tsx -e` worker exited with empty output in this environment; a normal
temporary script worker resolved that analysis-driver failure without a product change.

Root's initial CDP event collection lost Network enablement after reload. Its empty
list is explicitly **not** evidence of no requests; this no-sibling-reupload finding
uses the independent S3 and SQL evidence above. Root also corrected an old captured
revision/mode constant in the optimized UI recorder, preserving the original artifact
and explicit correction attribution. No performance measurement is inferred from
these functional observations or this analysis.

## Final optimized import recheck

Root repeated native imports on `9df0cb33f35f5bdb8f72e043c79455fc542f25e3`.
The read-only companion command `analyze-final-imports.ts` captured SQL, persisted
byte hashes and the S3 journal before the measurement reset, in
`connected-final-import-analysis.json` outside the repository. It exited0. That
artifact is historical evidence; rerunning after reset does not recreate the imports.

Two different 512×512 PNGs both named `same.png`, each4,096 input bytes, survive as
different canonical `ma_*` identities. Their normalized original hashes are
`9ce4394481523289c06b52a5e3509bab42adee762ec082410bf5f5bf600fe091`
(6,261B) and `a4d47b6c8b24ee351e8c6fd77bd4ca591472b2a016dba039f4b41a6c920e9507`
(6,010B). Each has one original PUT and its own thumbnail/display; the actual display
source binding matches its stored original. The same images first entered through
direct tools and were later reselected in the queue, retaining these identities.
Native chooser `lastModified` was not read: the exact name/MIME/size/mtime collision
claim belongs to the separate real SDK test, not this native observation.

The video was explicitly reselected as a new File. Its existing UUID-based chunk
owner creates two canonical assets at distinct final keys, each6,369,922B and exact
SHA256 `e390cc82838de6c5dc5684f8452fae56273ed24b0a1310200e5fa1c9ee5b18fe`.
No video content-deduplication is claimed. Each upload uses two temporary chunks
(3,670,016 +2,699,906B assembled GET bodies), then DELETE204; all four temporary
objects are removed. The audio retains one canonical448,044B identity with three
PUTs to its same content key across explicit direct/queue selections. Its hash is
the exact original WAV hash in the earlier table. Total: five canonical assets and
ten compatibility projections; these are not ten additional imports.

Native queue observations: the first four-entry batch finishes with four imported;
a second video/audio batch runs under temporary IAB upload throttling. “Pause after
this file” survives close/reopen while video finishes, leaving audio queued;
Continue finishes all six queue entries. Throttling was restored before measurements.
Six successful queue entries do not imply six new canonical assets.

Direct Angle and Image imports display local preview then private S3-authorized
512px media after reload. Direct Audio upload plays its private28-second WAV with
readyState4 and no media error. Imported video selected in Upscale plays its private
1280×720 six-second source with readyState4 and no media error; returning to Library
leaves zero audio/video nodes. These are root IAB observations recorded in
`iab-functional-optimized.json`, distinct from this SQL/byte verification.
