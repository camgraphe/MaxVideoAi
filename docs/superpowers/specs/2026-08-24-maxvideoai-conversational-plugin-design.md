# MaxVideoAI conversational plugin design

**Date:** 2026-08-24

**Status:** ready for written product review

**Owner:** MaxVideoAI product owner

## Purpose

Turn the existing MaxVideoAI MCP foundation into an installable, conversational
product for Codex and Claude.

The host agent remains the creative partner. MaxVideoAI supplies the live facts
and execution layer that the agent cannot safely invent: available models,
capabilities, constraints, editorial evidence, current prices, account state,
quotes, generation, and result recovery.

The product should let a person say things such as:

- “I need a 60-second product film. Compare a few credible production plans.”
- “I have 40 dollars. What can we produce without making it look cheap?”
- “Use Seedance 2.5 unless H3 or Gemini Omni Flash is a better fit.”
- “Help me write the prompt and create the reference images, then show me the
  exact price before anything is generated.”

Codex or Claude should then hold a normal conversation, ask only the important
missing questions, create or improve the creative material, obtain current
MaxVideoAI facts, propose one or more budgets, and leave every meaningful choice
to the user.

## Relationship to the original MCP design

This document refines the approved
`2026-07-11-maxvideoai-universal-mcp-acquisition-design.md`; it does not replace
its security, OAuth, quote-confirmation, billing, trial, or provider-execution
contracts.

It supersedes the parts of that design that present model choice primarily as a
fixed low-cost shortlist or as pre-labelled economy, balanced, and premium
options. Those labels may describe a factual model characteristic in ordinary
copy, but they are not the product's decision interface and are not imposed on
the conversation.

## Product position

Primary proposition:

> Plan and generate AI video with Claude or Codex. MaxVideoAI gives them the
> current models, real prices, references, and generation tools.

Supporting proposition:

> Describe the result you want. Your agent can improve the prompt, compare
> models, build a project budget, and ask MaxVideoAI to generate only after you
> approve the price.

MaxVideoAI is not another chat model and does not compete with the host's
reasoning or creativity. It makes that reasoning commercially and technically
reliable.

## Approved experience principles

### Conversation before configuration

The default interface is the existing conversation in Codex or Claude. The
plugin does not introduce a second chat, a dashboard inside the chat, or a
three-card budget selector.

The agent asks only questions that materially change the recommendation or
price. Depending on the request, those can include:

- desired result, audience, platform, total duration, and aspect ratio;
- whether the user already has a script, shot list, images, or brand assets;
- whether native audio, dialogue, lip sync, continuity, 4K, or reference control
  is essential;
- whether the user has a firm budget ceiling, a target range, or wants advice;
- whether a preferred model is mandatory, merely preferred, or open to
  alternatives.

The skill must not mechanically ask the full list. A direct request with a
complete model and settings should proceed to validation and pricing without an
interview.

### Creative freedom with factual guardrails

Codex or Claude owns:

- clarification of the brief;
- script, shot list, prompt, and negative-prompt drafting;
- creative comparison of approaches;
- generation or selection of reference images when useful;
- names and narrative framing of the proposed production plans;
- suggestions for iteration after reviewing an output.

MaxVideoAI owns:

- public model identity and availability;
- supported modes, durations, ratios, resolutions, audio, and references;
- evidence-backed strengths and known limitations;
- current personalized prices and wallet state;
- request validation, quote persistence, billing, provider submission, jobs,
  refunds or recredits, and media access.

The skill teaches the division of responsibility. It does not tell the host how
to be creative and does not embed a long universal prompting formula.

### Proposals, not artificial tiers

For a project-level request, the agent may propose between one and four named
approaches. A proposal can use one model or mix several models by shot type.
Examples of useful, user-specific distinctions include:

- validate motion with one model, then render selected hero shots with another;
- keep one model for visual consistency across every shot;
- use native-audio models only for dialogue shots;
- spend more on the opening and closing shots than on transitions;
- compare the user's preferred model with a current lower-cost alternative.

The server never forces the names “economy”, “balanced”, or “premium”. It prices
the concrete plan supplied by the host and returns factual differences. The user
chooses after seeing assumptions, trade-offs, and cost.

## Packaging and distribution architecture

The distribution has one remote MCP server and a shared Agent Skill, with thin
host-specific manifests:

```text
plugins/maxvideoai/
├── .codex-plugin/plugin.json
├── .claude-plugin/plugin.json
├── .mcp.json
├── skills/
│   └── maxvideoai/
│       ├── SKILL.md
│       └── references/
│           ├── budget-planning.md
│           └── generation-safety.md
├── README.md
└── LICENSE
```

