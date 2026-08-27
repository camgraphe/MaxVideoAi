# MaxVideoAI GitHub Commercial Presence and Content Engine Design

**Date:** 2026-08-27
**Status:** strategic, commercial, and visual direction approved by the product owner; ready for written review before implementation planning
**Owner:** MaxVideoAI product owner

## Purpose

Turn GitHub from a mostly technical repository surface into a durable acquisition,
trust, distribution, and backlink engine for MaxVideoAI.

The public story is:

> MaxVideoAI turns ChatGPT, Claude, and Codex into a multi-model AI video
> production studio.

The supporting promise is:

> Plan the production, compare current models, know the exact price, approve the
> spend, generate, and recover the finished result without leaving the creative
> conversation.

This design extends the existing plugin, MCP acquisition, account continuity,
and inline-media specifications. It does not replace their security, OAuth,
pricing, confirmation, recovery, or claim-evidence contracts:

- `2026-08-26-maxvideoai-plugin-acquisition-and-continuity-design.md`
- `2026-08-26-mcp-inline-media-app-design.md`
- `2026-08-24-maxvideoai-conversational-plugin-design.md`
- `2026-07-11-maxvideoai-universal-mcp-acquisition-design.md`

The scope of this document is the GitHub commercial presence, the distributable
plugin repository, supporting proof assets, recurring GitHub content, community
surfaces, external discovery, earned links, and measurement.

## Approved Decisions

### Two repositories

Use two public repositories with different jobs:

1. `camgraphe/MaxVideoAi` remains the product and engineering flagship.
2. `camgraphe/maxvideoai-plugin` becomes the focused distribution and acquisition
   surface for ChatGPT, Claude, Codex, and compatible MCP clients.

The second repository is not an independent fork and does not become a second
source of truth. The authored plugin package remains in
`plugins/maxvideoai/` inside the primary repository. A reviewed publication
workflow produces the public distribution repository and matching releases.

### Positioning hierarchy

Lead with the named environments because they make the product immediately
understandable and carry real search intent:

> MaxVideoAI for ChatGPT, Claude & Codex

Lead the first screen with the outcome:

> AI video production inside ChatGPT, Claude & Codex

Use the compact rhythm:

> Plan. Compare. Price. Approve. Generate.

Use MCP as a supporting technical and search term. Do not make `MCP server`,
`tool schema`, `OAuth flow`, `manifest`, or `skill` the primary commercial
headline.

### Visual direction

The selected direction is the refined first visual concept:

`/Users/adrienmillot/.codex/generated_images/01a044d1-b433-75b3-bb24-19fb46ee0e2f/exec-2e3fc76a-64ec-4262-b570-36a5a5cbf653.png`

This generated image is a composition reference only. It must not be published
as product evidence. The production version uses the current MaxVideoAI logo,
current host interfaces, current site interface, correct installation commands,
and newly captured first-party proof.

The approved composition is:

- concise commercial promise on the left;
- large real finished-video proof on the right;
- installation visible in the first viewport;
- one restrained ChatGPT, Claude, and Codex compatibility line;
- three compact benefits immediately below;
- a secondary real plugin screenshot paired with the two workflow skills;
- generous whitespace and an editorial black, white, and cobalt MaxVideoAI
  visual language.

## Evidence Baseline

The starting public repository has useful product and engineering depth, but its
first screen is development-first. The root README still leads with `Generate
Page Mock & Frontend`, setup history, mock-server details, environment variables,
and internal implementation context before clearly selling the current product.

The August 2026 audit found:

- 34 stars and 13 forks on the primary repository;
- low normal GitHub browsing volume, with 16 unique visitors in the preceding
  fourteen-day window;
- an anomalous clone spike that must not be treated as genuine adoption without
  separate validation;
- a 57% GitHub community-profile score;
- no code of conduct, issue templates, or pull-request template;
- no GitHub Discussions surface;
- no custom repository social preview;
- an incomplete personal GitHub profile story;
- no MaxVideoAI listing found in the official MCP Registry or the reviewed MCP
  directories at the time of the audit.

GitHub search and suggestion research showed meaningful discovery around:

- `AI video MCP`;
- `video generation MCP`;
- `AI video generator for ChatGPT`;
- `Claude video generator` and `Claude skill`;
- `video generator MCP server`;
- `AI video generator API`, pricing, and model comparison;
- `best AI video model`, including time-sensitive comparison intent.

