# MaxVideoAI MCP Integration Ecosystem Design

**Date:** 2026-09-12
**Status:** product direction approved; ready for owner review before implementation planning
**Owner:** MaxVideoAI product owner

## Purpose

Expand MaxVideoAI from three named assistant integrations into a maintainable
MCP distribution ecosystem without regressing anything already public.

The first commercial priority is acquisition through OpenClaw. The second is
repeatable generation volume through n8n. Cursor, GitHub Copilot, Gemini, and
Microsoft enterprise surfaces follow only after those two paths are measured.

The programme treats the production MCP endpoint as the shared product and each
host integration as a separately evidenced distribution surface. A compatible
wire protocol is necessary, but it is not sufficient to claim that a named host
is verified, that its inline UI works, or that MaxVideoAI is listed in its store.

This design extends rather than replaces the existing MCP specifications and
runbooks, especially:

- `docs/superpowers/specs/2026-08-24-maxvideoai-conversational-plugin-design.md`;
- `docs/superpowers/specs/2026-08-26-maxvideoai-plugin-acquisition-and-continuity-design.md`;
- `docs/superpowers/specs/2026-08-26-mcp-inline-media-app-design.md`;
- `docs/operations/mcp-host-compatibility-matrix.md`;
- `docs/marketing/mcp-directory-submissions.md`;
- `docs/engineering/mcp-mode-coverage.md`.

Their OAuth, quote, explicit-confirmation, recovery, account ownership,
reference handling, billing, claim-evidence, and directory-policy constraints
remain authoritative.

## Approved Product Decisions

### Delivery order

The approved order is:

1. preserve and structurally migrate the existing ChatGPT, Claude, and Codex
   marketing surfaces;
2. validate and launch direct OpenClaw installation;
3. prepare a separate ClawHub distribution package after direct-host evidence;
4. validate n8n as both a deterministic MCP workflow step and an AI Agent tool;
5. publish a small set of approval-safe n8n workflow templates;
6. expand to Cursor, GitHub Copilot, and Gemini;
7. pursue Microsoft Copilot Studio and Agents 365 as a separate enterprise
   programme.

### Marketing page cap

The first wave has six primary marketing concepts:

| Route | Intent owner |
| --- | --- |
| `/mcp` | MaxVideoAI MCP and cross-platform assistant workflow hub |
| `/integrations/chatgpt` | ChatGPT video generation and installation |
| `/integrations/claude` | Claude video generation and connector installation |
| `/integrations/codex` | Codex video generation and plugin installation |
| `/integrations/openclaw` | autonomous and channel-based OpenClaw video production |
| `/integrations/n8n` | automated AI video workflows in n8n |

With English, French, and Spanish projections, these are eighteen indexable
URLs when all six concepts are live. `/docs/mcp` remains technical
documentation rather than another marketing landing concept.

The reasonable mature cap is ten primary marketing concepts after Cursor,
GitHub Copilot, Gemini, and Microsoft Copilot Studio. Secondary hosts such as
Windsurf, Cline, Roo Code, Zed, LM Studio, and other compatible clients appear
in the hub or a compatibility view first. They receive individual landing pages
only after distinct search demand, conversion evidence, or a material install
workflow justifies one.

Claude Desktop and Claude Code stay on one Claude page. Codex CLI and Codex
graphical surfaces stay on one Codex page. VS Code, Visual Studio, supported
JetBrains surfaces, and Copilot CLI stay under one GitHub Copilot concept unless
future evidence establishes distinct customer intent.

### Existing pages remain public

The following are non-negotiable:

- `/mcp`, `/docs/mcp`, `/integrations/chatgpt`, `/integrations/claude`, and
  `/integrations/codex` keep their public routes;
- their existing English, French, and Spanish localized owners remain public;
- existing canonical URLs, reciprocal hreflang, JSON-LD, sitemap inclusion,
  `llms.txt` discovery, and internal links do not regress;
- current production publication and capability flags are not reset or placed
  behind a new preview gate;
- Claude Desktop and Codex CLI retain their current `verified` evidence state;
- Claude Code and ChatGPT retain their currently presented evidence state until
  new host-specific evidence improves it;
- disabled deep links remain disabled unless a later host-specific validation
  explicitly enables them;
