# MaxVideoAI Plugin GEO Analysis

Checked: 2026-08-26

Scope: the MCP/plugin acquisition implementation on branch codex/mcp-foundation-clean, not the current production visibility of maxvideoai.com.

## Terminology Decision

The commercial umbrella is **“MaxVideoAI for ChatGPT and Claude”** or **“AI video plugin”**. Client-specific installation copy uses the name shown by that client: **ChatGPT app/plugin**, **Claude plugin or custom connector**, and **Codex plugin**. **MCP server** remains the precise protocol term for technical documentation, developers, and long-tail search intent.

This prevents “MCP” from becoming a comprehension barrier without hiding the interoperable mechanism. It also avoids claiming that one tested OpenAI surface automatically proves every ChatGPT and Codex surface. Compatibility remains recorded per host and install path.

OpenAI’s current plugin documentation places plugins across ChatGPT desktop/web/remote and Codex CLI/IDE/cloud surfaces. The strategy can therefore lead with the much broader “ChatGPT” demand while retaining a dedicated Codex page for technical intent. One shared MaxVideoAI package is the target; surface-by-surface evidence remains the publication gate.

Primary terminology references to recheck before publication:

- OpenAI plugin overview: https://developers.openai.com/plugins
- OpenAI skills and plugins: https://learn.chatgpt.com/docs/skills-and-plugins
- OpenAI enterprise apps and connectors: https://learn.chatgpt.com/docs/enterprise/apps-and-connectors
- Claude plugins: https://support.claude.com/en/articles/13837440-use-plugins-in-claude
- Claude custom remote connectors: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Model Context Protocol introduction: https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro

## GEO Readiness Score: 74/100

This is an implementation-readiness score, not an organic-traffic forecast. The public routes remain excluded by checked-in publication flags, so production discoverability is intentionally zero. The branch now has five localized intent owners, prospect-facing copy, credit/library/reference answers, a homepage entry and a live-catalog architecture. The largest remaining gaps are honest job-backed proof, final ChatGPT host evidence, a public GitHub release, and production publication.

| Criterion | Score | Current evidence |
| --- | ---: | --- |
| Passage-level citability | 21/25 | Server-rendered answers now define the product, price/approval, credits/top-up, gallery continuity, references, failures, and disconnect without internal rollout language. |
| Structural readability | 18/20 | Five distinct localized intent owners, clear headings, visible questions, breadcrumbs, client guides, and an indexable technical reference. |
| Multi-modal proof | 2/15 | The proof component exists, but getMcpProof currently returns null and the previous provider-example candidate was correctly rejected. |
| Authority and brand signals | 13/20 | Exact hosted Claude/Codex evidence, editorial/site entities, GitHub-ready plugin files, profiles, and GSC data exist. A public release, job-backed demo, and earned mentions are not established. |
| Technical accessibility | 20/20 | Server-rendered pages, five-page sitemap/llms source set, crawler controls, ChatGPT route, publication gates, localized paths, and contextual-link architecture are implemented. |

## Platform Breakdown

| Platform | Readiness | Main strength | Main gap |
| --- | ---: | --- | --- |
| Google AI Overviews | 76/100 | Existing domain visibility, server-rendered answer passages, localized routes, and contextual links from strong product pages. | Pages remain gated; no job-backed proof or observed search performance yet. |
| ChatGPT search and app discovery | 72/100 | Dedicated ChatGPT intent owner, OpenAI-oriented terminology, allowed retrieval crawlers, plugin package, and remote MCP foundation. | Final ChatGPT desktop host test and public installation/release are still required. |
| Perplexity | 60/100 | Concise answers, localized technical guide, live-model architecture, and crawler access are ready. | No public repository release, community validation, or publishable proof media. |

## AI Crawler Access Status

The public robots policy intentionally separates search/retrieval from training:

- Allowed on public marketing while private paths remain blocked: OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-User, Claude-SearchBot, and Google-Extended.
- Blocked from public content as training-only crawlers: GPTBot, ClaudeBot, anthropic-ai, Claude-Web, CCBot, Bytespider, and cohere-ai.
- The protocol host returns Disallow: / for every crawler.
- Authenticated account, billing, app, jobs, API, OAuth, uploads, admin, and other private surfaces remain disallowed.

This is a deliberate product/data-policy decision. It should not be changed merely to chase a GEO score.

## llms.txt Status

The site has a generated /llms.txt with public MaxVideoAI sources and private-surface exclusions. Its MCP section is correctly omitted while the shared publication gate is closed.

Before plugin indexation, the MCP source set must contain exactly:

1. /mcp — commercial workflow and product definition;
2. /integrations/chatgpt — ChatGPT installation and video workflow;
3. /integrations/claude — Claude connector/plugin installation and workflow;
4. /integrations/codex — Codex plugin/MCP installation;
5. /docs/mcp — protocol, OAuth, tools, credits, references, library, recovery, and revocation.

The raw api.maxvideoai.com/mcp endpoint must not be listed as a content source.

## Brand Mention Analysis

Repository evidence currently declares organization profiles for X, LinkedIn, GitHub, and Product Hunt. That establishes intended entity links, not proof that those profiles are active, authoritative, or mentioning the plugin.

