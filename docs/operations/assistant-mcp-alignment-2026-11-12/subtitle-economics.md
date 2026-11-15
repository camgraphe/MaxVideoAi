# Subtitle bundle and unit economics — 12 November 2026

Adrien approved one paid subtitle bundle with corrections, SRT/VTT, sequence-mix
preparation and captioned MP4 included. He then requested a 200% markup because the
supplier price is low. This means exact supplier transcription cost × 3, before
canonical rounding. The four other creator products retain their 120% markup.

The local policy is `creator-subtitles:provider-plus-200:v1`. No production tariff,
supplier account or remote configuration was changed. Previously accepted jobs
retain their exact stored charges/refunds. Unaccepted quotes from the old policy
require a fresh quote even when the displayed cent amount happens to be unchanged.

The later revision-bound render button reads “Export MP4 — included”. It confirms
the exact saved render operation without a new customer charge. Reads, reloads,
corrections and downloads cannot start another transcription or provider attempt.

## Supplier and customer prices

The current route uses fal Scribe v2. Its [official model page](https://fal.ai/models/fal-ai/elevenlabs/speech-to-text/scribe-v2), checked 2026-11-12, lists USD 0.008 per input-audio minute and a 30% surcharge when keyterms are supplied. This is a public list reference, not the account invoice.

The true local canonical calculation is recorded in `subtitle-prices.json`:

| Audio duration | Supplier list cost | Subtitle bundle | Bundle with keyterms |
| --- | --- | --- | --- |
| 10 seconds | USD 0.001333… | USD 0.01 | USD 0.01 |
| 30 seconds | USD 0.004 | USD 0.01 | USD 0.03 |
| 1 minute | USD 0.008 | USD 0.03 | USD 0.04 |
| 4 minutes | USD 0.032 | USD 0.10 | USD 0.13 |
| 10 minutes | USD 0.08 | USD 0.24 | USD 0.31 |
| 30 minutes | USD 0.24 | USD 0.72 | USD 0.94 |

Supplier cost with keyterms is USD 0.0104/minute. The canonical kernel rounds margin
upward, then rounds the customer total. Do not multiply an already rounded retail
amount or infer an exact per-second customer quote from this table. Before the
requested change, ordinary 1/4/10-minute customer totals were USD 0.02/0.07/0.18.

## Global cost model and uncertainty

The [official Frankfurt ECS catalogue](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/eu-central-1/index.json), fetched 2026-11-12, lists USD 0.04656 per vCPU-hour and USD 0.00511 per memory GiB-hour. The peer-owned dedicated worker reference has 2 vCPU and 4 GiB: compute is USD 0.11356/hour, about USD 0.001893 per task-minute. The rates and assumptions are retained in `subtitle-fargate-rates.json`.

Estimated variable cost:

```text
0.008 × input audio minutes
+ 0.001893 × billed reference task minutes
+ storage, transfer, logs and IP charges
```

This excludes account-specific discounts, keyterms, taxes and application/payment
overhead. [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/) counts task
runtime from image download through termination, with a one-minute Linux minimum.
Separate source preparation, mix and later render tasks can each consume runtime.
One minute of source video does not establish one billable task-minute.

For illustration only, one minute of audio and one reference task-minute would
cost USD 0.009893 before those other charges; five task-minutes would cost
USD 0.017463. Actual global unit economics require production sizing, task counts,
measured durations and account invoices. Therefore ×3 applies to the transcription
supplier reference; it does not establish 200% net margin on the complete service.

The marketplace owner also reported a historical dedicated Studio export with
2 vCPU/4 GiB and 115.064 seconds between pull start and task stop. It is not a standard
subtitle benchmark and is not used to predict subtitle render duration. No task,
provider render or remote compute was launched here to obtain these figures.

## Verification

Native arithmetic covers all rows, fractional cents, keyterms and unchanged
pricing for the four other tools. Real PG17 tests reject stale 120% snapshots,
including a 1 cent → 1 cent case; preserve the accepted old 7 cent charge/refund; and verify
new standalone/mix quotes, one reservation/dispatch, and included zero-charge
platform exports. Native Milo tests retain explicit approval, lost-acknowledgement
recovery, exact subtitle revisions and download links.
