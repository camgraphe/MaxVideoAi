# P1 video model refresh design

**Date:** 2026-09-03

**Status:** approved for implementation planning

**Owner:** MaxVideoAI product owner

## Objective

Complete the next video-model wave without weakening the model pages and SEO
assets already online. P1 upgrades the existing Gemini Omni Flash product to
the 1.1 generation, adds Kling 3.0 Turbo Standard and Pro with direct Kling
routing first, and adds MiniMax H3 Max as a distinct premium Hailuo product.

The release covers runtime, pricing, model identity, public copy, localized
model pages, discovery menus, examples, scoreboards, comparison pages, sitemap,
internal linking, and MCP parity. Runway remains outside the MaxVideoAI catalog.

## Approved scope

| Public product | Canonical identity | Runtime policy | Public page policy |
| --- | --- | --- | --- |
| Gemini Omni Flash 1.1 | existing `gemini-omni-flash` | Google direct | upgrade the existing canonical page |
| Kling 3.0 Turbo Standard | `kling-3-turbo-standard` | Kling direct, Fal fallback | new model page |
| Kling 3.0 Turbo Pro | `kling-3-turbo-pro` | Kling direct, Fal fallback | new model page |
| MiniMax H3 Max | `minimax-h3-max` | current available provider route | new MiniMax/Hailuo model page |

Runway Gen-4.5, Aleph 2, and all other Runway products are explicitly excluded
from P1. They must not appear in the registry, runtime, pricing, recommendations,
MCP catalog, model pages, comparisons, menus, `llms.txt`, or sitemap.

## Gemini Omni Flash 1.1 decision

### One product, one canonical page

Gemini Omni Flash 1.1 replaces the previous Gemini Omni Flash preview as the
current product. MaxVideoAI keeps the existing canonical identity and URL:

```text
/models/gemini-omni-flash
```

The page title, H1, version label, description, structured data, internal-link
anchors, pricing label, workspace label, examples, comparison labels, and MCP
display name all become **Gemini Omni Flash 1.1**.

MaxVideoAI does not create a second indexable 1.1 page. Candidate versioned
slugs such as `/models/gemini-omni-flash-1-1` and
`/models/gemini-omni-1-1-flash` become aliases that resolve in one hop to the
existing canonical URL. Existing generic aliases continue to resolve to it.

This retains the established URL's signals while allowing the page to cover
both generic `Gemini Omni Flash` demand and explicit `1.1` demand. It also
avoids two near-identical pages competing for the same intent.

### No invented “1.0” product

The previous Google identifier was `gemini-omni-flash-preview`; it was not
published as Gemini Omni Flash 1.0. Public content must not invent a `1.0`
version, model page, alias label, comparison row, or lifecycle entry.

The model page may contain one compact factual migration sentence explaining
that 1.1 supersedes the earlier preview. It must not add a long legacy section
or present the previous preview as a separately selectable model.

### Google-direct runtime

Gemini remains a Google-direct integration. The existing Vertex AI service
account client, `global` region, interaction creation, `GET` interaction
polling, GCS input/output staging, and persisted-output flow remain the
architecture to preserve.

The provider model identifier changes to the current Vertex-compatible 1.1
identifier only after a focused live contract check. There is no Fal fallback
for Gemini and no public provider-routing copy. A failed or unauthorized Google
route fails closed with the existing provider error semantics.

The direct contract must be verified against Google's live documentation and a
non-billed or minimal paid smoke request before public launch. In particular,
the check must cover authentication, model availability for the configured
project, creation payload, polling verb, result shape, output retrieval, and
the supported 1.1 controls.

## Kling 3.0 Turbo design

### Two commercial variants

Kling 3.0 Turbo Standard and Pro are separate public products. Standard is the
faster/value choice and Pro is the higher-quality choice. Their copy, examples,
scoreboard values, pricing, recommendations, and comparison summaries must make
that distinction concise and concrete.

The implementation must not treat Turbo as an alias for the existing Kling 3
Standard or Pro models. It receives its own identities, engine contracts, and
public pages while remaining in the existing Kling family.

### Direct Kling first, Fal fallback

Both Turbo products route to Kling directly whenever the direct route is
configured and eligible. Fal is a resilience fallback, not the preferred
route. The new Kling 3.0 Turbo API uses its own endpoint and payload family, so
the implementation adds a dedicated adapter rather than forcing the existing
Kling 3 request body onto it.

The canonical MaxVideoAI request is normalized once, then projected separately
for the Kling and Fal contracts. Multishot remains a first-class capability:
the direct adapter serializes the normalized shot plan in Kling's required
format, while the fallback adapter preserves the structured Fal representation.