Current gaps:

- no dedicated public MaxVideoAI plugin/MCP repository and tagged release;
- no publishable ChatGPT/Claude/Codex demo backed by a MaxVideoAI job;
- no recorded YouTube proof or plugin walkthrough;
- no audited Reddit/community discussion;
- no verified external directory listing.

External brand mentions must be earned through useful releases, demos, documentation, and support. Do not manufacture reviews, Reddit posts, testimonials, or directory claims.

## Passage-Level Citability

### Existing passages worth preserving

- The hub already has a server-rendered “Direct answers” owner.
- Model choice, exact pricing, references, confirmation, and disconnect are separated into extractable sections.
- Compatibility dates are data-driven rather than typed into JSX.
- The technical docs have a dedicated canonical route and TechArticle-style architecture.

### Implemented answer passages

The branch now uses self-contained product answers suitable for extraction:

- “MaxVideoAI for ChatGPT and Claude connects your AI assistant to MaxVideoAI’s current video and image models, prices, references, and generation workflow.”
- “Model recommendations are free; MaxVideoAI returns an exact quote before a paid generation and waits for your explicit approval.”
- “If the balance is too low, the assistant opens a secure MaxVideoAI top-up page. After funding, it checks the balance and prepares a new quote because the old quote has expired.”
- “Completed images and videos are saved to the connected MaxVideoAI account and remain available in the media library.”
- “Reference support depends on the chosen model. The assistant can select existing private image, video, or audio assets or open a secure MaxVideoAI upload handoff.”

Each final page should contain one concise definition near the top and question-led supporting sections. Exact word count is secondary to clarity, factual completeness, and the ability to quote the passage without missing context.

## Server-Side Rendering Check

Pass:

- /mcp and integration pages are Server Components with server-built metadata and JSON-LD.
- Answer passages render in HTML rather than requiring a client-side chat simulation.
- The homepage is server-rendered and can insert the plugin module without converting the route to a Client Component.

Risks to prevent:

- do not put the only product explanation inside an animated/client-only conversation;
- do not fetch model counts or proof exclusively after hydration;
- do not hide key copy behind tabs that are absent from initial HTML;
- do not make a copied endpoint or install button the only descriptive element.

## Top 5 Highest-Impact Changes

1. Publish one job-backed, checksum-backed proof flow showing brief, recommendation, quote, approval, result, and library continuity.
2. Complete the ChatGPT desktop install/OAuth/tool-selection check and record the exact client version.
3. Publish the GitHub plugin package and a tagged release with links back to the five owned source pages.
4. Activate production flags only after transport, OAuth, generation, references, monitoring, legal, and rollback gates pass.
5. Earn external mentions through a useful demo and documentation; pursue only directories whose current rules permit the complete product.

## Schema Recommendations

- Keep BreadcrumbList on the hub, integration pages, and technical docs.
- Use SoftwareApplication or WebApplication for the visible connected MaxVideoAI product only when availability and capabilities match the page.
- Use VideoObject for the verified proof media only when the visible player, thumbnail, duration, upload date, and provenance fields exist.
- Keep the MaxVideoAI Organization entity and maintained sameAs profiles consistent across layouts.
- Do not add FAQ schema to commercial pages. Visible Q&A is still useful for people and passage extraction.
- Do not encode hard-coded model counts or claims in JSON-LD.

## Content Reformatting Suggestions

- Hero: one result-oriented H1, one concrete supporting paragraph, two equal ChatGPT/Claude actions, and a small Codex/MCP technical path.
- Workflow: show an actual dialogue that asks only the missing budget/quality/reference questions.
- Model choice: show the best current fit first, then validated alternatives with price and trade-off; no generic tier boxes.
- Credits: separate free recommendations/estimates from paid generation; explain top-up and mandatory re-quote in one ordered sequence.
- Library: add a standalone answer section and a proof link to the saved result.
- References: present image, video, and audio as model-dependent supported kinds, not image-only examples.
- Trust: explain explicit confirmation, owned job recovery, and failure/refund state positively; move operational caveats to technical/support documentation.

## Search Baseline Used

The latest read-only three-month GSC view observed during this design work showed:

- 6,314 clicks;
- 491,440 impressions;
- 1.3% CTR;
- average position 10.2;
- 27,759 impressions associated with the displayed generative-AI feature view;
- 4,835 homepage impressions in that same displayed feature view.

The homepage, LTX/Kling examples, Veo model content, Seedance comparisons, Wan examples, and existing comparison/model pages are the strongest internal-link sources. GSC’s query and feature tables can be partial, so these figures are a baseline for prioritization, not an attribution claim for the future plugin.

## Re-Score Gate

Recalculate this document after the acquisition plan is implemented. A publishable score requires:

- five distinct, index-ready localized source owners;
- no internal preview vocabulary;
- current hosted compatibility evidence;
- complete credit/library/reference answers;
- real proof media;
- working sitemap and llms.txt fixtures;
- homepage and contextual links;
- a public distribution/entity surface;
- browser, accessibility, structured-data, and performance checks.
