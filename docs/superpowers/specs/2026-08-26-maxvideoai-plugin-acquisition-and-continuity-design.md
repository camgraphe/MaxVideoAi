# MaxVideoAI Plugin Acquisition and Product Continuity Design

## Status

Validated direction, revised after hosted Claude and Codex testing and ready for implementation planning.

This document defines product positioning, terminology, customer continuity, maintenance architecture, distribution, SEO/GEO, evidence, measurement, and release gates. It contains no delivery dates.

## Objective

Make MaxVideoAI the natural video-generation layer used from ChatGPT, Claude, Codex, and other compatible AI assistants.

The commercial promise is not that MaxVideoAI exposes an MCP server. The promise is that a person can stay in a creative conversation while the assistant helps structure the project, prepare prompts and references, compare suitable models, calculate a realistic budget, obtain an exact quote, and generate only after approval.

The experience must remain connected to the MaxVideoAI account. A customer must always understand:

- which MaxVideoAI account is connected;
- how much credit is available;
- where and how to add credit;
- why a new exact quote is required after funding;
- where an accepted generation can be followed;
- where completed videos, images, and reusable references are stored on MaxVideoAI;
- how technical failure, refund, and a new creative attempt differ;
- how to reconnect, revoke access, or continue on the website.

## Product and Terminology Decision

### Current platform terminology

Official OpenAI documentation now uses **plugin** as the installable umbrella shared by ChatGPT and Codex. A plugin may include skills, connectors backed by MCP servers, and optional UI. OpenAI also documents one universal public plugin directory used by ChatGPT and Codex on supported surfaces.

Official Anthropic documentation uses both **plugin** and **connector** for prospect-facing distribution. A Claude plugin can bundle skills and connectors; a remote custom connector points Claude to a public MCP server.

Sources checked for this decision:

- https://developers.openai.com/plugins
- https://learn.chatgpt.com/docs/skills-and-plugins
- https://learn.chatgpt.com/docs/enterprise/apps-and-connectors
- https://support.claude.com/en/articles/13837440-use-plugins-in-claude
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro

### Naming hierarchy

Use the following terms deliberately:

| Context | Preferred term | Supporting term |
| --- | --- | --- |
| Main commercial promise | MaxVideoAI for ChatGPT and Claude | AI video plugin |
| OpenAI installation and distribution | MaxVideoAI plugin | ChatGPT and Codex plugin |
| Claude installation | MaxVideoAI connector or plugin | remote MCP connector |
| Technical documentation | MaxVideoAI MCP server | remote MCP integration |
| Internal instruction package | MaxVideoAI skill | bundled inside the plugin |
| Optional future embedded interface | plugin UI or interactive connector | MCP App only when implemented |

Do not lead a general prospect with “skill”, “server”, “OAuth”, “tool schema”, or “MCP”. Those terms remain important for technical search intent, installation documentation, directories, GitHub, and AI-agent discovery.

### Brand order

The default consumer-facing order is:

1. ChatGPT
2. Claude
3. Codex and other compatible clients

This does not erase Codex. It recognizes that ChatGPT is the larger customer-facing brand while Codex remains an important product surface and a valuable technical search term.

Do not use the artificial phrase “ChatGPT Codex” as the main product name. Use natural phrasing such as “Works in ChatGPT and Codex” or “Available in ChatGPT, Claude, and Codex” when all named surfaces have current evidence.

## Commercial Positioning

### Primary proposition

> Turn ChatGPT or Claude into your AI video producer.

### Supporting proposition

> Plan the shots, prepare prompts and references, compare the right models, see the exact price, and generate only after you approve.

### Core proof points

1. Current model advice for each shot, based on the live MaxVideoAI catalog.
2. Quality-first recommendations with factual lower-cost alternatives when useful.
3. Project budgets for single-model or mixed-model productions.
4. Exact price and projected balance before a paid generation.
5. Support for existing and newly uploaded image, video, and audio references when the chosen model accepts them.
6. A separate confirmation before generation.
7. Status recovery, result links, and failure/refund state.
8. Completed media and references remain available in the connected MaxVideoAI account.
9. Installation, discovery, recommendations, and estimates are free; generation uses existing MaxVideoAI credits.

### Claim policy

Marketing copy should be positive, concrete, and commercially useful. It must lead with what works.

Do not publish internal release language such as “Task 10”, “local contract”, “host validation in progress”, “fixture”, or “unverified setup”. Do not add generic warning paragraphs that make the product sound unavailable.

Use a qualification only when it changes a buying decision, installation step, price, or supported capability. Put the qualification next to the affected claim and keep it precise. Examples:

- “Available on supported ChatGPT surfaces” is useful when surface availability differs.
- “Reference support depends on the selected model” is useful.
- A paragraph explaining that every host lifecycle is not universally certified is not useful on the commercial page.

Claims about a named host, mode, trial, or directory listing still require current evidence. The solution is to obtain or repair the evidence, not to weaken the entire page indefinitely.

## Information Architecture

### Primary pages

| Route | Intent owner | Purpose |
| --- | --- | --- |
| `/mcp` | AI video plugin / video MCP / assistant video workflow | Main commercial and discovery hub |
| `/integrations/chatgpt` | ChatGPT video generator / ChatGPT video plugin | Primary OpenAI prospect and installation page |
| `/integrations/claude` | Claude video generator / Claude connector | Claude prospect and installation page |
| `/integrations/codex` | Codex video generation / Codex MCP | Technical and coding-agent intent |
| `/docs/mcp` | MaxVideoAI MCP documentation | Protocol, tools, authentication, account continuity, troubleshooting |

Keep `/integrations/codex`; do not redirect it to ChatGPT. Add `/integrations/chatgpt` as a distinct intent owner. Cross-link ChatGPT and Codex pages while avoiding duplicated copy.

### Homepage insertion

Do not replace the current homepage hero. Search Console shows that the homepage and existing model/comparison content already carry meaningful organic and generative-search visibility.

Add one prospect-facing module after examples and model comparisons and before the detailed reference workflow. It should contain:

- equal visual treatment for the ChatGPT and Claude marks;
- Codex as a supported secondary surface rather than a competing third headline;
- a short real conversation showing brief clarification;
- one quality-first recommendation and at least one valid lower-cost alternative;
- a project budget or exact quote before generation;
- a reference image/video/audio step where supported;
- a completed result or account-library continuity proof;
- two balanced CTAs: “Use MaxVideoAI in ChatGPT” and “Connect MaxVideoAI to Claude”.

The module should follow MaxVideoAI’s light-mode default and existing tokens, with full dark-mode parity.

### Contextual internal links

Add contextual links from:

- the homepage;
- pricing and pay-as-you-go pages;
- model catalog and key model pages;
- comparison pages;
- examples and proof galleries;
- relevant use-case guides;
- the marketing footer and integrations navigation.

Prioritize pages already earning search visibility: homepage, LTX and Kling examples, Veo pages, Seedance comparisons, pricing, and other high-impression model comparisons. Do not inject the same generic anchor into every page.

Suggested anchor families include:

- “Plan this model in ChatGPT or Claude”
- “Compare this model from your AI assistant”
- “Build a project budget before generating”
- “Use MaxVideoAI from ChatGPT”
- “Connect MaxVideoAI to Claude”

## Conversational Customer Continuity

### Required account destinations

The MCP contract should return labeled, canonical MaxVideoAI destinations instead of expecting the host to invent URLs:

- account and connection settings;
- billing/top-up handoff;
- media library: `/app/library`;
- video workspace: `/app`;
- image workspace: `/app/image`;
- support or troubleshooting destination;
- per-generation result or job destination when available.

Every returned destination should use a structured `open_url` action with a purpose label and safe next action.

### Credit flow

The assistant should be able to explain this flow without guessing:

1. `get_account_status` reports the current balance and account state.
2. `prepare_generation` reports the exact quote, balance before/after, and whether more credit is required.
3. `create_topup_link` creates a short-lived MaxVideoAI billing handoff for that user and intent.
4. The user completes funding on MaxVideoAI; the assistant never collects payment information.
5. After funding, the assistant checks the account again and calls `prepare_generation` for a fresh quote.
6. The assistant shows the new exact price and waits for explicit approval before confirmation.

The plugin skill and server instructions must explain why the previous quote expires after creating the top-up handoff.

### Gallery and result continuity

MCP generations and website generations use the same authenticated user ownership and the same `app_jobs` persistence read by the web library. This is the architectural guarantee that completed MCP generations belong to the MaxVideoAI account and can appear in `/app/library`.

Make that guarantee explicit in product responses:

- `confirm_generation` should identify the connected account and return the job destination when accepted;
- `get_generation_status` should return result links plus the canonical library URL;
- `list_recent_generations` should explain that it is reading the same recent account history available on the site;
- completed-generation responses should say that the result is saved to the MaxVideoAI library;
- reference upload completion should say that the asset is saved to the private MaxVideoAI library and can be selected again;
- failures should report the returned refund or recredit state and must not imply that the failed result exists in the gallery.

### Host guidance and evaluations

The shared skill and MCP server instructions must teach navigation and recovery, not merely tool ordering. Add evaluation scenarios for:

- “Where can I add credits?”
- insufficient balance after an exact quote;
- successful top-up followed by a required fresh quote;
- “Where is the video I generated yesterday?”
- opening the MaxVideoAI library after completion;
- recovering a job after the chat or client was closed;
- distinguishing a failed generation/refund from a new creative attempt;
- selecting an existing image, video, or audio reference;
- uploading a new private reference and finding it again;
- reconnecting or revoking the integration.

## Model and Feature Synchronization

### Existing foundation

`frontend/config/model-registry.json` remains the only authored model identity and publication source. The MCP model catalog already reads the same public configured engines, registry entries, engine capabilities, execution gates, and pricing boundaries used by the site.

Therefore, a normal model addition should not require a manually maintained MCP model list. Model names, availability, generation enablement, settings, and prices should come from live tools.

### Required invariant

For every public, executable MaxVideoAI model and supported canonical mode:

```text
site registry + engine contract + execution gate
                    |
                    v
          live MCP model catalog/details
                    |
                    v
       recommendation, budget, quote, generation
```

The plugin skill must remain model-agnostic except for deliberate guidance such as how to interpret modes or how to make quality-first recommendations. It must never become a second hard-coded model catalog.

### Changes that should synchronize automatically

- publishing or unpublishing an existing canonical model;
- changing labels, public aliases, availability, or discovery rank;
- changing existing mode settings, reference counts, duration, resolution, aspect ratio, FPS, or audio policy;
- enabling or disabling executable provider routing;
- changing canonical pricing;
- adding a model that uses already-supported surfaces and canonical modes.

### Changes that require MCP review

- introducing a new canonical generation mode;
- introducing a new reference kind or ordering rule;
- adding an action with new side effects;
- changing billing, trial, refund, approval, or account ownership behavior;
- adding a mode that the website supports only through route-local fields not represented by the agent facade;
- adding an interactive plugin UI.

### Enforcement

Add one explicit maintenance command, for example `pnpm mcp:catalog:check`, that runs:

- model-registry validation and projection checks;
- site-to-MCP public model parity;
- public executable-mode parity;
- model-details field and reference parity;
- pricing and budget parity;
- skill/tool-schema drift checks.

Run it from CI and from the documented model-addition workflow. A new public model or mode must fail the check if the site can generate it but the MCP silently omits it.

### Maintenance guide

Create `docs/engineering/mcp-maintenance.md` and link it from the root `AGENTS.md`. It should provide short procedures for:

- adding or retiring a model;
- changing capabilities or prices;
- introducing a new mode;
- updating the plugin skill without duplicating model facts;
- running local and hosted compatibility checks;
- deploying staging and production;
- updating evidence, marketing pages, GitHub, and directory metadata;
- rolling back an MCP capability independently from the website.

Add a focused `plugins/maxvideoai/AGENTS.md` only if the plugin area needs rules more specific than the root guide.

## SEO and GEO Strategy

### Search-intent hierarchy

Primary prospect terms:

- ChatGPT video generator
- AI video generator for ChatGPT
- ChatGPT video plugin
- Claude video generator
- AI video connector for Claude
- create AI videos from ChatGPT or Claude

Secondary technical terms:

- AI video MCP server
- video generation MCP
- MaxVideoAI MCP
- Codex video generator
- Codex MCP server
- AI video plugin with model comparison

Supporting workflow terms:

- AI video budget calculator
- compare AI video models in ChatGPT
- price before generating AI video
- Seedance, Kling, Veo, Wan, LTX, H3, and Happy Horse comparisons

Do not overuse “skill” as a commercial keyword. It describes an internal reusable workflow, not the whole connected product. Use it in technical documentation and plugin metadata where accurate.

### GEO answer architecture

Each commercial page should contain server-rendered, self-contained answer passages that establish:

- what MaxVideoAI for ChatGPT and Claude is;
- what the plugin can do;
- how model selection and budgets work;
- how exact quotes and confirmation work;
- how credits are added;
- where generated media is stored;
- which references are supported;
- how failures and refunds are handled;
- how to connect and disconnect;
- when the page and compatibility evidence were last updated.

Use concise definition paragraphs, comparison tables, current facts derived from the catalog, real media, and visible provenance. Avoid unsupported superlatives. Quality-first recommendations should be explained through user priorities and current capabilities.

### Technical GEO