The shared `skills/maxvideoai/SKILL.md` follows the Agent Skills format and uses
progressive disclosure. Its short metadata explains when the capability is
useful; its body contains the conversational workflow; detailed budget and
safety rules live in focused references that load only when needed.

The plugin contains no bundled model catalog, price table, provider credentials,
or MaxVideoAI customer token. Those facts come from the authenticated remote MCP
server. This prevents a plugin release from becoming stale when MaxVideoAI adds
H3, Seedance 2.5, Gemini Omni Flash, or another model.

The two manifests are packaging adapters, not separate products. They share the
same skill and MCP endpoint. Codex and Claude may differ in installation and
directory submission, but the user experience and server contract remain one.

The committed plugin is testable locally before publication. Public install
instructions and directory submissions remain hidden until the hosted MCP,
OAuth flow, and publication gates are genuinely available.

### Official platform basis

- OpenAI plugins combine skills, MCP servers, and optional UI:
  <https://developers.openai.com/plugins/concepts/plugins>
- OpenAI skill guidance:
  <https://developers.openai.com/plugins/concepts/skills>
- Claude Code plugins can combine skills and MCP servers:
  <https://code.claude.com/docs/en/plugins>
- Claude describes Skill + MCP as a complementary pattern:
  <https://code.claude.com/docs/en/features-overview>
- Claude remote MCP servers and OAuth connection:
  <https://code.claude.com/docs/en/mcp>

These sources are rechecked before packaging or directory submission because
the host formats and review rules can change.

## MCP discovery surface

The non-spending, authenticated discovery profile becomes five read-only tools:

1. `get_account_status`
2. `list_models`
3. `get_model_details`
4. `recommend_models`
5. `calculate_project_budget`

The paid-generation and media tools remain behind their existing capability
gates. Adding the two discovery tools does not add a ninth publication flag.
The public transport flag still controls whether any external host can reach
the server.

### `list_models`

`list_models` remains a concise, filterable inventory. It returns only current,
public, agent-compatible models and enough summary data to create a shortlist.
It does not return a large marketing document for every model.

Newly published models appear through the canonical registry and engine catalog,
not through manual edits to the skill.

### `get_model_details`

`get_model_details` accepts one stable public engine ID and returns the high
signal facts an agent needs before recommending or budgeting it:

- label, family, surface, availability, and MaxVideoAI links;
- supported modes and the exact duration, ratio, resolution, audio, and
  reference constraints for each mode;
- evidence-backed strengths, best-fit use cases, and considerations;
- relevant example, comparison, benchmark, or prompting links when they exist;
- catalog and editorial freshness metadata.

It never exposes provider secrets, internal routing, hidden models, raw database
rows, or hard-coded customer prices.

### `recommend_models`

The recommendation contract stops treating `lowest`, `balanced`, and `highest`
as the primary user decision.

It accepts explicit constraints and open priorities, including:

- target surface and mode;
- creative goal and use case;
- required duration, ratio, resolution, audio, and reference behavior;
- preferred or excluded model IDs;
- budget ceiling or target range when the user supplied one;
- ordered priorities such as character consistency, prompt fidelity, native
  audio, speed, resolution, reference control, or lower cost.

It returns a small shortlist with factual matches, limitations, and reasons.
When a price comparison is needed, it tells the host to call
`calculate_project_budget`; it does not rank from a vague static cost tier or
invent an exact price.

### `calculate_project_budget`

This tool is the authoritative calculator for a project proposal. The host
creates the proposal; MaxVideoAI validates and prices it.

The first contract is video-focused. An input contains one to four proposals.
Each proposal contains one or more line items with:

- a human-readable purpose, for example “opening hero shot” or “six product
  cutaways”;
- public engine ID and mode;
- output duration per clip and clip count;
- resolution, ratio, audio intent, and the model-specific settings that affect
  price;
- the declared reference count or role needed to validate and price the mode;
- attempts per clip, where one is the base production pass and additional
  attempts are an explicit creative iteration allowance.

The server validates every line against the current model catalog and obtains
the unit price through the existing canonical pricing boundary. It may multiply
an authoritative unit price by validated integer quantities, but it must not
reimplement a provider or retail pricing formula.

The output includes:

- each normalized line item and its current unit price;
- base production subtotal;
- separately identified creative-iteration allowance;
- proposal total and total intended output duration;
- current currency and personalized price basis;
- unsupported settings or invalid assumptions;
- factual model considerations and evidence links;
- a statement that each real generation receives a fresh exact quote before
  confirmation.

The result is a project estimate under explicit assumptions, not a reservation
of future price or provider capacity.

