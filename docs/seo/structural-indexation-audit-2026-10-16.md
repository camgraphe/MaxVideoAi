# Public discovery and indexation audit — 2026-10-16

## Outcome

Five structural discovery defects are corrected in this candidate:

1. Valid default example pages after page 1 were `noindex` with a page-1 canonical.
   Each now retains its page number in its localized canonical, hreflang and Open
   Graph URL. Sort/filter variants and intentionally excluded families retain
   their exclusions.
2. French and Spanish hub pagination could link to English `/examples`.
   Pagination now emits fully localized hrefs, including previous/next links.
3. Model discovery depended on client tab/filter/infinite-scroll interaction.
   The catalogue now renders native scope links and a text-only server directory
   from its existing price-free card selection: 48 model destinations on the main
   catalogue, with legacy versions separately labelled. The six-card interactive
   opening and media loading policy are unchanged.
4. The comparison directory rendered only its first 24 links until a button click.
   All eligible links now exist in the initial HTML. The rest of the list uses
   native `details`, accessible without JavaScript, while search still filters it.
5. The comparison directory reused the available-only selector and omitted eight
   already published pairs involving limited/waitlist models. Its selection now
   includes those models; executable selectors retain their narrower policy.

Strict page parsing also normalizes malformed/repeated values and preserves a
legacy engine filter before redirecting it to its family path. An independent
review caught that redirect-order edge case; real-route regression tests cover it.
LTX 2.3 receives an explicit localized FAQ alongside LTX 2.5 so historical prompt
intent and exact model identity remain clear.

## Public HTTP scope

The audit fetched public HTML with a maximum of three concurrent requests,
followed redirects explicitly, and inspected native anchors, canonical/robots,
hreflang, headings and JSON-LD. It made no database, media, indexing or deployment
writes. The evidence contains 1,546 unique public URL cases:
[URL inventory](structural-indexation-2026-10-16/public-urls.csv).

| Scope | Coverage and result |
| --- | --- |
| Models, comparisons, best-for and tools sitemaps | All 1,018 URLs: HTTP 200, no redirect, self-canonical, one H1, JSON-LD present, reciprocal hreflang and no unexpected noindex |
| Breakdown of those 1,018 URLs | 790 comparison details; 39 best-for pages; 3 comparison hubs; 171 model routes/hubs; 15 tool routes/hubs |
| Example families and pagination | All 13 feeds in EN/FR/ES, including the full public hub through page 12 and family continuations; 99 default page URLs within 147 cases including catalogue/query controls |
| Comparison controls | 13 linked localized exclusions, plus 9 reverse-order, explicit-order and tracking cases |
| Public watch identities | All 368 unique IDs captured from the public feeds: 65 one-hop canonical redirects ending on indexable watch pages; 303 working noindex watch pages |
| Prior GSC model/tool cohort | The 23 supplied targets and their localized siblings (51 distinct URLs) remain technically indexable, self-canonical and reciprocal |

No missing robots meta is treated as an error: omission allows indexing by default.
The sitemap audit checks technical eligibility, not whether Google actually indexed
or selected each URL. It does not establish a cause for the historical traffic drop.

## Comparison discovery measurements

| Locale | Published pairs in sitemap | Eligible current directory | Existing native comparison links anywhere on hub | Eligible destinations missing from hub HTML |
| --- | ---: | ---: | ---: | ---: |
| EN | 312 | 192 | 82 | 110 |
| FR | 226 | 147 | 82 | 66 |
| ES | 252 | 158 | 81 | 78 |

Thus 254 localized, eligible destinations lacked a native link on their hub.
Of these, 215 also had no inbound anchor from another page in the 1,018-page crawl.
That is a bounded graph observation, not proof of site-wide orphan status: blog,
documentation and external links were not exhaustively crawled.

The 120 published pairs involving archived models deliberately remain outside
current-model recommendations. Their routes and sitemap policy remain intact.
The 13 linked FR/ES noindex comparisons match the explicit locale indexation
configuration and are absent from their locale sitemaps. They remain available
to readers; this audit does not automatically publish excluded content.
Reverse-order links preserve the selected viewing order through a redirect;
order variants remain noindex with the canonical pair URL. Tracking variants
canonicalize to that same URL.