- existing direct MCP installation remains available independently of any
  external store decision;
- current OpenAI and Anthropic directory-policy conclusions remain recorded and
  do not disable the public direct-connection pages.

The migration may improve internal ownership and add tests. It must not weaken
public availability, erase positive claims already supported by evidence, or
replace precise host qualifications with generic warnings.

## Programme Decomposition

This design covers multiple independently reviewable systems. Delivery is
therefore split into subprojects rather than one large implementation batch.

| Lot | Deliverable | Can ship independently |
| --- | --- | --- |
| A | immutable public baseline and anti-regression contracts | yes |
| B | central integration registry and parity migration of existing pages | yes |
| C | OpenClaw direct-host compatibility evidence | yes |
| D | localized OpenClaw marketing and SEO launch | yes |
| E | ClawHub package preparation and owner-controlled submission | yes |
| F | n8n client compatibility and approval-safe templates | yes |
| G | localized n8n marketing and SEO launch | yes |
| H | Cursor, GitHub Copilot, and Gemini expansion | one host per change |
| I | Microsoft enterprise compatibility and certification preparation | yes |

Implementation planning starts with Lots A and B. Later lots get their own
focused plans after the preceding host evidence exists and current platform
documentation has been rechecked.

## Architecture

### Separation of operational facts and editorial copy

Create one authored integration registry for facts that must be consistent
across marketing, SEO, compatibility reporting, acquisition tracking, and
distribution documentation. A registry entry describes:

- stable integration identifier and display label;
- category and approved display order;
- canonical English route and localized route ownership;
- public-page state and indexation state;
- one or more concrete host surfaces;
- supported installation mechanisms;
- direct MCP availability;
- store or registry state;
- evidence date and source document;
- acquisition attribution key;
- optional deep-link state;
- factual limitations that affect installation or purchasing decisions.

The registry must not own prose-heavy hero copy, FAQ answers, workflow examples,
prices, model lists, screenshots, or claims not derivable from evidence.

Localized editorial content remains route-local and strict. Split the current
large integration copy owner into focused content modules so adding OpenClaw or
n8n does not multiply branches inside one file. English, French, and Spanish
documents must be complete; no public integration page silently falls back to
English.

### Explicit routes and shared rendering

Keep explicit Next.js route owners for every indexable integration. Do not
replace them with a single unrestricted `[integration]` route.

Each route should remain a thin orchestrator that:

1. resolves its exact integration identifier;
2. reads shared publication state and the corresponding registry entry;
3. reads strict localized editorial content;
4. resolves host evidence and optional proof media;
5. builds metadata and JSON-LD;
6. renders the shared integration page view.

The shared view and section components remain host-neutral. Host-specific
installation commands, terminology, limitations, examples, and store actions
arrive through typed page data rather than conditional JSX branches.

### Independent state dimensions

Do not model the lifecycle as one status ladder. Store discovery, direct MCP
availability, host evidence, page publication, and SEO publication can differ.

The registry uses independent dimensions equivalent to:

```text
sitePublication: live | preview_noindex | hidden
hostEvidence: verified | tested_with_limits | not_run
installation: direct_available | package_available | unavailable
store: not_applicable | eligible | preparing | submitted | listed | policy_blocked
```

Existing values map without downgrade. New integrations default to `hidden`,
`not_run`, `unavailable`, and the factual store state determined from current
primary-source review. A store state never controls direct MCP availability.

`preview_noindex` is available for internal or owner-reviewed content, but it
must not be used to demote a currently live route.

### Publication derivation

Keep the global MCP product publication state distinct from per-integration
publication. The existing global flags continue to decide whether the shared
MCP product, transport, OAuth, discovery, paid generation, references, and
indexation are active.

A new integration page can render and become indexable only when both are true:

1. the shared global product prerequisites remain live;
2. that integration's explicit page state permits rendering and indexation.

Existing public paths are seeded as `live` and indexable during migration.
Adding per-integration gating must not change their current output.

### Compatibility evidence

Compatibility belongs to a concrete host surface, not merely a brand. Evidence
records retain:

- host identifier and version;
- staging or production environment;
- exact endpoint and release tested;
- installation and authentication result;
- tools exercised;
- quote and spend boundary result;
- accepted-job recovery behavior;
- reference import or upload behavior where applicable;
- result presentation and fallback behavior;
- refresh, revocation, and reconnect result;
- known limitations;
- evidence document and review date.

Marketing may summarize these facts, but the operations compatibility matrix
remains the human-readable evidence authority.

### Acquisition attribution

Extend acquisition attribution additively. Existing `chatgpt`, `claude`, and
`codex` identifiers and historical data remain valid. New integrations add
stable identifiers such as `openclaw` and `n8n`; identifiers must never be
renamed merely to match changing marketing terminology.

The funnel is:

```text
landing view
-> install or copy action
-> OAuth started
-> OAuth approved
-> first MCP tool use
-> exact quote prepared
-> generation confirmed
-> generation completed
-> repeat use
```

Only events the product can actually observe are reported. A copied endpoint or
outbound store click is not treated as a successful connection. Host family is
recorded when supported by the authenticated MCP boundary; it is not guessed
from untrusted free-form user-agent text when attribution is ambiguous.

## Lot A: Baseline and Non-Regression Contract

Before moving ownership, capture the current public contract in automated
fixtures and assertions.

The baseline covers all fifteen localized owners formed by five public concepts
across three locales:

- route and HTTP behavior;
- rendered public-page availability;
- metadata title and description ownership;
- canonical URL;
- reciprocal EN/FR/ES hreflang;
- JSON-LD types and stable identity URLs;
- sitemap inclusion;
- `llms.txt` inclusion and wording boundaries;
- connection and copy actions;
- deep-link disabled state;
- compatibility host statuses and evidence date;
- publication, paid-generation, and reference claims;
- internal-link targets;
- localized route recognition by the middleware/publication boundary.

Prefer semantic assertions over a full brittle HTML snapshot. Use narrow
snapshots only for structured metadata or configuration projections where exact
parity matters.

The contract must fail if a migration:

- removes or redirects an existing route;
- changes an existing route to 404 or `noindex`;
- drops an alternate locale;
- removes a supported installation action;
- changes a `verified` host to a weaker state;
- disables the global MCP connection through a new integration-specific flag;
- removes an existing public path from sitemap or `llms.txt` while the global
  publication gate remains open.

## Lot B: Registry and Existing-Page Migration

Introduce the registry and strict parser with only the existing three client
families first. Do not add OpenClaw or n8n in this lot.

Migration order:

1. add registry validation and exact current entries;
2. make compatibility and action projections consume the registry while
   preserving their public shapes where practical;
3. split editorial copy without changing strings;
4. move shared route data construction into a pure builder;
5. update the three thin route owners to use the builder;
6. run baseline parity contracts after each responsibility moves;
7. update architecture documentation once the new ownership is stable.

The old public types may remain as compatibility aliases during the migration,
but there must be one authored factual registry at completion. Do not keep two
editable client lists.

## Lot C: OpenClaw Direct Compatibility

OpenClaw is the first new acquisition host because it combines MCP consumption,
agent orchestration, and channel-backed use cases.

Recheck current official OpenClaw documentation at implementation time. Validate
the direct path before designing a ClawHub package.

The controlled host checklist includes:

1. add the MaxVideoAI production MCP URL through the supported OpenClaw MCP
   registry flow;
2. complete OAuth without copying MaxVideoAI credentials into configuration;
3. inspect account status and the current model catalogue;
4. request a recommendation and a comparable project budget;
5. prepare an exact quote without spending;
6. with separate owner approval for real spend, confirm one minimal quote once;
7. survive the long-running generation boundary and recover the accepted job;
8. present the completed output or use the canonical result/library fallback;
9. exercise one bounded private reference path and clean up disposable media;
10. deny consent, refresh authentication, revoke access, observe authentication
    loss, and reconnect explicitly;
11. verify that ambiguous timeout recovery does not duplicate a paid job;
12. record the exact OpenClaw version, MaxVideoAI release, result, limitations,
    and sanitized evidence.

Wire compatibility alone may justify a technical setup guide. Public
`verified` wording requires the controlled host checklist applicable to the
claim.

## Lot D: OpenClaw Marketing and SEO

