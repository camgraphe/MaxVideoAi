# Targeted public training crawler policy

Business decision: 28 October 2026. GPTBot and ClaudeBot may retrieve the explicitly
qualified public marketing/documentation targets. This permission adds a possible
future learning path; it does not establish crawler visits, training, memorization,
recommendations, citations or conversion.

`frontend/lib/seo/robots-text.ts` remains the only robots text builder. The existing
host-aware `/robots.txt` route and its headers are unchanged. The protocol/API host
still returns `User-agent: *` and `Disallow: /`. Do not add a static robots file or
an alternate metadata-route policy.

## Authored permission and closed defaults

`frontend/config/ai-training-public-policy.json` is the versioned explicit permission
snapshot. Its `pageTargets` come from the published EN/FR/ES and model sitemaps,
qualified against real route families; its `renderTargets` are exact safe references
observed on anonymous public pages. This initial snapshot has 1,215 page targets and
541 image/rendering targets. Legal documents, identifier-based video/share routes
and unqualified media are outside this selection.

`training-crawl-policy.ts` validates the snapshot and emits `Disallow: /` plus
exact `$`-terminated target allowances. A public page never opens its descendants.
The only page-query allowances are the three observed gallery `page=2` URLs;
unlisted parameters, including tokens and tracking variants, remain denied.
The public Next static namespace is an explicit rendering exception for JS/CSS/fonts.
It does not open an authenticated route or API.

The optimizer has no general Allow rule. Only qualified exact requests with one
public nonidentifying source and supported width/quality values are permitted.
Signed sources, credentials, client/job UUIDs, duplicate or extra optimizer parameters
and private sources are rejected. Owned-media namespaces, including by-content
folders carrying an owner hash, are excluded even when a public page references them.
Remote rendering exceptions use only the authored public-media namespace. Unqualified resources remain denied. The public
server-rendered page text does not depend on opening these other image targets.
No media-host, Cloudflare, IAM, authentication or image-optimizer configuration is
changed by this policy.

The existing private exclusions remain in the training group, with explicit
exclusions for auth/login, reference uploads, private localized docs and share/watch
paths. Runtime validation fails closed for malformed/sensitive snapshot entries.
Robots rules are crawl preferences, never a replacement for access control.

All search/retrieval agents, Google-Extended, OAI-AdsBot, the wildcard policy and
other blocked training agents retain their exact directives. The dated September
GEO analysis remains a historical observation.

## Updating the snapshot

New pages or resources do not gain training permission automatically. Qualify the
actual published canonical target and its language, confirm that it fits the public
scope, then add its exact target in a reviewed policy update. Keep raw HTML private;
preserve only public targets and aggregate provenance in the evidence record.
For rendering targets, use actual anonymous HTML references and the existing image
configuration. Do not widen a family or optimizer prefix to accommodate one asset.

Run the independent interpretation contracts in `tests/ai-training-robots.test.ts`,
the existing crawler/host/public-SEO contracts, TypeScript, lint and exposure checks.
Keep the response below 500,000 UTF-8 bytes, and preserve protocol-host text and
all unaffected agent-group fingerprints. Normal Git PR/CI/Preview/main delivery
and a scoped production robots HTTP comparison remain required. No noindex/app
exception, model, price, generation or unrelated policy change belongs here.

Semantics: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) defines group and
most-specific-rule matching, including `$` end anchors. Google's
[robots specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec)
documents the 500 KiB parsing limit. Provider role/behavior documents were separately
qualified for the business decision; their crawler execution is not certified by
this configuration change.