Successful adjacent repositories consistently reduce friction through a clear
one-line result, a visible real demonstration, one-line installation, current
release artifacts, platform-specific setup, useful examples, and a license that
is easy to understand. MaxVideoAI should adopt those mechanics while retaining
its own product position: whole-project planning, live model choice, transparent
pricing, approval before spend, private references, recovery, and library
continuity.

## Repository Architecture

### Primary product repository: `camgraphe/MaxVideoAi`

Its job is to prove that MaxVideoAI is a substantial maintained product, not
merely a small MCP wrapper.

The first README viewport should contain:

1. the current MaxVideoAI wordmark;
2. `Multi-model AI video production` as the product category;
3. one concise description of the web product;
4. three primary destinations: try MaxVideoAI, explore models, use it from an
   assistant;
5. one current product screenshot or short motion proof;
6. a compact plugin callout linking to `camgraphe/maxvideoai-plugin`.

The rest of the README should present:

- what creators can accomplish;
- supported model families without hard-coding a count that drifts;
- model comparison, project pricing, references, generation, and library
  continuity;
- real output examples;
- the assistant/plugin workflow;
- product architecture at a high level;
- contribution and local-development entry points;
- license and commercial-license boundaries;
- security and support links.

Move long environment-variable inventories, mock-server history, provider setup,
and operational details into focused documents. Keep the root README comfortably
below GitHub's 500 KiB truncation boundary and optimize it for a human first visit.

Recommended repository description:

> Multi-model AI video studio for the web, ChatGPT, Claude and Codex. Compare
> Sora, Veo, Kling, Seedance and more; know the price before you generate.

Recommended topics:

- `ai-video`
- `ai-video-generator`
- `video-generation`
- `model-comparison`
- `nextjs`
- `mcp`
- `model-context-protocol`
- `chatgpt-plugin`
- `claude-connector`
- `codex-plugin`

Only use topics that remain factually supported by the published product.

### Distribution repository: `camgraphe/maxvideoai-plugin`

Its job is to convert search, directory, release, and community traffic into a
working installation.

Recommended repository description:

> Plan, compare, price and generate AI videos from ChatGPT, Claude and Codex
> with MaxVideoAI.

Recommended homepage URL:

`https://maxvideoai.com/mcp?utm_source=github&utm_medium=repository&utm_campaign=plugin`

Recommended topics:

- `mcp`
- `mcp-server`
- `model-context-protocol`
- `ai-video`
- `video-generation`
- `chatgpt-plugin`
- `claude-plugin`
- `claude-connector`
- `codex-plugin`
- `agent-skills`

Recommended public tree:

```text
maxvideoai-plugin/
├── .claude-plugin/
├── .codex-plugin/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   └── pull_request_template.md
├── assets/
│   ├── brand/
│   ├── screenshots/
│   ├── demos/
│   └── social/
├── docs/
│   ├── chatgpt.md
│   ├── claude.md
│   ├── codex.md
│   ├── generic-mcp.md
│   ├── permissions-and-privacy.md
│   ├── credits-and-approval.md
│   ├── troubleshooting.md
│   └── architecture.md
├── examples/
│   ├── compare-models.md
│   ├── budget-a-launch-film.md
│   ├── reference-image-to-video.md
│   └── recover-a-generation.md
├── skills/
├── .mcp.json
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SECURITY.md
├── server.json
└── VERSION
```

The repository contains no application backend, provider secrets, private model
configuration, customer tokens, billing implementation, private prompts, or
generated customer media.

### Source and release discipline

The main repository remains authoritative for:

- plugin manifests;
- shared skills and references;
- MCP endpoint metadata;
- version number;
- release notes;
- compatibility tests;
- publication gates.

The distribution repository is generated or synchronized from a reviewed tag.
Every public version should have:

- the same version in manifests and `VERSION`;
- a signed or checksummed downloadable artifact;
- a GitHub release with commercial highlights and upgrade notes;
- current installation commands;
- current screenshots where the interface or workflow changed;
- a link back to the source tag in the primary repository;
- an automated drift check that fails when the public mirror differs from the
  tagged distributable package.

Do not hand-edit equivalent files in both repositories.

### License recommendation

Keep the main application under its current BUSL terms.

