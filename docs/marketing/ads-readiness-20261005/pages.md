# Public entries prepared for local review — 2026-10-05

These are implemented local candidates on `codex/ads-readiness-20261005`. Work started from the deployed main commit `e50fb575a` and was rebased onto current main `0d16f0248`, now also served by both public domains. They are awaiting the owner's visual review. No publication, deployment, spend, paid generation, account creation or payment was performed for this work.

The working advertising hypothesis is an existing **Claude Desktop** user turning a product brief into one quoted clip: connect → authorize the account → prepare and review the current quote → explicitly approve → retrieve and download the completed clip. This ordering describes the product path; it is not a claim of advertising effectiveness or a newly completed production test. Studio is the second candidate, for an individual product image or clip rather than an exported edited film.

## Implemented public routes

| Page | English | French | Spanish |
| --- | --- | --- | --- |
| Primary Claude candidate | `/integrations/claude` | `/fr/integrations/claude` | `/es/integraciones/claude` |
| Studio second candidate | `/studio` | `/fr/studio` | `/es/studio` |
| MCP host-selection hub | `/mcp` | `/fr/mcp` | `/es/mcp` |
| Codex alternative | `/integrations/codex` | `/fr/integrations/codex` | `/es/integraciones/codex` |

Canonical URLs, reciprocal hreflang, public URL recognition, sitemap ownership, indexability, publication gates and JSON-LD owners are retained. Metadata descriptions follow the revised localized visible text. There are no new routes or host publication decisions.

## What changed and why

**Claude Desktop.** The headline names a brief and an individual clip. The primary action opens the existing setup section. The existing Claude result capture appears in the hero instead of an illustrated scene; it is displayed once, marked with the staging environment and capture date. Three readable stages before technical setup explain account authorization, current quotation and download. The entry explains wallet-funded media, the separate Claude plan requirement and the absence of an additional MaxVideoAI subscription. The Claude Code setup remains available with its separate unverified host record.

**MCP hub.** The entry explains the brief → quote → approval → saved-video task and keeps one main action to choose an integration. The same dated Claude capture is identified as evidence for that host only. All existing integration guides and limitations remain available, including ChatGPT's eligible workspace limits and separate preparing labels for unpublished clients. No universal assistant compatibility is claimed.

**Codex.** The page names a launch clip for a maker's project or site, with the existing plugin setup. Three stages explain installation, quote review and retrieval. The illustrated visual retains its explicit illustration label. No Claude host proof is presented as a Codex result; the entry limits published host validation to Codex CLI, without extending it to every Codex surface or version.

**Studio.** A concrete product brief replaces the abstract hero introduction. The existing labeled local interface fixture is visible beside the entry on desktop. Media-generation costs and limited assistance allocations are distinguished. Public-beta sequence MP4 export remains explicitly unavailable. The obsolete advanced Canvas promise is removed, consistent with the current single conversational Studio interface. Existing broader image, clip and sound descriptions and FAQs remain accessible.

**Mobile order.** Each revised entry uses real document order: title and short introduction → main action → capture or illustrated visual → secondary help/navigation and access/cost notes. Desktop grid areas retain the paired composition. The media does not start an automatic video download, retains fixed image dimensions and remains discoverable in server HTML. Studio retains one prioritized responsive capture; the Claude proof replaces the previous prioritized hero illustration rather than adding a second prioritized hero image.

## First-use continuity

The Studio public action now enters the existing handler with `starter=product-ad` and the exact EN/FR/ES `lang`. Anonymous entry preserves the `/app/studio?starter=product-ad` target, passes the selected language to login and starts with Create account; returning users retain Sign in. Authenticated entry retains the existing direct Studio destination. Access denials and disabled Studio retain their established fallback.

The public example and the delivered draft have matching localized text. The draft asks for one short product clip, the model/settings/current quote and explicit approval before generation. The existing conversational owner still makes it editable and requires the user to send it; navigation does not submit a prompt or generation. All three older allowlisted starters remain recognized; Spanish starter copy no longer falls back to English.

