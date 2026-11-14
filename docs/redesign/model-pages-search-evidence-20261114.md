# Model-page pilots — search evidence and decisions

This is an implementation input, not a measured result of the redesign. The local candidates have not been published.

## Google Search Console

Source: OUTREACH, `sources/2026-11-08/gsc-position-24h-diagnostic/daily-28d/`, native `Requêtes.csv`, `Pages.csv`, `Filtres.csv`, `Graphique.csv`, with the parent `provenance.json`. Property `sc-domain:maxvideoai.com`, Web search, all countries/devices. The daily graph establishes **10 October–6 November 2026**, 28 days; the folder date is the collection date. Query export capped at 1,000 rows.

| Exact page | Clicks | Impressions | CTR | Average position |
| --- | ---: | ---: | ---: | ---: |
| `/models/seedance-2-5` | 53 | 1,542 | 3.44% | 20.94 |
| `/examples/seedance` | 20 | 579 | 3.45% | 7.74 |
| `/models/seedream-5-0-pro` | 39 | 1,069 | 3.65% | 22.13 |
| `/models/seedream` | 8 | 1,086 | 0.74% | 27.16 |

| Exact query | Clicks | Impressions | Average position |
| --- | ---: | ---: | ---: |
| `seedance 2.5` | 19 | 444 | 36.37 |
| `seedance sample videos` | 1 | 22 | 6.95 |
| `seedance video examples` | 1 | 16 | 8.19 |
| `seedream 5.0 pro` | 11 | 185 | 26.17 |
| `seedream 5.0 pro pricing` | 0 | 36 | 14.22 |
| `seedream 5.5` | 0 | 12 | 52.00 |

These separate page and query tables cannot be joined into query-to-page attribution. Absence from the capped query export does not establish zero demand. Position/CTR are aggregates, not a ranking forecast.

An older **query-filtered** native report does establish a destination: OUTREACH `sources/2026-10-19/snippet-audit-next/gsc-seedance-query-28d/`, 19 September–16 October 2026 (native window contract), query `seedance 2.5 examples`, 13 impressions / 0 clicks / position 7.85, page `/examples/seedance`. This supports preserving the version-aware gallery route; it is not added to the newer totals.

## Assistant citations

OUTREACH `sources/2026-11-10/llm-citations-competitive-review/README.md`: Bing selection 11 October–9 November; daily rows available through 8 November, table coverage uncertain. Visible page table: 68 pages / 797 citations, versus site indicator 815 (18 unattributed). Comparisons account for 438 citations across 35 pages and example galleries for 141 across eight: **72.6% of the visible page table**, not of all 815. Citations do not establish visits or purchases.

## Decisions implemented in the pilots

- Keep stable model URLs, exact model/version H1s, existing metadata, localized canonical/hreflang, technical details and FAQ owners.
- Place generation, examples and price access in the hero; show exact canonical commercial scenarios immediately after the capability strip. Never turn provider cost into a customer price.
- Preserve Prompt Lab, comparisons and family galleries. Cinematic proofs enhance the existing Examples owner instead of creating competing landing routes.
- Add original prompts, explicit source models, exact reference lineage, dimensions and original-file access. This makes each demonstration inspectable by people and readable in server-rendered HTML.
- Preserve native alpha; do not invent video playback, Flash renders, measured latency or VideoObject markup for Sunburst start frames.
- Use one priority hero, responsive immutable WebP displays, fixed geometry, lazy below-fold media and small interaction islands. Do not load original PNGs at page opening.

The [Google AI-features guidance](https://developers.google.com/search/docs/appearance/ai-features) supports useful readable content, crawlable links and accurate structured data; it does not promise inclusion or require special AI markup. [Video guidance](https://developers.google.com/search/docs/appearance/video) applies to actual videos. [Page-experience guidance](https://developers.google.com/search/docs/appearance/page-experience) does not turn a visual redesign into a ranking guarantee.

## Evaluation after an approved release

Record the actual publication commit/date. Compare equivalent complete windows in GSC, segmented by exact model URL, locale, device and query intent; keep model launch/new demand distinct from the design change. Review examples/pricing/generation click-through with existing consented analytics, and field Core Web Vitals when sufficient data exists. Treat Bing citations separately. No new automated experiment or monitoring schedule is created here.
