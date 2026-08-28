# GitHub commercial-presence growth scorecard

This scorecard records an evidence-based internal assessment of MaxVideoAI's
GitHub commercial presence. It is a planning and verification aid, not an
external benchmark or a claim about third-party performance.

The 2026-08-27 baseline is **46**, rounded from 45.55. The planned target is
**85**, rounded from 84.80. The evidence review completed on 2026-08-28 records
a verified implementation-readiness score of **82**, rounded from 81.50.

That 36-point gain reflects the live focused README, public checksum-backed
v0.3.0 and v0.3.1 releases, better proof discipline, GEO surfaces,
agent-selection coverage, and acquisition contracts. It does not claim traffic
or conversion lift. The result stays below target because authoritative
distribution and referring domains are unverified, real Claude/Codex host
columns remain `null`, the separate 0.3.2 candidate is unpublished, and the
clean 14-day measurement window has not started.

## Verified closeout

| Dimension | Weight | Before | Target | Verified after | Delta | Evidence | Remaining gap |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Conversion clarity | 15% | 30 | 80 | 82 | +52 | [Focused public README](https://github.com/camgraphe/maxvideoai-plugin) and [latest public release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.1) | No clean acquisition cohort or observed first-screen conversion evidence. |
| Editorial personality | 10% | 42 | 85 | 88 | +46 | Editorial voice contract and now-public plugin README | No external support or user-language review has tested the voice beyond authored surfaces. |
| Visual proof and rhythm | 15% | 28 | 85 | 86 | +58 | Public proof-led README and social preview; reviewed source manifest and narrow selector/result composite | The source refresh is not yet in a later public release, and no independently archived native-host result packet exists. |
| GitHub SEO | 10% | 62 | 85 | 88 | +26 | Indexable focused README, eight live topics, canonical links, and [two](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.0) [public releases](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.1) | No authoritative external listing or post-change search observation. |
| Human-facing GEO | 10% | 58 | 88 | 84 | +26 | [Public MCP hub](https://maxvideoai.com/mcp), localized intent owners, and GEO review | No earned citation or post-change answer-engine observation window. |
| Agent discovery and selection | 15% | 68 | 90 | 84 | +16 | Curated policy corpus, discovery guide, and agent-discovery scorecard | Curated discovery is 100%; `claude_host` and `codex_host` remain `null`. |
| Trust and evidence | 10% | 64 | 90 | 88 | +24 | Proof manifest, safety gates, community files, and public [v0.3.0](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.0) / [v0.3.1](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.1) checksum assets | No archived real-host result packet; the separate 0.3.2 candidate has not completed its own gate. |
| Distribution and backlinks | 10% | 18 | 75 | 58 | +40 | [Two](https://github.com/camgraphe/MaxVideoAi) [public repositories](https://github.com/camgraphe/maxvideoai-plugin), two focused releases, and ten gated channel decisions | No authoritative listing, contextual referring domain, or approved directory backlink is verified. |
| Measurement and iteration | 5% | 45 | 85 | 62 | +17 | Attribution map, privacy tests, and cohort definitions | No server-side GitHub→MCP association, `library_opened` emitter, complete emitter coverage, or clean 14-day cohort. |
| **Weighted total** | **100%** | **46** | **85** | **82** | **+36** | **Nine independently scored dimensions** | **Distribution, host evidence, the 0.3.2 candidate gate, and measured cohort gaps remain.** |

Run `pnpm github:score -- --require-after --format markdown` to reproduce the
recorded totals. The machine-readable scorecard links every after value to
repository-file or public-URL evidence; no target value was copied into after.

## Clean 14-day observation — not yet observed

Implementation is ready for a clean observation after public launch and
instrumentation validation. No 14-day window, values, conversion rate, or
adoption conclusion is recorded here yet. Start the window only after the
tracked-link contract, product analytics, and GitHub traffic export have been
checked together; retain the raw evidence and its extraction date.

The tested browser journey projection only proves that an approved GitHub UTM
tuple can be attached to a browser analytics event. It does not establish a
server-side MCP funnel association, durable opaque landing-to-MCP binding, or
production event-emitter coverage. In particular, `library_opened` has no
current emitter. These are a **Task 18 immediate blocker**: exclude downstream
MCP counts from the 14-day baseline until the association and each real emitter
are implemented and independently validated.

| Evidence field | Definition | Observation status |
| --- | --- | --- |
| Human GitHub referral visitors | De-duplicated people reaching a MaxVideoAI website destination from the approved GitHub UTM tuple. | Pending clean 14-day window |
| Bot and crawler referrals | Identified automated traffic, previews, scanners, and crawlers; report separately from people. | Pending clean 14-day window |
| CI release downloads | Automated release-asset retrieval, package checks, and CI downloads; exclude from human acquisition. | Pending clean 14-day window |
| Clone traffic | GitHub clone counts and anomalous spikes, retained as distribution context only. | Pending clean 14-day window |
| OAuth starts and completions | Server-side MCP funnel events, which are not yet associated with a GitHub browser journey. | Excluded pending association and emitter validation |
| First recommendation or budget | First no-spend model recommendation or project-budget event for the attributed journey. | Excluded pending real emitter coverage |
| Quote, confirmation, completion, Library, repeat generation | Separate raw funnel events; `library_opened` has no current emitter. | Excluded pending association and emitter validation |

Do not turn a clone spike, CI download, crawler visit, or unverified referral
into an adoption claim. Any later conversion interpretation must use the
separated human and funnel evidence above, state its window and exclusions, and
remain an evidence-only update rather than a score change by default.

The dependency-ordered operating plan is maintained in
`docs/marketing/github-next-task-queue.md`. It creates no scheduled task or
recurring automation.