For the dedicated distribution repository, prefer a permissive license such as
MIT for manifests, skills, examples, and installation helpers, subject to legal
review. Keep MaxVideoAI trademarks, logos, screenshots, and other brand assets
under an explicit brand-asset policy. The intention is to make installation and
ecosystem contribution easy without licensing the private application backend.

## Plugin README Information Architecture

### First viewport

The first viewport must answer four questions in order:

1. What result do I get?
2. Does it work in my assistant?
3. Can I trust the claim?
4. How do I install it now?

Proposed copy hierarchy:

```text
MaxVideoAI for ChatGPT, Claude & Codex

AI video production inside your assistant.

Plan. Compare. Price. Approve. Generate.

Choose the right live model for every shot and know the exact cost before
credits are spent.
```

The platform line should read naturally:

`Works with ChatGPT · Claude · Codex · compatible MCP clients`

Use no more than four stable badges near the top. Suitable badges are current
release, security policy, license, and website. Do not lead with large badge
rows, build trivia, language counts, or vanity statistics.

The first installation block should detect or clearly separate the platform.
Codex uses the reviewed tag commands. ChatGPT and Claude use only currently
verified, publicly available setup paths. An unavailable or review-pending
directory install must not be presented as live.

### Proof immediately after installation

Use one dominant current screenshot showing a finished video returned in the
conversation. The screenshot must include enough host context to prove the
surface, while keeping the video/result card large enough to understand.

Place exactly three benefits below it:

- **Live model data** — recommendations, capabilities, budgets, and quotes come
  from the current MaxVideoAI catalog;
- **Price before spend** — the user sees and approves the exact quote before a
  paid generation;
- **Results in your library** — approved generations and reusable references
  remain attached to the MaxVideoAI account.

### Core narrative sections

The README should then use this order:

1. **See it work** — short real demonstration from brief to returned video.
2. **Install** — ChatGPT, Claude, Codex, and generic MCP paths.
3. **What you can ask** — outcome-led prompt examples.
4. **Plan a production** — model recommendations and whole-project budgets.
5. **Generate with control** — exact quote, explicit approval, job recovery.
6. **Use references** — existing or newly uploaded private image, video, or
   audio references where supported.
7. **Why MaxVideoAI** — live multi-model layer, price visibility, one account,
   durable library.
8. **Permissions and privacy** — concise human explanation with a deeper link.
9. **Support and troubleshooting** — direct paths, not a warning wall.
10. **Contribute and security** — issues, discussions, disclosure, package
    development.

### Writing rules

Use customer verbs:

- plan;
- compare;
- budget;
- quote;
- approve;
- generate;
- recover;
- reuse;
- open in MaxVideoAI.

Prefer concrete outcome statements over internal descriptions. For example:

- Prefer `Compare current models for every shot` over `Calls list_models`.
- Prefer `See the exact price before generation` over `Uses a two-step quote
  contract`.
- Prefer `Your result stays in your MaxVideoAI library` over `Jobs persist in
  app_jobs`.

Technical terms belong in installation, architecture, and contributor sections.
Do not weaken the top of the page with internal default behavior, generic AI
warnings, release-task terminology, or exhaustive exceptions. Put a precise
qualification next to the affected claim only when it changes compatibility,
price, permissions, or an installation decision.

## Visual and Screenshot System

### Mandatory freshness policy

No existing screenshot is automatically approved for publication.

Every public screenshot must be freshly captured or explicitly revalidated
against the current production product and current named host interface. The
existing files under `frontend/public/media/mcp/` are shot-list references, not
an evergreen publication library.

A screenshot is publishable only when all of the following are true:

- it was captured from the current host and current MaxVideoAI release;
- it represents production, or is visibly and intentionally labeled as a demo;
- it uses the intended public MaxVideoAI account with safe sample data;
- no email, access token, private reference, billing secret, internal ID,
  staging hostname, notification, unrelated tab, or personal information is
  visible;
- the UI language is intentional for the target asset;
- the crop preserves host identity and the MaxVideoAI action/result;
- text remains readable at the final rendered width;
- the asset has descriptive alt text and a semantic filename;
- the light or dark appearance matches the surrounding README section;
- the associated claim has been exercised on that exact host surface.

Recapture an asset when:

- MaxVideoAI navigation, workspace, pricing, plugin, or result-card UI changes;
- ChatGPT, Claude, Codex, or the plugin-install interface changes materially;
- installation commands or directory paths change;
- the visible model, price, account state, or release version is stale;
- a crop no longer matches the current README composition;
- the screenshot is older than the latest meaningful workflow release.

### Required screenshot shot list

Capture the following scenes as independent source images:

1. ChatGPT connection or installation on a supported public surface.
2. ChatGPT model recommendation or project-budget response.
3. ChatGPT exact quote and explicit approval boundary.
4. ChatGPT finished video or image returned in the conversation.
5. Claude connector/plugin connected state.
6. Claude project plan or model recommendation.
7. Claude exact quote and approval boundary.
8. Claude finished video shown inline.
9. Codex marketplace/plugin page.
10. Codex installed plugin and enabled skills.
11. Codex project plan or quote workflow.
12. MaxVideoAI library containing the same completed generation.
13. Reference selection or upload using safe dedicated demo media.
14. Recovery of a completed generation after the conversation was interrupted.
15. Current web workspace with model choice, price-before, prompt, and output.

Do not force every scene into the README. The full set supports documentation,
release notes, directory listings, social cards, tutorials, and future refreshes.

### Image placement matrix

| Asset | Source | Target size | Primary placement | Purpose |
| --- | --- | ---: | --- | --- |
| Repository social preview | designed brand asset | 1280×640, under 1 MB | GitHub repository settings | recognizable link preview |
| README proof hero | fresh host screenshot in a restrained brand frame | 1600×900 source | plugin README first viewport | prove finished video in conversation |
| Install proof | fresh platform screenshot | 1600×1000 source | directly after platform install steps | remove setup anxiety |
| Workflow sequence | three or four fresh crops | 1600×900 composite | `See it work` | brief → quote → approval → result |
| Multi-model proof | current MaxVideoAI UI or benchmark asset | 1600×900 source | `Plan a production` | prove selection and budgeting depth |
| Library continuity | fresh MaxVideoAI library screenshot | 1600×900 source | `Results stay yours` | show account continuity |
| Release card | branded editorial asset | 1200×630 | GitHub release and launch posts | make releases shareable |
| Directory thumbnail | simplified branded proof | 1200×675 | registry and directory submissions | remain legible at small size |

GitHub recommends a solid-background PNG, JPG, or GIF under 1 MB, at least
640×320 and ideally 1280×640 for repository social previews. The final upload
should follow the current GitHub documentation rather than a stale template.

### Generated-image policy

Use ImageGen for:

- visual-direction exploration;
- repository social-preview art direction;
- restrained editorial backgrounds for releases and benchmark reports;
- campaign concepts that communicate `one brief, many models`;
- non-product illustrations where no screenshot could be mistaken for evidence.

Do not use generated images for:

- host compatibility proof;
- installation proof;
- quotes, prices, balances, or approvals;
- model rankings or benchmarks;
- screenshots of ChatGPT, Claude, Codex, or MaxVideoAI;
- customer testimonials or usage claims.

Where possible, feature real media generated through MaxVideoAI as the creative
output. Record its model, settings, date, safe prompt summary, and permission to
publish. That turns an attractive image or video into first-party product proof.

## GitHub SEO and Discoverability

### Keyword ownership by surface

The primary repository owns broad product intent:

- MaxVideoAI;
- multi-model AI video generator;
- compare AI video models;
- AI video pricing;
- Sora, Veo, Kling, Seedance, LTX, Wan, and current supported families;
- pay-as-you-go AI video generation.

The plugin repository owns assistant and protocol intent:

- AI video generator for ChatGPT;
- Claude video generator;
- AI video plugin;
- video generation MCP;
- AI video MCP server;
- Codex video plugin;
- compare AI video models in ChatGPT or Claude;
- AI video project budget;
- price before generating AI video.

Use primary phrases naturally in the repository name, description, first
paragraph, headings, image alt text, release titles, and platform guides. Do not
repeat keyword blocks or create dozens of thin near-duplicate pages.

### GitHub search surface

For both repositories:

- use complete repository descriptions;
- set the canonical MaxVideoAI homepage;
- add accurate topics;
- upload a custom social preview;
- keep the default branch README current;
- publish semantic tagged releases;
- use descriptive filenames and headings;
- keep stable links to installation, security, and support;
- pin the distribution repository on the `camgraphe` profile;
- create a concise profile README that explains Adrien's role and points to the
  product and plugin.

