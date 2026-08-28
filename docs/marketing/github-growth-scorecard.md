# GitHub commercial-presence growth scorecard

This scorecard records an evidence-based internal assessment of MaxVideoAI's
GitHub commercial presence. It is a planning and verification aid, not an
external benchmark or a claim about third-party performance.

The 2026-08-27 baseline is **46**, rounded from 45.55. The planned target is
**85**, rounded from 84.80. The evidence review completed on 2026-08-28 records
a verified implementation-readiness score of **77**, rounded from 76.70.

That 31-point gain reflects better repository composition, proof discipline,
GEO surfaces, agent-selection coverage, and acquisition contracts. It does not
claim traffic or conversion lift. The result stays below target because the
focused public repository is still bootstrap-only, authoritative distribution
is unverified, real Claude/Codex host columns remain `null`, and the clean
14-day measurement window has not started.

## Verified closeout

| Dimension | Weight | Before | Target | Verified after | Delta | Evidence | Remaining gap |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Conversion clarity | 15% | 30 | 80 | 76 | +46 | Flagship plugin README and [focused public repository](https://github.com/camgraphe/maxvideoai-plugin) | The public plugin repository has no README; the product README remains stale above the fold. |
| Editorial personality | 10% | 42 | 85 | 86 | +44 | Editorial voice contract and reviewed plugin README | Public product-repository copy still trails the reviewed branch voice. |
| Visual proof and rhythm | 15% | 28 | 85 | 80 | +52 | Asset manifest, registered proof composites, and live custom social preview | No public plugin README yet applies the planned visual rhythm; product social/README presentation remains generic. |
| GitHub SEO | 10% | 62 | 85 | 82 | +20 | Focused metadata, eight live topics, canonical links, and distribution matrix | No indexable plugin README or tagged release in the focused repository. |
| Human-facing GEO | 10% | 58 | 88 | 84 | +26 | [Public MCP hub](https://maxvideoai.com/mcp), localized intent owners, and GEO review | No earned citation or post-change answer-engine observation window. |
| Agent discovery and selection | 15% | 68 | 90 | 84 | +16 | Curated policy corpus, discovery guide, and agent-discovery scorecard | Curated discovery is 100%; `claude_host` and `codex_host` remain `null`. |
| Trust and evidence | 10% | 64 | 90 | 82 | +18 | Proof manifest, safety gates, community files, and [public 0.2.0 release](https://github.com/camgraphe/MaxVideoAi/releases/tag/maxvideoai-plugin-v0.2.0) | The focused repository has no release/checksum or archived real-host result packet. |
| Distribution and backlinks | 10% | 18 | 75 | 42 | +24 | [Two](https://github.com/camgraphe/MaxVideoAi) [public repositories](https://github.com/camgraphe/maxvideoai-plugin) and ten gated channel decisions | No authoritative listing or contextual referring domain is verified; the focused repository is bootstrap-only. |
| Measurement and iteration | 5% | 45 | 85 | 62 | +17 | Attribution map, privacy tests, and cohort definitions | No server-side GitHub→MCP association, `library_opened` emitter, complete emitter coverage, or clean 14-day cohort. |
| **Weighted total** | **100%** | **46** | **85** | **77** | **+31** | **Nine independently scored dimensions** | **Launch, distribution, host evidence, and measured cohort gaps remain.** |

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
