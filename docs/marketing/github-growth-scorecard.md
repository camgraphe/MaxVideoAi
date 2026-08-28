# GitHub commercial-presence growth scorecard

This scorecard records an evidence-based internal assessment of MaxVideoAI's
GitHub commercial presence. It is a planning and verification aid, not an
external benchmark or a claim about third-party performance.

The 2026-08-27 baseline is **46**, rounded from a weighted score of 45.55.
It reflects the current READMEs, GEO analysis, MCP selection scorecard,
available screenshot inventory, and distribution evidence. The planned target
is **85**, rounded from 84.80.

The after score is deliberately unmeasured. Every dimension remains `null`
until Task 18 validates independent repository-file or public-URL evidence.
Completing intervening tasks does not itself establish an after score, and a
target is never treated as after evidence.

Run `pnpm github:score -- --format markdown` to inspect the recorded baseline.
Use `pnpm github:score -- --require-after` only during the Task 18 closeout;
it fails while any after score is absent or unsupported.

## Clean 14-day observation — not yet observed

Implementation is ready for a clean observation after public launch and
instrumentation validation. No 14-day window, values, conversion rate, or
adoption conclusion is recorded here yet. Start the window only after the
tracked-link contract, product analytics, and GitHub traffic export have been
checked together; retain the raw evidence and its extraction date.

| Evidence field | Definition | Observation status |
| --- | --- | --- |
| Human GitHub referral visitors | De-duplicated people reaching a MaxVideoAI website destination from the approved GitHub UTM tuple. | Pending clean 14-day window |
| Bot and crawler referrals | Identified automated traffic, previews, scanners, and crawlers; report separately from people. | Pending clean 14-day window |
| CI release downloads | Automated release-asset retrieval, package checks, and CI downloads; exclude from human acquisition. | Pending clean 14-day window |
| Clone traffic | GitHub clone counts and anomalous spikes, retained as distribution context only. | Pending clean 14-day window |
| OAuth starts and completions | Approved GitHub-attributed funnel events, reported as distinct raw counts. | Pending clean 14-day window |
| First recommendation or budget | First no-spend model recommendation or project-budget event for the attributed journey. | Pending clean 14-day window |
| Quote, confirmation, completion, Library, repeat generation | Separate raw funnel events, without prompts, media, tokens, emails, account identifiers, arbitrary URLs, or raw referrers. | Pending clean 14-day window |

Do not turn a clone spike, CI download, crawler visit, or unverified referral
into an adoption claim. Any later conversion interpretation must use the
separated human and funnel evidence above, state its window and exclusions, and
remain an evidence-only update rather than a score change by default.