The profile should not become a résumé wall. It should answer:

1. who builds MaxVideoAI;
2. what MaxVideoAI helps people make;
3. where to try the product;
4. where to install the plugin;
5. where to follow releases or ask questions.

### GEO and answer-engine readability

Every core document should contain one self-contained definition paragraph that
can be quoted accurately by search or answer systems. Include visible freshness
dates where compatibility changes quickly. Use tables for exact platform setup,
permissions, and model/workflow comparisons. Link to the website's canonical
commercial pages rather than duplicating their full SEO copy in GitHub.

## External Distribution and Backlink Strategy

### Priority one: authoritative ecosystem listings

Submit only after production installation and current screenshots are verified:

1. Official MCP Registry using the appropriate remote-server metadata and an
   authenticated MaxVideoAI namespace.
2. Claude plugin or connector distribution path available at publication time.
3. OpenAI plugin/directory path only after its current commerce and submission
   rules are reviewed against MaxVideoAI's paid digital generation flow.
4. GitHub topics, releases, and profile surfaces.

The MCP Registry supports publicly accessible remote servers and acts as an
upstream metadata source for downstream aggregators. This makes it the most
valuable protocol listing, not just another backlink.

### Priority two: maintained directories and curated lists

Prepare one reusable submission packet for:

- Smithery;
- PulseMCP;
- Glama;
- mcpservers.org;
- relevant `awesome-mcp-servers` and agent-skill lists;
- platform-specific community directories that are active and moderated.

The packet contains:

- canonical name and 140-character description;
- longer commercial description;
- verified remote endpoint or install path;
- repository and website URLs;
- current logo and 1200×675 thumbnail;
- permissions and authentication summary;
- current version and release URL;
- support and security URLs;
- three real use cases;
- freshness date;
- tracked link unique to the directory.

Do not mass-submit to abandoned or scraped directories. Ten maintained,
contextual listings are more valuable than one hundred duplicate low-trust
profiles.

### Priority three: earned editorial links

Create assets worth citing rather than asking for naked backlinks:

- a transparent AI video model benchmark and methodology;
- a regularly updated model capability and pricing comparison;
- a public `30-second launch film` budget case study;
- a quality-first versus lower-cost production-plan comparison;
- a reference-image-to-video workflow with the prompt, model choice, price, and
  final result;
- a recovery and refund reliability explainer;
- release notes for genuinely new model or host capabilities;
- technical articles explaining safe quote/approval boundaries for paid MCP
  actions.

Each piece should live canonically on MaxVideoAI, have a GitHub companion example
or release, and include shareable visual assets. Outreach should target MCP list
maintainers, AI-video newsletters, developer publications, model-comparison
writers, and communities where the content answers an existing question.

### Link hygiene

Use stable campaign links such as:

```text
https://maxvideoai.com/mcp
  ?utm_source=github
  &utm_medium=repository
  &utm_campaign=plugin
  &utm_content=hero
```

Give every directory and major content partnership its own source and campaign
values. Avoid query parameters on internal relative repository links. Maintain
one redirectable MaxVideoAI destination for links likely to outlive a page
restructure.

## Recurring Content Engine

### Editorial pillars

#### 1. Build inside the conversation

Show a concrete creative outcome from ChatGPT, Claude, or Codex. Lead with the
brief and finished result. Explain the model and price only after the visual
payoff.

#### 2. Choose the right model

Publish evidence-backed comparisons for real production decisions: dialogue,
character consistency, product shots, native audio, fast motion, references,
text rendering, or cost ceilings.

#### 3. Know the production cost

Turn abstract per-clip pricing into complete project budgets. Show shots,
attempt allowance, model mix, total price, and the trade-off between approaches.

#### 4. Trust the workflow

Explain approval, permissions, private references, recovery, library continuity,
refunds, versioning, and security through short concrete examples.

### Launch content package

The two-repository launch should not be a single README commit. Prepare:

1. a rewritten flagship README;
2. a conversion-focused plugin README;
3. a fresh 30–45 second install-to-finished-video demonstration;
4. platform-specific ChatGPT, Claude, and Codex setup guides;
5. one complete production-budget example;
6. one reference-image-to-video example;
7. one model-comparison example;
8. current release notes and downloadable artifact;
9. a custom social preview for each repository;
10. a launch article on MaxVideoAI;
11. a GitHub release announcement with current screenshots;
12. the authoritative registry submission packet.