The draft initializer receives the selected application locale before the conversation UI's existing EN/FR fallback. This preserves a Spanish brief without claiming that the entire connected Studio UI was translated in this change.

Login now recognizes the exact `/app/studio` route and its nested conversations as Studio continuations. It explains the destination and confirms that opening Studio does not start a paid generation. It does not claim that a prompt, reference or completed result already exists. OAuth consent routing and MCP sign-in behavior remain with their existing owners.

## Evidence and factual limits

- The Claude hero image is the existing `/media/mcp/claude-inline-video-proof.jpg`: controlled staging capture dated **2026-08-26**, Claude Desktop **1.37937.1**, reference `host-ui-claude-2026-08-26-v1`. Its displayed **$0.95** is explicitly historical and is not a current quotation. No new host test, partnership, endorsement or video production is implied.
- Studio uses the existing `/assets/studio/studio-conversation-preview.webp`, a local connected-project fixture with demonstration media reviewed on 2026-10-04. The caption states that status; it is not sold as a newly generated result or a real customer outcome.
- Generation settings, model capabilities and current executable quotes remain runtime owners. No fixed public clip price, fabricated discount, unlimited assistance or free-generation promise was introduced.
- The Codex published production checkpoint and Claude/ChatGPT/other host limitations remain owned by `docs/operations/mcp-host-compatibility-matrix.md` and the integration registry. No host evidence status or publication/acquisition eligibility was changed.

Claude setup text and the copyable guidance request were refreshed against [Claude's official custom-connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), read on 2026-10-05. The guide now includes Pro/Max and organization requirements, the Continue/authentication-review stages and per-conversation enablement. It retains detected OAuth and makes no assertion that this server supports Claude's published OAuth identity. This is a documentation preflight, not a fresh installation or host lifecycle pass. A nonpaid production connection/account/catalogue rehearsal is still needed before an advertising launch; paid clip proof needs separate explicit authorization.

## CTA observations

The markup uses the existing consent-controlled `cta_click` path with narrow taxonomy agreed with the measurement owner:

| Action | `cta_name` | `cta_location` | `target_family` |
| --- | --- | --- | --- |
| Studio open | `studio_open` | `studio_hero`, `studio_closing` | `studio` |
| Integration setup guide | `mcp_setup_guide` | `integration_hero` | `mcp` |
| MCP choose integration | `mcp_choose_integration` | `mcp_hero` | `mcp` |

A setup-anchor click is an observation. It does not represent installation, account authorization, effective connection or first media completion. Campaign continuity, consent loss, first external payment and server transport diagnostics are documented by the separate measurement work.

## Source comparison and checks

Read-only comparison against five relevant files in `/Users/adrienmillot/Desktop/MaxVideoAi V2` found integration editorial identical; MCP editorial, login continuation and the Studio entry handler differed, and the current Studio marketing copy was absent there. No Desktop file was copied wholesale or changed. The source comparison retained the newer worktree route and ownership decisions, including direct conversational Studio entry.

Working requirements came from the supplied `TRAVAUX-AVANT-PUBLICITE.md` and `REVISION-STUDIO-MCP.md` in `/Users/adrienmillot/Documents/ChatGPT/OUTREACH/sources/2026-10-05/paid-ads-study/`, the current V2 design README/implementation 13/style guide and the engineering page/media/pricing/MCP/Studio/auth contracts.

Focused tests cover Studio starter/copy continuity, signup/language/next targets, login continuation safety, retired Canvas claims, host proof placement/isolation/publication gating, current Claude setup text, thin route owners, canonical/hreflang/schema and the existing public MCP baseline. The newly meaningful failure cases were observed before their fixes. The coordinator owns full lint/type checking, visual desktop/mobile review, browser navigation and comparable before/after performance evidence in this directory's `review/` files. Browser and development measurements are local evidence; they do not establish production Core Web Vitals or a conversion gain.