Automatic fallback is allowed only before the direct request is accepted:

- network failure or timeout before a task ID;
- rate limiting;
- provider 5xx or an invalid empty provider response;
- credit depletion only when the existing explicit feature flag permits it.

There is no fallback after a direct task ID, for moderation or request
validation failures, for authentication/account failures, or when active
parameters cannot be projected faithfully to both providers. Provider-attempt
records must preserve which route was tried and which route produced the final
asset.

Public pages sell Kling 3.0 Turbo and its product capabilities. They do not
describe the internal fallback provider.

## MiniMax H3 Max design

### A distinct MiniMax/Hailuo product

MiniMax H3 Max remains in P1 as its own canonical model:

```text
/models/minimax-h3-max
```

The public provider and brand are MiniMax, and the family is Hailuo. Public
model pages, metadata, comparison pages, examples, pricing copy, navigation,
JSON-LD, MCP descriptions, and crawlable text must not mention Fal. Fal or any
other infrastructure provider may appear only in private engineering
documentation, server configuration, administrative diagnostics, provider
attempts, and operational logs.

### H3 and H3 Max must not cannibalize one another

The existing `/models/minimax-h3` page remains published, indexable, current,
and executable. H3 Max does not replace or redirect H3.

The two pages target different decision intents:

- **MiniMax H3:** the broad flagship for native high resolution, richer
  multimodal/reference workflows, and maximum control;
- **MiniMax H3 Max:** the premium post-trained visual choice for strong prompt
  adherence, polished aesthetics, fast creation, and its supported focused
  text/image/first-last workflows.

Each page gets unique metadata, unique lead copy, distinct recommendations, and
distinct example prompts. A short reciprocal “H3 or H3 Max?” decision block
links the two pages using descriptive anchors. A dedicated scoreboard
comparison provides the detailed differences without duplicating large copy on
either model page.

The public description may explain the practical product differences, but it
must not attribute H3 Max to an infrastructure marketplace or discuss routing.
Capabilities are advertised only when confirmed on a live endpoint; an
unverified reference mode or Turbo variant is not added under the H3 Max name.

## Model registry and publication ownership

`frontend/config/model-registry.json` remains the only authored source for
identity, aliases, family, lifecycle, publication, replacement, page exposure,
and route tombstones.

The P1 registry changes are:

- keep `gemini-omni-flash` as the current canonical identity;
- update its display/version facts to 1.1 and add version-search aliases;
- add `kling-3-turbo-standard` and `kling-3-turbo-pro` to the Kling family;
- add `minimax-h3-max` to the Hailuo family;
- leave the existing MiniMax H3 and Kling 3 products published;
- add no Runway identity.

Runtime, engine catalog, roster, and roster documentation are regenerated from
the registry workflow. Generated projections must not be edited directly.
Publication is atomic: a new model does not enter sitemap or public discovery
until runtime, exact pricing, content, examples, scoreboards, and MCP exposure
are ready together.

## Pricing and provider confidentiality

Every route is re-audited immediately before implementation and before paid
examples. The audit records supported modes, durations, resolutions, ratios,
audio behavior, multishot behavior, reference limits, provider base cost, and
any mode-specific surcharge.

Customer prices flow through the canonical pricing engine. The same normalized
request must produce equivalent wallet preflight, API/MCP quote, receipt,
pricing-page estimate, and model-page estimate. Temporary provider promotions
are not treated as permanent customer pricing facts.

Marketing content names the model owner, not the infrastructure route. In
particular, H3 Max is MiniMax/Hailuo, Kling Turbo is Kling, and Gemini is
Google. The name Fal is excluded from all public P1 copy even when a Fal route
exists behind the product.

## Examples and ordinary video workflow

P1 requires eight new accepted videos before publication:

- two generated with Gemini Omni Flash 1.1;
- two generated with Kling 3.0 Turbo Standard;
- two generated with Kling 3.0 Turbo Pro;
- two generated with MiniMax H3 Max.

Prompts are original and model-specific. The set mixes people, narrative
scenes, product-quality visuals, camera movement, lighting, texture, and
motion. It does not repeat one packshot prompt across models. At least one
Kling Turbo example demonstrates multishot when the final live contract
confirms it.

Accepted outputs pass through the existing ordinary admin video workflow. They
are published as normal videos, keep their truthful model IDs and generation
metadata, and are attached to the correct model and family playlists. They are
not automatically marked video-indexed; indexation remains controlled by the
existing admin process. No schema migration is introduced solely for these
examples.

