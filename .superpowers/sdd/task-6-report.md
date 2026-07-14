# Task 6 report: MCP SEO/GEO discovery signals

## Status

DONE — implementation, fail-closed publication behavior, production build, and sitemap inspection are verified.

## Implementation summary

- Made `frontend/config/mcp-publication.json` the shared indexation decision for both sitemap owners. The checked-in
  false state removes `/mcp`, `/integrations/claude`, `/integrations/codex`, and `/docs/mcp`; an all-prerequisites-green
  fixture emits the four canonical owners with exact EN/FR/ES alternates and `x-default`.
- Extended permanent sitemap exclusions for API, OAuth, account, upload, authenticated app, workspace, library,
  media-library, and private-documentation surfaces. `https://api.maxvideoai.com/mcp` is never a source-page entry.
- Split training crawlers from public search/answer and user-requested retrieval crawlers in `robots.txt`. Public
  content remains readable to named answer engines, while protocol and private surfaces remain disallowed.
- Made the route-owned `llms.txt` consume the shared publication state directly. It deterministically omits all four
  sources while promotion is false and adds the four distinct canonical owners when every prerequisite is true;
  the technical MCP endpoint is never a source-page entry.
- Added publication-gated, localized contextual links from pay-as-you-go, the model pricing/limits section, examples,
  and the footer. The existing docs-index link remains governed by the same publication state. Labels vary naturally
  by placement and locale instead of repeating one exact-match anchor.
- Applied the approved English metadata intent and native French and Latin-American-neutral Spanish equivalents. All
  titles remain within the 60-character search-result target. Existing canonical and reciprocal hreflang builders
  remain authoritative.
- Added five visible server-rendered answer passages covering integration behavior, price inputs, supported-reference
  boundaries, separate confirmation, and disconnect/revocation. Each passage selects honest live or gated copy from
  capability state and shows the recorded compatibility verification date. No FAQ or HowTo rich-result schema was
  added.
- Recorded the read-only GSC baseline and query groups in `docs/marketing/mcp-gsc-baseline.md`, including the warning
  that filtered totals/query tables may be partial and a non-overlapping primary-intent map for MCP, integrations,
  docs, pricing, pay-as-you-go, model, prompt, and example pages.
- Did not enable publication, indexing, connection, generation, trial, or reference flags. No GSC write, sitemap
  submission, indexing request, deployment, push, pull request, or external mutation was performed.

## TDD RED evidence

The focused Task 6 contract was written before the production changes:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-seo-signals.test.ts \
  tests/schema-sitemap-architecture.test.ts
```

Initial result: exit 1; 10 tests, 1 passed and 9 failed. The failures proved the intended missing behavior:

1. `/docs/mcp` leaked into the checked-false generated-sitemap candidate set.
2. The enabled fixture emitted only two of the four source owners.
3. MCP metadata did not match the approved search intent.
4. The five dated SSR answer passages did not exist.
5. Search/answer crawler and private-surface rules were incomplete.
6. `llms.txt` did not document its promotion gate.
7. The shared conditional internal-link owner did not exist.
8. The GSC baseline and intent map did not exist.
9. The runtime sitemap source did not consume the shared publication gate.

A later title-length contract was also observed RED against the 62-character Spanish title before shortening it to a
native 58-character form.

## GREEN and regression evidence

Focused publication, SEO-signal, and sitemap architecture contracts:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-publication.test.ts \
  tests/mcp-seo-signals.test.ts \
  tests/schema-sitemap-architecture.test.ts
```

Result: exit 0; 13 passed, 0 failed.

Task 1–6 regression plus localization, claims, pricing authority, and sitemap contracts:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/public-product-claims.test.ts \
  tests/mcp-publication.test.ts \
  tests/mcp-config.test.ts \
  tests/mcp-demo-assets.test.ts \
  tests/mcp-budget-options.test.ts \
  tests/mcp-marketing-copy.test.ts \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-marketing-visual-contract.test.ts \
  tests/mcp-docs-content.test.ts \
  tests/mcp-acquisition-attribution.test.ts \
  tests/mcp-seo-signals.test.ts \
  tests/schema-sitemap-architecture.test.ts \
  tests/marketing-locale-routing.test.ts \
  tests/pricing-public-authority.test.ts \
  tests/pricing-public-projection.test.ts
```

Result: exit 0; 126 passed, 0 failed.

Final full MCP regression suite:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-*.test.ts
```

Result: exit 0; 170 passed, 0 failed.

Static validation:

```bash
npm --prefix frontend run i18n:check
npm --prefix frontend run seo:check
npm --prefix frontend run lint
./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm run lint:exposure
git diff --check
```

Result: every command exited 0. French parity is 4,156 keys, Spanish parity is 4,150 keys, and the SEO, llms,
internal-link, public-media-origin, frontend lint, type, exposure, and whitespace checks all pass.

Production build:

```bash
npm --prefix frontend run build
```

Result: exit 0. Model registry/catalog validation, Next.js compilation and type validation, 729 static pages, and
`next-sitemap` postbuild generation completed successfully.

## Sitemap and canonical inspection

The generated diagnostic sitemap was inspected directly:

```bash
rg -n -i 'mcp|integrations/(claude|codex)|integraciones/(claude|codex)' \
  frontend/.next/generated-sitemaps/sitemap-0.xml \
  frontend/.next/generated-sitemaps/sitemap.xml
```

Result: no matches in the checked-false build.

The production build was then served locally and the three runtime sitemap owners were fetched. Each reported zero
matches for the four gated English paths and their French/Spanish equivalents:

```text
sitemap-en.xml gated_mcp_matches=0
sitemap-fr.xml gated_mcp_matches=0
sitemap-es.xml gated_mcp_matches=0
```