- Keep public content server rendered.
- Add the acquisition pages to the sitemap and `llms.txt` only when their release gates open.
- Allow search-oriented AI crawlers according to the site’s data policy.
- Keep authenticated account, billing, OAuth, media, and MCP protocol routes noindex and out of `llms.txt`.
- Use `WebApplication`, `SoftwareApplication`, `BreadcrumbList`, `VideoObject`, or other appropriate supported schemas only when the visible page supports them.
- Do not add FAQ schema to commercial pages; retain visible question-and-answer content for humans and passage extraction.
- Derive model counts, supported surfaces, and freshness dates instead of hard-coding numbers that will drift.
- Link the MaxVideoAI organization entity consistently to its official website, GitHub, YouTube, and other maintained profiles where appropriate.

## GitHub and External Distribution

Create or update a public distribution repository dedicated to the MaxVideoAI plugin/MCP without exposing the private application backend.

Recommended public repository content:

- clear README led by the customer outcome;
- ChatGPT, Claude, Codex, and generic MCP installation paths;
- plugin manifest and distributable skill files where publication rules permit;
- tool and permission overview;
- OAuth, credits, library, confirmation, recovery, and revocation explanations;
- screenshots or a short verified demonstration;
- changelog and tagged releases;
- security policy and responsible-disclosure contact;
- support links;
- link to the canonical MaxVideoAI acquisition page;
- license appropriate to the published package.

The website should link back to the canonical GitHub repository. Use GitHub releases and topics for discovery, but do not treat the backlink alone as the acquisition strategy.

Candidate topics include `mcp`, `model-context-protocol`, `chatgpt-plugin`, `claude-connector`, `codex-plugin`, `ai-video`, and `video-generation` when each accurately describes the published package.

Distribution targets should be evaluated separately:

- OpenAI universal plugin directory;
- Claude plugin or connector distribution paths;
- official MCP Registry;
- relevant curated MCP directories;
- MaxVideoAI website manual installation;
- GitHub and release announcements.

Never claim a listing, verification badge, endorsement, or host availability before it exists.

## Acquisition and Measurement

Track the complete customer journey with privacy-safe identifiers:

```text
organic or referral landing
  -> installation CTA
  -> OAuth start
  -> OAuth completion
  -> first tool discovery
  -> first model recommendation or budget
  -> exact quote
  -> top-up handoff when needed
  -> wallet funded
  -> explicit confirmation
  -> accepted generation
  -> completed result
  -> library visit
  -> repeat generation
```

Break down acquisition by ChatGPT, Claude, Codex, direct MCP, GitHub, directory, language, landing page, and campaign. Keep prompts, private references, access tokens, and payment data out of acquisition analytics.

Primary commercial metrics:

- landing-to-install rate;
- OAuth completion rate;
- time to first useful recommendation or budget;
- quote-to-confirmation rate;
- insufficient-funds-to-wallet-funded rate;
- accepted-to-completed generation rate;
- completed-result-to-library visit rate;
- repeat generation rate;
- revenue, provider cost, refund rate, and trial conversion by acquisition source.

## Evidence and Release Gates

### Required product evidence

- fresh hosted ChatGPT/Codex plugin installation and OAuth evidence on supported surfaces;
- fresh hosted Claude connector/plugin installation and OAuth evidence;
- tool discovery and model-selection evidence;
- low-balance, top-up, fresh-quote, and confirmation evidence;
- completed video and image visible through both MCP recovery and `/app/library`;
- image, video, and audio reference evidence for representative compatible modes;
- failure/refund and reconnect/revocation evidence;
- new-model synchronization test;
- verified marketing media with job and provenance references.

### Publication sequence

1. Close product-continuity and model-parity gaps on staging.
2. Replace stale compatibility documentation with current hosted evidence.
3. Capture a small set of publishable proof assets.
4. Build and validate the ChatGPT, Claude, Codex, hub, and docs pages.
5. Add homepage insertion and contextual linking.
6. Validate SEO/GEO, metadata, schemas, sitemap, `llms.txt`, crawler policy, and performance.
7. Validate analytics and administrative reconciliation.
8. Publish the GitHub distribution surface.
9. Open production capabilities and marketing/indexing flags deliberately.
10. Submit to external directories only after production installation is stable.

## Non-Goals for the Initial Public Release

- A large embedded interface that replaces the conversation.
- Static “economy / balanced / premium” boxes as the main recommendation workflow.
- A second server-side LLM that dictates creative decisions to ChatGPT or Claude.
- A duplicated MCP-only model catalog or pricing table.
- Automatic retries or automatic spending after creative dissatisfaction.
- Publishing private backend code or secrets for the sake of GitHub visibility.
- Hundreds of thin keyword-variant pages.

## Final Product Principle

The host owns the creative conversation. MaxVideoAI supplies current executable facts, prices, account continuity, validation, generation, recovery, and durable media.

The user should never need to understand MCP to use the product, and the assistant should never need to guess how MaxVideoAI accounts, credits, references, jobs, or the media library work.