### Ongoing publication backlog

Maintain a rolling backlog of reusable stories:

- `Best current model for a cinematic product reveal`;
- `A 30-second campaign planned at three real budgets`;
- `When to use Veo, Kling, Seedance, or LTX for dialogue`;
- `From one product photo to a finished video ad`;
- `How price-before-spend prevents accidental generation costs`;
- `How a result survives a closed or interrupted conversation`;
- `What happens when a paid generation fails`;
- `How new MaxVideoAI models become available to the plugin`;
- `ChatGPT versus Claude versus Codex: same MaxVideoAI account, different
  creative workflows`;
- `A creator's real plugin workflow of the month`;
- `Release spotlight: new model, new mode, or new reference capability`;
- `Benchmark update: what changed and why`.

One strong production story should be repurposed into:

- a GitHub example;
- a release or discussion post;
- a MaxVideoAI article;
- a short demonstration;
- one social visual;
- one directory or newsletter pitch;
- one internal link from the relevant model or comparison page.

## Community and Trust Surfaces

Enable GitHub Discussions on the plugin repository with focused categories:

- Announcements;
- Q&A;
- Show and tell;
- Model requests;
- Ideas.

Add issue templates for:

- installation problem;
- host compatibility problem;
- generation or recovery problem without private data;
- model or workflow request;
- documentation correction.

Each template must tell users not to paste access tokens, private prompts,
private media URLs, billing details, or personal account information.

Add:

- a concise pull-request template;
- `CONTRIBUTING.md` with package boundaries and validation commands;
- `CODE_OF_CONDUCT.md`;
- `SECURITY.md` with private disclosure instructions;
- support and status destinations;
- a compatibility matrix with last-verified dates;
- clear maintainer ownership.

The main repository can retain deeper engineering issues. The plugin repository
should optimize for installation, compatibility, examples, documentation, and
package contributions.

## Measurement

### Acquisition funnel

Measure:

```text
GitHub or directory visit
  -> installation click or copied command
  -> OAuth start
  -> OAuth completion
  -> first account check
  -> first model recommendation or project budget
  -> exact quote
  -> explicit confirmation
  -> accepted generation
  -> completed result
  -> library visit
  -> repeat generation
```

Never collect prompts, private media, access tokens, or payment details for
marketing attribution.

### GitHub leading indicators

- unique repository visitors;
- README-to-MaxVideoAI click-through rate;
- release downloads;
- stars, forks, and watchers;
- issue and discussion participation;
- installation-document visits;
- external referring domains;
- directory listing coverage;
- earned links to benchmarks, examples, and releases.

Treat clone spikes, bot traffic, automatic directory scraping, and repeated CI
downloads separately from human adoption.

### Commercial indicators

- GitHub visitor to OAuth-start rate;
- OAuth completion rate;
- time to first useful recommendation or budget;
- recommendation/budget to exact-quote rate;
- quote-to-confirmation rate;
- accepted-to-completed generation rate;
- completed-result-to-library rate;
- repeat-generation rate;
- funded-wallet conversion and revenue by acquisition source;
- refunds and support requests by host and release version.

### Initial target framework

Record a clean fourteen-day baseline after launch instrumentation is verified.
Then use three levels rather than one vanity target:

| Metric | Floor | Target | Stretch |
| --- | ---: | ---: | ---: |
| Human GitHub unique visitors vs. baseline | 2× | 5× | 10× |
| README outbound click-through | 5% | 10% | 15% |
| OAuth completion after start | 45% | 60% | 70% |
| Maintained external listings | 5 | 10 | 15 |
| Earned contextual referring domains | 3 | 10 | 20 |
| Useful GitHub examples published | 4 | 8 | 12 |

Set generation and revenue targets after the first clean source-attributed
baseline, because current GitHub traffic does not provide a reliable conversion
denominator.

## Delivery Waves

### Wave A — foundation and claims

- freeze the two-repository responsibilities;
- choose the public package license and brand policy;
- inventory all claims and current compatibility evidence;
- define source-of-truth and mirror automation;
- establish analytics destinations and privacy boundaries.

### Wave B — current proof assets