The four public source routes also fail closed in this build:

```text
/mcp status=404
/integrations/claude status=404
/integrations/codex status=404
/docs/mcp status=404
```

Canonical host QA ran against that local production server:

```bash
npm --prefix frontend run qa:canonical-host
```

Result: exit 0; `/`, `/fr`, and `/es` passed canonical-host and `x-default` checks. The local server logged expected
database-unavailable fallbacks because no `DATABASE_URL` was supplied; these did not affect the canonical or sitemap
checks.

## Crawler policy basis

The named-role split was checked against current first-party documentation on 2026-07-14:

- OpenAI distinguishes OAI-SearchBot for search from GPTBot for potential model training:
  <https://platform.openai.com/docs/bots>
- Anthropic distinguishes Claude-SearchBot, Claude-User, and ClaudeBot:
  <https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler>
- Perplexity distinguishes PerplexityBot search crawling from Perplexity-User user-requested fetches:
  <https://docs.perplexity.ai/guides/bots>

`robots.txt` is an access policy, not a publication mechanism. Public discoverability still requires the shared
publication gate, indexable metadata, sitemap inclusion, source listing, and contextual links.

## Activation and measurement handoff

- All seven publication prerequisites must be true before the four owners become indexable. Changing
  `publicIndexing` or another publication flag requires separate explicit approval and review.
- The route-owned `llms.txt` automatically adds or removes the four distinct source-page entries from the shared
  publication JSON. No manual source-list edit is required during activation, and
  `https://api.maxvideoai.com/mcp` is never listed as a source page.
- After an approved deployment, inspect GSC indexation, selected canonicals, queries, countries, CTR, and
  cannibalization against the preserved baseline. This task intentionally made no GSC write or submission.
- Do not infer launch demand from the zero Claude/Codex filters or the one MCP impression. GSC explicitly warns that
  filtered totals and query rows can be partial.

## Review remediation

Status: DONE — all five review findings were reproduced by tests, fixed, and verified in both the checked-false and
isolated all-enabled states without changing the repository's rollout flags.

The remediation makes five boundaries explicit:

1. The postbuild sitemap now emits all 12 localized MCP owner URLs (four owners across EN/FR/ES). Every entry has
   reciprocal absolute EN/FR/ES alternates plus `x-default`, using `hrefIsAbsolute: true`.
2. `llms.txt` is a route backed by a pure builder that consumes `mcp-publication.json`. The false state reports zero
   MCP acquisition sources and an accurate closed-gate note. The enabled state reports exactly four distinct
   canonical owner entries and never the API endpoint. There is no tracked generated/static-file conflict.
3. `robots.txt` is host-aware from the authoritative `Host` header. The public host receives the documented crawler
   policy; the API/protocol host blocks all paths and ignores a spoofed `X-Forwarded-Host`. MCP protocol responses and
   protected-resource discovery responses carry `X-Robots-Tag: noindex,nofollow` on success and error paths.
4. `Google-Extended` deliberately allows public content while blocking private paths. This couples Gemini grounding
   with Google's stated control over future Gemini training, a tradeoff that must be reconsidered if the product
   wants one without the other. Google says this token does not affect Google Search.
5. `OAI-AdsBot` has its own ads landing-page validation group and is not classified as a search/answer crawler.

The review-focused contract was written before the remediation:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-seo-review-remediation.test.ts \
  tests/mcp-transport-contract.test.ts \
  tests/mcp-oauth-discovery.test.ts
```

Initial result: exit 1; 17 tests, 10 passed and 7 failed. The failures covered the real postbuild localized count,
state-aware `llms.txt`, host-aware robots, and protocol/discovery noindex headers. Final result: exit 0; 17 passed,
0 failed. The affected compatibility set passed 42/42, and the final combined MCP/SEO regression passed 325/325.

The checked-false state was verified with a real production build and local production server:

- build completed with 729 generated pages and postbuild sitemap generation;
- runtime and postbuild sitemaps contained zero MCP owners;
- `llms.txt` contained zero MCP sources and one accurate closed-gate note;
- the API host's `robots.txt` blocked all paths even when `X-Forwarded-Host` named the public host;
- MCP and protected-resource discovery returned fail-closed 404 responses with `X-Robots-Tag: noindex,nofollow`;
- `/`, `/fr`, and `/es` passed canonical-host QA.

An isolated fixture made all eight publication flags true without editing the working tree, then ran the real build,
postbuild CLI, and local production server:

- build completed with 733 generated pages;
- postbuild XML contained exactly 12 localized MCP `<loc>` entries and 48 absolute alternate `href` values;
- each locale runtime sitemap contained its four localized canonical owners;
- `llms.txt` contained exactly four canonical owner sources and zero API endpoint sources;
- all four source routes returned 200 and `/mcp` exposed one canonical plus four reciprocal hreflang links;
- the API MCP route returned 401 with the noindex header; protected-resource discovery returned its expected
  missing-Supabase-config 503 with the noindex header; API-host robots still blocked all paths;
- canonical-host QA passed.

The isolated build logged an expected Edge/Supabase warning because dependencies were symlinked into the temporary
fixture, and protected-resource discovery could not become healthy without Supabase configuration. Neither affected
the build result or the behavior under review. No deployment, GSC mutation, publication flag change, external write,
push, or pull request was performed.

Current first-party policy sources checked on 2026-07-14:

- Google common crawlers (`Google-Extended` grounding/training coupling and no Search effect):
  <https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers>
- OpenAI advertiser guidance (`OAI-AdsBot` landing-page validation role):
  <https://help.openai.com/en/articles/20001243-advertiser-guidance-for-allowing-openai-web-crawlers>