Create `/integrations/openclaw` with complete EN/FR/ES content after direct
installation and OAuth work on the public endpoint.

The page owns the distinct intent of producing MaxVideoAI videos from an
OpenClaw-managed agent and supported conversation channels. It must not imply
that every OpenClaw channel supports identical attachment, inline-video, or
approval UI.

Required sections are:

- outcome-led hero;
- direct installation using the current official OpenClaw flow;
- factual OAuth and account-continuity explanation;
- model recommendation, budgeting, exact quote, and explicit approval flow;
- long-running generation recovery;
- result and library continuity;
- channel and attachment limitations grounded in evidence;
- disconnect and revocation procedure;
- host-specific FAQ;
- current evidence date and source;
- ClawHub status presented separately from direct installation.

SEO requirements:

- a unique title, description, primary heading, and answer passages;
- canonical and reciprocal hreflang;
- factual WebApplication/SoftwareApplication, HowTo, breadcrumb, and FAQ schema
  only where the rendered content and existing schema policy support them;
- inclusion in sitemap and `llms.txt` only after the page is `live` and its
  indexation gate is satisfied;
- contextual links from `/mcp`, `/docs/mcp`, and the integration navigation;
- no mass injection of identical OpenClaw anchors across model pages;
- no public download, usage, partnership, or endorsement claim without source
  evidence.

## Lot E: ClawHub Distribution

Treat ClawHub as an external distribution product, not as proof of direct MCP
compatibility.

After Lot C evidence, determine the smallest compliant package. Prefer a thin,
auditable package that registers or guides connection to the remote MaxVideoAI
MCP and reuses the server-owned live catalogue. It must not duplicate model
identity, pricing, provider rules, or billing logic.

Before any owner-authorized submission:

- recheck ClawHub publisher, namespace, package, compatibility, security scan,
  icon, source provenance, and moderation requirements;
- validate and dry-run the exact artifact;
- record every file and permission in the package;
- verify the install/update/uninstall path on a clean OpenClaw environment;
- confirm that the package cannot bypass MaxVideoAI OAuth or quote approval;
- prepare owned copy and artwork without implying OpenClaw endorsement;
- obtain explicit owner authorization for the external write.

Store state progresses independently through `eligible`, `preparing`,
`submitted`, and `listed`. A rejection or policy block leaves the direct
OpenClaw integration live.

## Lot F: n8n Compatibility and Templates

Validate two distinct n8n paths:

1. the MCP Client node uses MaxVideoAI tools as deterministic workflow steps;
2. the MCP Client Tool exposes selected MaxVideoAI tools to an n8n AI Agent.

Recheck current n8n transport and OAuth behavior at implementation time. Record
the exact n8n version and whether OAuth credentials are per-user, project, or
instance scoped for each supported deployment shape.

Initial templates are deliberately small:

### Brief to approved generation

Accept a structured brief, discover an appropriate model, prepare an exact
quote, pause for a human approval event, confirm once, poll or resume status,
and return the saved MaxVideoAI result.

### Campaign queue

Read a bounded list of approved briefs, calculate a project budget before any
spend, process items sequentially or with an explicit concurrency limit, keep a
stable idempotency key per item, and stop for human approval before each exact
confirmation or before a clearly presented batch approval supported by the MCP
contract.

### Completion notification

Start from an already accepted MaxVideoAI job, recover status without creating
a replacement, notify only on completion, failure/refund, or required user
action, and include the canonical result/library destination.

Templates must not contain credentials, fixed prices, hard-coded model rosters,
unbounded loops, automatic creative retries, or a path that treats
`prepare_generation` as authorization to spend.

## Lot G: n8n Marketing and SEO

Create `/integrations/n8n` after at least one supported n8n deployment completes
the applicable direct-host checklist and the templates pass clean-import tests.

The page owns workflow-automation intent rather than generic assistant intent.
It explains:

- when to use a deterministic node versus an AI Agent tool;
- authentication and credential ownership;
- approval-safe quote and confirmation design;
- resumable long-running jobs;
- idempotency and duplicate-spend prevention;
- template installation and supported deployment shapes;
- account library continuity;
- exact limitations and evidence date.

Indexation follows the same live-evidence gate as OpenClaw. Template catalogue
submission, if available and eligible, remains a separate owner-authorized
external action.