## Historical video continuity

The 65 indexable watch URLs exactly match both video sitemaps. Their VideoObject
video/poster URLs agree with sitemap media. Robots permits Googlebot and
Googlebot-Video for every captured watch identity. All 130 video/poster HEAD
requests returned 200, and all 65 bounded video Range requests returned 206:
[media evidence](structural-indexation-2026-10-16/video-media.csv).

All 27 distinct authored watch/editorial IDs are included in the captured set.
This is not an inventory of every video ever generated. Healthy ID-to-slug
redirects remain; the candidate does not add media eligibility reads to every
gallery merely to replace them. It changes neither original media URLs nor
watch eligibility, and does not lift the 303 watch exclusions.

## Local verification and performance

Local gallery verification uses a captured public snapshot, with database access
disabled. Family sets match the captured public feeds. The local hub snapshot is
the allowed union (309 videos), while the production admin-selected hub has 277;
their last-page totals are therefore not interchangeable. No selection SQL,
playlist membership or production data is changed by this candidate.
All 150 local URL cases completed successfully, including the remaining FR/ES hub
pages 7–12 with their own canonical and reciprocal page-number alternates:
[candidate URL evidence](structural-indexation-2026-10-16/candidate-urls.csv).
The snapshot is development-only by design; production-build comparison tests
use static catalogue data and do not substitute for gallery database validation.

EN/FR/ES mobile and desktop browser checks cover localized gallery pagination,
disjoint 24-card pages, no-JavaScript model/image navigation, and the catalogue
directory. The catalogue retains 44 image elements, zero initial media requests,
no horizontal overflow and no browser errors. Its dev-server before/after LCP
samples are diagnostic only: a cold French compilation makes that sample
non-comparable. They are not field Core Web Vitals evidence.

Production-build comparison tests use three fresh-context trials per viewport,
4× CPU slowdown, 200 KB/s download and 150 ms network latency on the same machine:

| Comparison hub metric | Before | After |
| --- | ---: | ---: |
| Mobile median LCP | 824 ms | 812 ms |
| Desktop median LCP | 816 ms | 840 ms |
| Maximum CLS | 0 | 0 |
| Initial resource requests / image elements | 44 / 25 | 44 / 25 |
| Compressed HTML | 48,112 bytes | 50,433 bytes |

These small lab timing differences are not a claim of improvement or field CWV
certification. No material loading regression was reproduced in these trials.
All three localized native disclosures, links beyond the first batch, search
matches/empty/reset and no-JavaScript navigation pass. The verified directory
counts are 192 EN, 147 FR and 158 ES; zero media requests, browser errors or
horizontal overflow were observed:
[browser evidence](structural-indexation-2026-10-16/browser-evidence.json).

Validation completed before the comparison extension:

- Full fast lane: 7,585 tests, 7,584 passed, zero failed, one environment skip
  (Codex packaged-authoring validators are not installed).
- Focused examples/catalogue/video/SEO checks: 235 passed, including disposable
  PostgreSQL 17 pagination coverage beyond 513 videos.
- Frontend production build, lint, exposure check and diff check passed.

The comparison extension adds real SSR discovery tests for all three locales and
updates the existing locale-indexation contract. Its related 92-test run and
18-test indexation/SSR run pass. Independent code review approved the final
comparison changes after the stale contract assertion was corrected.
The final frontend production build also passes, with five pre-existing lint
warnings and no errors. The read-only exposure and diff checks pass.

## Delivery and follow-up

This report describes a candidate fix, not a production deployment. Delivery
must use the GitHub PR, required Quality CI and Git-backed Vercel path. After
deployment, repeat the default page-2 canonical/hreflang check, native catalogue
and comparison link counts, no-JavaScript journeys and both-domain commit checks.
Then compare GSC crawl/indexation over time; no recovery date is promised and no
indexing submission has been made by this audit.

Google's guidance supporting the discovery decisions:
[pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading),
[crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable),
and [video indexing](https://developers.google.com/search/docs/appearance/video).
