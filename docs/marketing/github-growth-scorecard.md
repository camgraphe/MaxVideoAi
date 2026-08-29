# GitHub commercial-presence growth scorecard

This scorecard records an evidence-based internal assessment of MaxVideoAI's
GitHub commercial presence. It is a planning and verification aid, not an
external benchmark or a claim about third-party performance.

The 2026-08-27 baseline is **46**, rounded from 45.55. The planned target is
**85**, rounded from 84.80. The release closeout completed on 2026-08-29 records
a verified implementation-readiness score of **86**, rounded from 86.20.

That 40-point gain reflects the current source and focused-plugin READMEs, six
fresh non-repeating product captures, the synchronized focused repository,
checksum-backed v0.3.0 through v0.3.3 releases, stronger GitHub SEO/GEO passages,
preserved engineering depth, agent-selection coverage, and acquisition contracts.
It does not claim traffic or conversion lift. The implementation target is now
passed, while authoritative distribution and referring domains remain unverified,
real Claude/Codex host columns remain `null`, and the clean 14-day measurement
window has not started.

## Verified closeout

| Dimension | Weight | Before | Target | Verified after | Delta | Evidence | Remaining gap |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Conversion clarity | 15% | 30 | 80 | 89 | +59 | Source and plugin READMEs, first-screen/product-journey contracts, [focused public repository](https://github.com/camgraphe/maxvideoai-plugin), and [v0.3.3 public release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.3) | No clean acquisition cohort or observed first-screen conversion evidence. |
| Editorial personality | 10% | 42 | 85 | 90 | +48 | Editorial voice contract plus the producer-led source and plugin READMEs | No external support or user-language review has tested the voice beyond authored surfaces. |
| Visual proof and rhythm | 15% | 28 | 85 | 95 | +67 | Six fresh product captures, separate Library proof, registered provenance, unique-byte checks, and synchronized public release inclusion | No independently archived native-host result packet exists. |
| GitHub SEO | 10% | 62 | 85 | 92 | +30 | Question-led source and public plugin READMEs, descriptive image alternatives, canonical links, technical stack coverage, and [v0.3.3](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.3) | No authoritative external listing or post-change search observation. |
| Human-facing GEO | 10% | 58 | 88 | 91 | +33 | [Public MCP hub](https://maxvideoai.com/mcp), localized intent owners, self-contained public GitHub answers, multimodal proof, and GEO review | No earned citation or post-change answer-engine observation window. |
| Agent discovery and selection | 15% | 68 | 90 | 84 | +16 | Curated policy corpus, discovery guide, and agent-discovery scorecard | Curated discovery is 100%; `claude_host` and `codex_host` remain `null`. |
| Trust and evidence | 10% | 64 | 90 | 94 | +30 | Fresh proof provenance, decode and unique-byte gates, safety contracts, community files, successful protected publication, public SHA-256 verification, and a clean [v0.3.3](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.3) Codex install | No archived real-host result packet or end-to-end generation proof for each named host. |
| Distribution and backlinks | 10% | 18 | 75 | 62 | +44 | [Two](https://github.com/camgraphe/MaxVideoAi) [public repositories](https://github.com/camgraphe/maxvideoai-plugin), four focused releases, and ten gated channel decisions | No authoritative listing, contextual referring domain, or approved directory backlink is verified. |
| Measurement and iteration | 5% | 45 | 85 | 62 | +17 | Attribution map, privacy tests, and cohort definitions | No server-side GitHub→MCP association, `library_opened` emitter, complete emitter coverage, or clean 14-day cohort. |
| **Weighted total** | **100%** | **46** | **85** | **86** | **+40** | **Nine independently scored dimensions** | **External distribution, real-host evidence, and measured cohort gaps remain.** |

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