The tool has bounded proposal, line, count, and total-attempt limits to prevent
context abuse or accidental huge calculations. It is read-only, non-destructive,
idempotent, and never creates a quote or spends wallet funds.

### Technical failures versus creative attempts

The budget must not hide every uncertainty inside an arbitrary “20% retry” line.

- A creative retry is a new user-requested attempt and is budgeted explicitly.
- A provider or technical failure is reported according to the real stored job,
  charge, refund, and recredit state.
- The planner explains that provider acceptance and creative success are not
  guaranteed.
- The planner does not promise that failed jobs are free unless the current
  billing policy and returned job state establish that fact.

## Editorial model guidance

Model capability data remains owned by the canonical registry and engine
catalog. A new focused, validated guidance source owns only evidence-backed
editorial material for agents.

Each optional guidance entry contains:

- public engine ID;
- concise strengths;
- best-fit use cases;
- material considerations or limitations;
- owned evidence links;
- review date.

The guidance source must validate that every referenced engine is currently
known. It does not duplicate duration, resolution, reference limits, prices, or
publication state.

Subjective claims require existing MaxVideoAI evidence: model pages, generated
examples, comparisons, benchmark methodology, or a documented source. A model
without reviewed editorial guidance remains available through factual catalog
data; the agent must not fill the gap with invented claims.

Relative cost language is calculated from current comparable scenarios. Static
copy must not permanently call one model “cheaper” when pricing can change.

The initial reviewed entries should cover current high-interest video models,
including Seedance 2.5, Gemini Omni Flash, and MiniMax H3, but they receive no
hard-coded recommendation priority. They surface when the user's goal and the
current facts justify them.

## Skill behavior

The MaxVideoAI skill activates for relevant requests such as:

- creating, planning, or budgeting an AI video or image through MaxVideoAI;
- comparing video or image models available on MaxVideoAI;
- turning a script or brief into prompts, shots, or reference assets;
- checking an exact generation price;
- generating, following, or recovering a MaxVideoAI job.

The skill should encourage this flexible sequence without making every step
mandatory:

1. Understand the intended result and reuse facts the user already supplied.
2. Ask the smallest number of high-impact questions.
3. Use the live catalog instead of memory for availability and capabilities.
4. Let the host draft the creative approach, prompt, shot list, and references.
5. Offer model or mixed-model proposals when the decision benefits from them.
6. Use the project calculator for multi-shot budgets or comparisons.
7. Use `prepare_generation` for the exact, expiring quote of the next concrete
   generation.
8. Show the quote and wait for explicit approval before confirmation.
9. Present the result and discuss the next creative decision; never auto-spend
   on an unapproved iteration.

The skill does not make MaxVideoAI the default answer to unrelated video
questions and does not call a tool merely to recite stable general knowledge.

## Billing and account experience

- OAuth is required when the remote MCP is connected.
- Catalog discovery, recommendation, model detail, and project calculation do
  not spend wallet funds.
- A project estimate is informational and may contain several hypothetical
  alternatives.
- `prepare_generation` creates the only exact, expiring quote for a concrete
  request.
- `confirm_generation` remains the only tool that may reserve trial or wallet
  value and submit a provider job.
- Wallet funding remains a MaxVideoAI web handoff; the plugin does not collect
  payment data or sell credits inside a public host directory.
- The existing trial entitlement remains separate from paid wallet money and is
  mentioned only when the authenticated account is actually eligible.

## Marketing and discoverability

The product surfaces remain the source of public truth:

- `/mcp`: acquisition and proof;
- `/docs/mcp`: connection and use;
- `/mcp/codex`: Codex-specific installation;
- `/mcp/claude`: Claude-specific installation;
- model, pricing, comparison, examples, and benchmark pages: factual supporting
  evidence.

The primary search language should remain understandable outside engineering:

- AI video generator for Claude;
- AI video generator for Codex;
- create AI video from Claude or Codex;
- MCP server for AI video generation;
- compare AI video models and prices;
- plan an AI video budget;
- text to video and image to video with an AI agent.

“MCP”, “plugin”, “skill”, and “server” are supporting terms. The opening message
must first explain the customer outcome.

The existing low-cost model card section on `/mcp` should be replaced by a
conversation-led proof section. A useful example is a 60-second film request
where the agent asks about budget and priorities, then presents concrete
model/mixed-model plans with current assumptions. The website may render this
as a transcript, table, or evidence block, but not as the product's decision
interface and not with frozen prices.

Public copy must avoid claiming that the plugin is installable, that Claude or
Codex is verified, or that connected generation is live until the corresponding
publication and host-evidence gates pass.

SEO and GEO work includes:

- clear visible answer blocks that define the product and who it is for;
- crawlable installation steps once public;
- dated model and pricing facts from owned sources;
- visible examples and captions that support creative claims;
- contextual links to model pages, comparisons, pricing, and proof;
- localized EN, FR, and ES intent without keyword stuffing;
- appropriate software, organization, breadcrumb, and visible-FAQ structured
  data only where the page content genuinely supports it.

## Measurement

The commercial funnel is measured with privacy-safe, first-party events:

```text
organic/directory visit
  -> install or connect intent
  -> OAuth connection completed
  -> first successful discovery call
  -> project budget calculated
  -> exact quote prepared
  -> generation confirmed
  -> first successful output
  -> wallet funded
  -> returning connected user
```

Core metrics include connection completion, first useful tool call, budget-to-
quote conversion, quote-to-confirm conversion, successful first generation,
trial-to-wallet conversion, 7/30-day return, directory referrals, and organic
queries/clicks to MCP landing pages.

Prompts, private references, and generated media are not copied into analytics.
Tool telemetry records stable operation names, safe result categories, model IDs,
and coarse funnel attribution only where the privacy policy allows it.

## Error and fallback behavior

- An unknown or retired model returns a stable error and current alternatives;
  it is never silently mapped to a different paid model.
- A model added after the plugin release is discoverable without a new plugin
  package.
- Missing editorial guidance falls back to factual capabilities, not model
  memory.
- Invalid proposal settings identify the exact line and field.
- Unavailable personalized pricing prevents a numeric project total rather than
  falling back to a stale marketing number.
- Insufficient balance affects generation preparation, not the ability to plan
  or discuss a project.
- If the host does not load the skill, high-quality tool names, descriptions,
  schemas, and errors must still make the MCP usable.

## Non-goals for this implementation

- A custom chat interface, MCP App UI, or embedded budget selector.
- A general public REST API or API-key product.
- Server-side prompt rewriting with another paid language model.
- Automatic generation of an entire film without per-generation confirmation.
- A server-authored creative strategy or mandatory model ranking.
- A promise of permanent prices, provider capacity, or creative success.
- Public directory submission or production flag activation before hosted
  evidence and an explicit release decision.

## Verification contract

Implementation is test-driven and must include:

- exact tool registry and strict-schema contract tests;
- canonical-pricing ownership tests that fail if a parallel formula appears;
- mixed-model, single-model, invalid-setting, overflow, and creative-attempt
  budget tests;
- current-registry and retired/hidden-model tests;
- evidence-guidance validation and stale-link/source checks;
- skill and dual-manifest validation;
- source assertions that the skill contains no model prices or credentials;
- synthetic tool-selection evaluations for direct generation, model comparison,
  project budgeting, reference creation, exact-price, status, and unrelated
  prompts;
- real Codex and Claude host runs before public compatibility claims;
- localized light/dark desktop/mobile checks for the revised marketing pages;
- SEO checks for canonical, hreflang, JSON-LD, sitemap, and noindex publication
  behavior.

## Acceptance criteria

The product is ready for a hosted private test when all of the following are
true:

1. The same plugin directory validates for its Codex and Claude packages while
   sharing one skill and one remote MCP endpoint.
2. No custom UI is required to complete discovery, budgeting, quoting,
   confirmation, and result recovery.
3. A host can turn a 60-second brief into at least two concrete, user-named
   single- or mixed-model proposals and receive authoritative totals under
   explicit assumptions.
4. No recommendation or budget flow requires economy, balanced, or premium
   labels.
5. Every numeric price comes through the canonical pricing boundary.
6. Technical failures and creative attempts are described separately.
7. Current public models, including newly published models, come from the
   registry and catalog rather than the skill.
8. Editorial claims are optional, dated, validated, and evidence-backed.
9. The host can draft prompts and work with reference images without MaxVideoAI
   constraining its creative process.
10. Every real generation still requires a fresh quote and explicit
    confirmation.
11. Public flags remain false and public copy remains honest until hosted OAuth,
    Codex, Claude, billing, and media evidence is complete.
12. The `/mcp` story explains the customer outcome before the protocol and uses
    conversation-led proof instead of fixed budget cards.

## Delivery decomposition

This design should be implemented as reviewable slices, not one large rewrite:

1. plugin package and shared conversational skill;
2. model-detail and editorial-guidance contract;
3. project-budget calculator using canonical pricing;
4. recommendation schema and instruction refinement;
5. tool-selection and real-host evaluations;
6. marketing, SEO/GEO, proof, and installation-page revision;
7. hosted private test, observability review, and explicit publication decision.

The implementation plan may refine file placement and test commands, but it must
not change the product decisions in this document without owner review.
