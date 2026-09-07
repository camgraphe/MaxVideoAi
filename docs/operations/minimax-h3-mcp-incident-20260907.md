# MiniMax H3 MCP incident — 7 September 2026

Snapshot: 01:58 UTC (03:58 Europe/Madrid). Production project `shy-flower-71253790`, branch `br-late-term-aeo22xpz`; Vercel deployment `dpl_Ho7DMj7dTCCfmHmdAvyUdUXrBAJ2`.

## Findings

The production audit joined `app_jobs` to `mcp_generation_quotes` to identify MCP submissions created after 6 September 20:00 UTC. This cohort contains 32 H3 jobs and 3 H3 Max jobs. H3 Max's three jobs completed. H3 had 18 completed, 14 failed and none running at this snapshot. Three completed H3 jobs had already received a timeout refund. The two most recent timeout failures may still receive a late provider result, as the earlier jobs did.

The initial eight-job batch from 7 September contains five long-running H3 renders and three definitive downstream errors. This is not a stalled MCP polling cron: recorded polls kept receiving `IN_PROGRESS`.

1. **Missing reference geometry validation.** Nine H3 requests returned HTTP 422 with `image_aspect_ratio_error`. The provider error specifies an inclusive width/height range of 0.4–2.5. The reused stored image `ma_f0d315f9ccf84640bdecbcb22538d449` is 1920 × 548 (ratio 3.5036). Both the stored metadata and provider result confirm the mismatch. These failures include requests with and without audio.
2. **Provider failure.** The three newest jobs returned HTTP 500 with `downstream_service_error`; their inference timings were approximately 148, 262 and 316 seconds. This was independently read from Fal's result API, not inferred from the public generic error message. The application cannot repair the upstream service from this repository.
3. **MCP request lifetime mismatch.** `/api/mcp` has a 120-second runtime, while the Fal submission owner waits up to 240 seconds using `subscribe`. Vercel recorded a 504 timeout even after the provider request ID had been persisted. A slow generation therefore appears as a failed confirmation request.
4. **Premature timeout refunds.** The shared poll policy allowed 35 minutes plus 20 minutes grace. Two jobs were refunded around 58–59 minutes and then completed around 64–65 minutes. Provider latency therefore exceeds the old policy. Successes in the earlier batch also took roughly 24–50 minutes.

## Latest batch

| Job ID | State at snapshot | Charge USD | Refunded USD |
| --- | --- | ---: | ---: |
| `f26c3549-826c-419d-818e-d34fe4434484` | failed | 0.97 | 0.97 |
| `66c2142f-e691-4dc6-84fd-acc161503dbd` | failed | 0.97 | 0.97 |
| `5477e9db-141f-46d7-8cdc-6ff6170238f3` | failed | 0.81 | 0.81 |
| `a63af760-b4a6-41ce-ae74-950b5b33c057` | failed | 1.29 | 1.29 |
| `f3e645d7-728a-4a69-bdf2-9c7e521c7ab2` | failed | 0.81 | 0.81 |
| `ed890288-f7d7-495a-b328-5923bb8face0` | completed | 0.81 | 0.81 |
| `c4d08b37-ef0f-4f8d-8faf-e322affddb1b` | completed | 0.81 | 0.81 |
| `d1595cd2-7d61-4a10-a4d8-97ad2cbdd88a` | completed | 0.81 | 0.81 |

Across the 35-job audit cohort, 17 refunds total USD 14.57. Each inspected job has exactly one charge; each refund matches that job's full charge, with no duplicate refunds. The three late successes retain their refunds and have no replacement charge. The latest eight-job batch is fully refunded (USD 7.28), with three completed outputs and five current failures. Receipt entries were checked directly; these are wallet credits, not card refunds.

## Corrections

- The trusted MCP video continuation selects enqueue-only execution for Fal-primary requests. It awaits the existing provider-ID tracking hook and returns acceptance, without subscribing until render completion. Ordinary site generation and direct-provider routing retain their current behavior.
- Accepted enqueue results use the existing asynchronous lifecycle branch, avoiding a later queued finalization overwriting a fast terminal webhook or refund.
- H3 reference-image fields declare `imageAspectRatio: { min: 0.4, max: 2.5 }`. The common media helper validates trusted dimensions at the site execution boundary and before MCP pricing/confirmation. Missing dimensions and out-of-range images are rejected; model details publish the range and require an owned image asset. The engine catalog was regenerated from its source.
- H3's poll grace is extended to 55 minutes after the normal 35-minute window, for a bounded total of 90 minutes, evaluated on the next scheduled poll. Other engines keep 55 minutes total. Explicit provider terminal failures remain immediately refund-eligible. This 90-minute cap is an operational choice based on observed successful renders, not a provider latency guarantee.

## Validation and remaining work

Regression tests first reproduced the missing geometry check, blocked MCP subscription and premature H3 timeout. Focused tests cover enqueue rejection without resubmission, awaited tracking, ordinary synchronous results, stored geometry versus spoofed client dimensions, exact ratio boundaries, quote rejection before pricing, model details, quote/charge concurrency on disposable PostgreSQL, and timeout refund policy.

ESLint, TypeScript, public-exposure checks, registry/projection checks and the full production build passed. All 4,345 tests passed in an isolated checkout of the incident patch. The first full run identified a legacy MiniMax fixture that needed owned image dimensions; it was updated. The other initial failure came from untracked local audit reports being scanned by the ghost-subdomain test and did not occur in the isolated checkout. A paid end-to-end generation was not run. Local validation uses Node 23; GitHub CI and the project target Node 22. The build reports a Supabase Edge Runtime warning from the existing dependency path.

The corrections are prepared on `codex/audit-minimax-mcp-jobs`; publication and deployment status belong to its pull request. No production database rows, existing refunds, source images or provider jobs were manually changed. No new paid generation was submitted. Deployment is required for the new validation, MCP acceptance and H3 timeout policy to apply. Provider HTTP 500s and variable latency remain outside this patch.

## Provider support references

- HTTP 500: `01a07962-3f31-7310-9634-f8c9867b6eea`, `01a07961-2395-7ff1-abd2-5ce578017242`, `01a07960-0847-7ac2-b7e1-b4fb687e43a1`.
- Late successful outputs: `01a07954-bf12-7731-921e-7e7a2912f834`, `01a07956-0b2c-7971-a914-e1e8b070845b`.
- Ratio rejection example: `01a078a8-d3b3-7f03-9556-1f50fd442b9c`.

No support message has been sent. This report intentionally excludes prompts, private source URLs and credentials.