- capture every required host and MaxVideoAI scene again;
- reject or archive stale screenshots;
- produce the README hero, workflow sequence, social previews, and directory
  thumbnail from current sources;
- validate crops at actual GitHub rendered widths;
- write alt text and provenance metadata.

### Wave C — repository transformation

- rewrite the primary README;
- create and populate `maxvideoai-plugin`;
- add platform docs, examples, community templates, support, security, and
  release surfaces;
- configure descriptions, topics, homepage URLs, social previews, and pinned
  repositories;
- add the personal profile README.

### Wave D — distribution

- publish the current plugin release and checksum;
- publish authoritative registry metadata;
- submit platform listings where compliant and verified;
- submit maintained directories and curated-list pull requests;
- publish the launch article, demo, and GitHub release.

### Wave E — content and backlink engine

- publish model decisions, project budgets, workflow proofs, and trust stories;
- connect each story across GitHub, MaxVideoAI, releases, and outreach;
- maintain a living benchmark and compatibility freshness cadence;
- respond to questions and feature requests publicly when no private account
  data is involved.

### Wave F — optimization

- compare platforms, referring sources, README sections, and content pillars;
- refresh weak screenshots and headlines;
- expand examples that drive first budgets and quotes;
- remove low-value directory work;
- improve the onboarding step with the highest verified drop-off.

## Governance

Assign explicit owners for:

- commercial copy and claims;
- plugin package and releases;
- screenshot capture and redaction;
- design assets;
- platform compatibility evidence;
- MCP Registry and directory metadata;
- GitHub community responses;
- analytics and funnel reconciliation;
- benchmark and model-content freshness.

Maintain one asset manifest with:

- semantic filename;
- capture or generation date;
- source environment;
- host and version;
- MaxVideoAI release/tag;
- visible model and workflow;
- original dimensions;
- allowed placements;
- alt text;
- claim supported;
- next review trigger;
- publication approval.

## Release Gates

Do not launch the two-repository strategy until:

1. the dedicated repository is reproducibly generated from a reviewed source
   tag;
2. production OAuth and installation evidence exists for every named live host;
3. current exact-quote, approval, completion, and library-continuity evidence
   exists;
4. all public screenshots pass the freshness and privacy checklist;
5. installation commands are copied and exercised from a clean environment;
6. website and GitHub claims match the released capabilities;
7. security, support, privacy, license, and revocation information is present;
8. analytics links and source attribution are verified;
9. social previews render legibly in light and dark sharing contexts;
10. no private application code or secret enters the distribution repository;
11. registry and directory descriptions use current URLs and version data;
12. the plugin README can move a new visitor from first screen to working
    installation without reading the technical architecture.

## Non-Goals

- turning the main repository into a generic marketing microsite;
- hiding meaningful licensing or contribution boundaries;
- publishing fake host UI or generated compatibility proof;
- copying the full MaxVideoAI website into GitHub;
- creating hundreds of keyword pages;
- buying or spamming low-quality backlinks;
- maintaining a second manual model or pricing catalog;
- exposing the private backend to make the plugin repository look larger;
- claiming official endorsement by OpenAI, Anthropic, GitHub, or the MCP
  Registry;
- using stars, clone spikes, or scraped directory mentions as the primary
  business success metric.

## Research Basis

This design uses the current public GitHub and MCP guidance reviewed on
2026-08-27:

- GitHub README guidance: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes>
- GitHub social preview guidance: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview>
- GitHub profile README guidance: <https://docs.github.com/en/account-and-profile/concepts/personal-profile>
- GitHub community profile guidance: <https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/accessing-a-projects-community-profile>
- Official MCP Registry overview: <https://modelcontextprotocol.io/registry/about>
- Remote MCP server publication: <https://modelcontextprotocol.io/registry/remote-servers>
- MCP Registry publishing quickstart: <https://modelcontextprotocol.io/registry/quickstart>

Platform commerce, directory, manifest, and submission rules change quickly.
Recheck the official OpenAI, Anthropic, GitHub, and MCP sources immediately
before implementation and submission.

## Final Principle

GitHub should not explain MaxVideoAI before it makes MaxVideoAI desirable.

Show the finished result, name ChatGPT, Claude, and Codex, make installation
obvious, prove price control and account continuity, then offer the technical
depth that earns long-term trust.