## Later Host Expansion

After OpenClaw and n8n have acquisition and usage data, expand one host per
reviewed delivery:

1. Cursor, including remote OAuth and an installation button if currently
   supported;
2. GitHub Copilot across the supported host family and registry discovery;
3. Gemini CLI, including its exact OAuth issuer and callback requirements;
4. Microsoft Copilot Studio and Agents 365 in a separate enterprise track.

Each host reuses the registry, renderer, evidence model, and release gates. No
host gets a page merely because it implements MCP. A landing page requires
distinct intent and a supportable install experience.

## Hub and Navigation Design

`/mcp` remains the primary commercial hub and keeps the existing ChatGPT,
Claude, and Codex actions visible. Adding integrations must not push all three
existing choices below a new generic catalogue.

The expanded hub groups integrations by customer job:

- assistants;
- autonomous agents;
- development environments;
- automation;
- enterprise.

The first wave highlights ChatGPT, Claude, Codex, OpenClaw, and n8n without
pretending all have the same evidence or store availability. Each card uses the
registry to show a concise factual availability state and links to its exact
guide. Secondary compatible clients may appear in a restrained compatibility
section without receiving fabricated logos, evidence, or individual SEO pages.

## SEO, GEO, and Localization Policy

### Intent isolation

Every page must answer a different search and purchase question. Do not clone a
generic MCP page and substitute a brand name.

- ChatGPT and Claude own conversational production intent.
- Codex and later coding hosts own developer-assisted production intent.
- OpenClaw owns autonomous/channel-based production intent.
- n8n owns repeatable workflow automation intent.
- Microsoft owns governed enterprise agent integration intent.

Keyword and SERP assumptions are time-sensitive. Recheck them with current
Search Console data and primary platform terminology before authoring a new
page. Search-volume estimates are inputs, not product truth.

### Publication gate

A new integration route may be implemented as `preview_noindex`. It becomes
`live` and indexable only when:

- public installation instructions work on the named host;
- required OAuth behavior is recorded;
- the page's claims match current evidence;
- EN/FR/ES editorial content is complete;
- metadata, canonical, hreflang, JSON-LD, sitemap, `llms.txt`, robots, and
  localized route tests pass;
- support and disconnect instructions are usable;
- the owner approves publication.

This gate applies only to new integrations. It cannot demote the existing live
surfaces.

### GEO answer quality

Each page includes concise server-rendered passages that establish:

- what MaxVideoAI does in the named host;
- how model choice, budgeting, quote, and approval are separated;
- where private media and completed results live;
- how the user connects, recovers, and disconnects;
- which host limitations materially affect the workflow.

Do not publish invented testimonials, generated host screenshots presented as
real, stale model counts, fixed prices, or unsupported affiliation claims.

## Store and Registry Policy

The Official MCP Registry entry `com.maxvideoai/maxvideoai` is already active
and must be preserved. Updating it follows its existing versioned release and
owner-authorization process.

Every other external destination is tracked independently:

- ClawHub;
- n8n template or integration catalogue;
- Cursor MCP catalogue or install button;
- GitHub MCP Registry and Copilot discovery;
- Gemini distribution surfaces;
- Microsoft MCP certification;
- OpenAI and Anthropic directories.

For each destination, recheck primary documentation on the day of preparation
and again on the day of submission. Record eligibility, policy conclusions,
artifact version, test evidence, ownership, support, privacy, requested
permissions, and rollback/unpublish procedure.

No store submission, publisher account change, namespace claim, external
message, or public release is authorized merely by approving this design.

## Error Handling and Safety

Host adapters, packages, pages, and templates preserve these boundaries:

- a recommendation or budget is not an exact quote;
- `prepare_generation` does not authorize a charge;
- confirmation requires explicit approval of a fresh exact quote;
- accepted jobs are recovered rather than resubmitted after timeouts;
- automatic retries are allowed only for documented technical recovery that
  cannot create a second provider job or creative charge;
- creative retries always require a new quote and approval;
- payment details never enter MCP conversation content;
- private reference bytes use owned MaxVideoAI import/upload boundaries;
- results remain attached to the authenticated MaxVideoAI account;
- hosts without inline MCP Apps rendering receive canonical web/library links;
- a store failure never turns off the direct endpoint;
- one host failure never changes the evidence or publication state of another.

