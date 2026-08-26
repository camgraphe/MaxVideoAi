# MCP acquisition search baseline

This baseline records the read-only Google Search Console view used to set intent boundaries before MCP promotion. It
is not a forecast, launch result, or indexation claim.

## Current site-level capture

- Property: `sc-domain:maxvideoai.com`
- Captured: 2026-08-26
- Date range: May 25–Aug 24, 2026 (last 3 months)
- Search type: Web
- GSC freshness at capture: last update approximately 4.5 hours earlier
- Whole site: 6,314 clicks, 491,440 impressions, 1.3% CTR, average position 10.2
- Generative AI features: 27,759 impressions. The homepage accounted for 4,835 of those impressions.

The highest displayed generative-feature owners were the Seedance 2.0 comparison
(5,420 impressions), homepage (4,835), LTX examples (1,641), another Seedance
comparison (1,535), and Veo/Gemini comparison pages. These are the highest-value
contextual-link sources for the future plugin hub; they are not MCP-attributed
traffic.

## Earlier query-group capture

- Captured: 2026-07-13
- Date range: Apr 12–Jul 11, 2026 (last 3 months)
- Whole site at that capture: 5,638 clicks, 571,753 impressions, 1% CTR, average position 8.6

The filtered query groups below were recorded during that earlier capture and
remain useful for intent boundaries. GSC warns that filtered totals and the
query table may be partial. They must not be combined with the newer site-level
totals or treated as current MCP performance.

## Query-group baseline

| Query filter | Clicks | Impressions | Displayed CTR | Average position | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Price/budget regex `(price|pricing|cost|cheap|cheapest|budget|affordable)` | 1 | 2,146 | 0% | 17 | Example demand includes `sora 2 pro price` (171 impressions, position 15.4), `ltx pricing` (117, 12.5), `ltx 2.3 pricing` (89, 10.7), `ai video pricing` (85, 29.7), `ltx 2 price` (72, 10.8), and `ai video generator pricing` (68, 46.1). |
| Best regex `(best)` | 6 | 1,928 | 0.3% | 13 | Existing traffic is concentrated in LTX prompt and best-practice queries. |
| Claude regex `(claude)` | 0 | 0 | — | — | No measured baseline demand in this view. |
| Codex regex `(codex)` | 0 | 0 | — | — | No measured baseline demand in this view. |
| MCP regex `(mcp)` | 0 | 1 | 0% | 10 | The only displayed query was `kling ai mcp`. |
| Prompt regex `(prompt)` | 511 | approximately 15,000 | 3.4% | 7.4 | Strong existing ownership comes from LTX prompt pages. |
| Multilingual reference regex `(reference|references|référence|références|referencia|referencias)` | 3 | 87 | 3.4% | 19.6 | Displayed demand is mainly Kling and Seedance reference-video queries. |

## Primary intent ownership

| Surface | Primary intent owner | Boundaries that prevent cannibalization |
| --- | --- | --- |
| `/mcp` | Broad category intent for an AI video plugin for ChatGPT and Claude: prepare prompts and references, compare models and film budgets, review price before generation, and approve separately. | Do not target broad “best prompts,” model-specific pricing, or technical endpoint/auth queries. |
| `/integrations/chatgpt` | ChatGPT-specific installation, workflow, account continuity, credits, gallery, troubleshooting, and disconnect. | Link back to the hub for product comparison; retain protocol detail in the technical guide. |
| `/integrations/claude` | Claude-specific setup, recorded compatibility, workflow, troubleshooting, revocation, and disconnect. | Link back to the hub for product comparison; do not duplicate the full protocol reference. |
| `/integrations/codex` | Codex-specific setup, explicit-scope compatibility, workflow, troubleshooting, revocation, and disconnect. | Link back to the hub for product comparison; do not duplicate the full protocol reference. |
| `/docs/mcp` | Technical endpoint, OAuth, tool registry, annotations, reference limitations, error recovery, and security intent. | Keep the protocol endpoint inside technical configuration, never as an indexable source-page URL. |
| `/pricing` | Canonical price and wallet policy, price matrix, refunds, and detailed pricing comparisons. | Retains broad price/pricing intent; `/mcp` explains only how a selected scenario is priced and confirmed. |
| `/pay-as-you-go-ai-video-generator` | Pay-as-you-go, no-subscription, cheap/affordable and variable-budget transactional intent. | Retains cost-model comparison intent and links contextually to the agent-assisted planning workflow only after publication. |
| `/models` and `/models/{slug}` | Model-specific price, specifications, modes, audio, references, duration and resolution. | MCP pages refer to current catalog facts without duplicating model-specific price/spec/reference coverage. |
| Existing prompt and best-practice pages | Model-specific prompts, examples and best practices, especially the existing LTX query cluster. | `/mcp` may describe prompt planning, but must not compete for “best prompts” or reproduce model prompt guides. |
| `/examples` and model example routes | Real output discovery and model-specific visual evidence. | Examples link to the workflow only as a next step after the MCP publication gate opens. |

## Publication and measurement guardrails

- `frontend/config/mcp-publication.json` remains the only indexation decision. At this capture its checked-in flags do
  not permit public indexing.
- No MCP source page belongs in a generated sitemap, `llms.txt`, footer, docs discovery, models, examples, or
  pay-as-you-go internal links while `indexable` is false.
- The generated `llms.txt` must remain free of the five future MCP source URLs until the shared gate is enabled. At
  activation, add the hub, the three client guides, and the technical guide together with their distinct intent labels;
  never list `https://api.maxvideoai.com/mcp` as a source page.
- Robots access does not publish a route. Search/answer crawlers may read public content, while sitemaps, metadata,
  `llms.txt`, internal links, and the publication gate determine promotion.
- Do not submit a sitemap, request indexing, change Search Console configuration, or annotate GSC as part of this
  baseline task.