Model and family pages must already resolve their attached videos before their
publication flags and sitemap eligibility are enabled.

## Scoreboards and comparison pages

Every scoreboard cell for the four P1 products must contain a numeric value.
Missing facts are researched from current official sources and supplemented by
MaxVideoAI editorial testing. No empty, `TBD`, provisional, or provider-marketed
score is published.

The primary P1 comparison set is:

- MiniMax H3 Max vs MiniMax H3;
- Kling 3.0 Turbo Pro vs Kling 3.0 Turbo Standard;
- Kling 3.0 Turbo Pro vs Kling 3 Pro;
- Gemini Omni Flash 1.1 vs Kling 3.0 Turbo Pro.

Existing comparison routes involving Gemini keep their URLs and update the
visible Gemini label and current facts to 1.1. Comparisons use the established
scoreboard-first template and do not add side-by-side videos. Editorial text is
kept short; it explains the decision, not the infrastructure.

## Marketing, SEO, and internal linking

The complete P1 public-surface review includes:

- localized model pages and metadata;
- family and model menus;
- examples filters and family pages;
- pricing and pay-as-you-go surfaces;
- comparison discovery and scoreboards;
- homepage or landing-page model mentions where applicable;
- workspace selection and recommendations;
- sitemap, canonicals, hreflang, JSON-LD, and `llms.txt`;
- contextual links between model, family, comparison, examples, and pricing
  pages.

Gemini's existing canonical URL remains self-canonical and does not create a
new sitemap entry. The three new model identities add model routes only when
their publication gate passes. New comparison routes are limited to the
approved set above. The implementation plan must calculate the exact sitemap
URL delta across all supported locales and verify it against generated output.

Internal links reinforce, rather than blur, the intended pages:

- generic and 1.1 Gemini anchors point to the one Gemini canonical page;
- H3-control and multimodal anchors point to MiniMax H3;
- H3-Max visual/premium anchors point to MiniMax H3 Max;
- Kling Turbo value anchors point to Standard;
- Kling Turbo quality anchors point to Pro.

No current route is removed in P1. Alias redirects are direct, permanent,
localized when applicable, and free of chains.

## MCP parity

The public MCP catalog must expose the same current product identities,
capabilities, constraints, exact prices, aliases, and recommendations as the
workspace. Gemini remains one identity whose display name and facts become 1.1.
The two Kling Turbo variants and H3 Max become discoverable and executable only
when their corresponding app routes are ready.

MCP validation and request projection use the same normalized engine schema as
the app. MCP must not leak infrastructure-provider names in model descriptions,
recommendations, generated prompts, or user-facing errors. Private provider
attempt metadata remains available to operations.

The existing MCP mode-coverage and catalog parity guards are release gates.

## Verification and release gates

P1 is ready only when all of the following pass:

1. model-registry generation and parity checks;
2. focused Gemini direct adapter and live 1.1 smoke checks;
3. Kling Turbo direct request, polling, and fallback-boundary tests;
4. H3 Max provider projection and pricing tests;
5. exact quote/preflight/receipt parity tests for every P1 mode;
6. MCP catalog, detail, validation, pricing, generation, and exposure checks;
7. complete benchmark/scoreboard validation;
8. metadata, canonical, hreflang, redirect, sitemap, and localized-route tests;
9. ordinary video publication and playlist attachment verification;
10. visual smoke testing of menus, examples, model pages, comparisons, pricing,
    and responsive layouts;
11. focused lint, architecture contracts, `git diff --check`, and the relevant
    broader test suite;
12. production verification after deployment, including direct provider route
    telemetry and the final sitemap URL delta.

The release is not complete if any public model has placeholder pricing, an
empty example playlist, a partial scoreboard, a mismatched MCP capability, a
public infrastructure-provider mention, or a route that resolves differently
from its declared canonical identity.

## Primary source references

- Google Gemini API changelog: <https://ai.google.dev/gemini-api/docs/changelog>
- Google Gemini model deprecations: <https://ai.google.dev/gemini-api/docs/deprecations>
- Google Gemini Omni documentation: <https://ai.google.dev/gemini-api/docs/omni>
- Google Cloud Gemini Omni 1.1 documentation:
  <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-1-flash>
- Kling 3.0 Turbo API documentation:
  <https://kling.ai/document-api/api/video/3-0-turbo/text-to-video>
- MiniMax H3 Max endpoint documentation:
  <https://fal.ai/models/minimax/h3-max/text-to-video/api>

All source facts must be rechecked at implementation time because preview
model IDs, capabilities, limits, and provider prices can change independently
of this approved product design.