## Testing and Evidence

### Automated contracts

Add or extend focused tests for:

- registry schema, unique identifiers, stable ordering, and route uniqueness;
- exact preservation of existing integration entries and evidence floors;
- strict EN/FR/ES content completeness;
- route orchestration and server/client boundaries;
- metadata, canonical, reciprocal hreflang, and JSON-LD;
- public-path recognition, middleware behavior, sitemap, and `llms.txt`;
- per-integration publication without global regression;
- acquisition allowlists and backward-compatible identifiers;
- install/deep-link action safety;
- store state independence;
- no fixed prices or model rosters in integration content;
- n8n template approval and idempotency invariants;
- generated distribution artifact reproducibility where a package exists.

### Host evidence

Automated SDK tests do not replace real-host evidence. Each claimed host gets a
controlled checklist, sanitized evidence record, exact version, and limitation
summary. Real spend, external publication, and destructive cleanup remain
owner-controlled.

### Verification gates

For each implementation lot, run focused contracts first, then:

- `npm --prefix frontend run lint`;
- `npm run lint:exposure`;
- `git diff --check`;
- representative EN/FR/ES route smoke tests;
- metadata and JSON-LD inspection;
- a full frontend build before merge when feasible.

Host launch lots also require clean-account installation, OAuth, revocation,
reconnect, quote, recovery, and result-path evidence proportional to their
claims.

## Measurement and Review

The admin and acquisition views should separate:

- landing traffic by integration and locale;
- install/copy/store actions;
- connected MCP accounts by attributable client family;
- first tool use;
- quote preparation;
- confirmed and completed generations;
- provider failures and refunds;
- repeat usage over an explicitly documented window.

Do not claim causality where only correlation exists. A landing visit or copied
endpoint does not prove OAuth completion. A connected account does not prove
that a specific landing caused the connection unless the signed acquisition
binding supports that conclusion.

After OpenClaw and n8n launch, compare their acquisition-to-connection,
connection-to-quote, quote-to-confirmation, completion, and repeat-use rates
before committing to more individual landing pages.

## Documentation Ownership

Update documentation with the lot that changes its subject:

- architecture and maintenance ownership in `docs/engineering/`;
- host evidence in `docs/operations/mcp-host-compatibility-matrix.md`;
- store eligibility and submissions in
  `docs/marketing/mcp-directory-submissions.md`;
- public claims and proof provenance in the existing marketing evidence docs;
- root `AGENTS.md` guide map if a new integration-maintenance guide becomes a
  required first reference.

Do not place mutable platform facts only inside marketing copy. Evidence dates,
source documents, and operational limitations must remain inspectable outside
the rendered page.

## Release and Rollback

Each lot is deployed independently.

- Lot A adds tests only and cannot change production rendering.
- Lot B must preserve all current public behavior and can be rolled back without
  touching the MCP endpoint.
- Lots C and F add evidence and host support without requiring public pages.
- Lots D and G use per-integration publication so a new page can be hidden
  without affecting existing pages.
- External packages and store listings have separate version and rollback
  procedures.

Rollback of OpenClaw, n8n, or a later host must target only that host's page,
package, or evidence claim. The global MCP transport and existing ChatGPT,
Claude, and Codex surfaces remain live unless a separate production incident
requires the established global rollback process.

## Definition of Success

The programme succeeds when:

1. all existing MCP public surfaces retain their routes, indexation, claims,
   actions, and evidence after migration;
2. adding a host no longer requires widening closed three-client unions across
   unrelated UI and copy owners;
3. OpenClaw completes a documented public-endpoint lifecycle and gains a
   distinct localized acquisition page;
4. n8n completes a documented client lifecycle and offers at least two
   importable, approval-safe workflows;
5. host, page, installation, and store states remain independently truthful;
6. marketing attribution connects platform acquisition to observable product
   use without inventing success events;
7. SEO growth comes from distinct intent pages rather than duplicated thin
   content;
8. later hosts can be added one at a time through the same evidence and release
   gates;
9. no external store submission occurs without fresh policy review and explicit
   owner authorization.
