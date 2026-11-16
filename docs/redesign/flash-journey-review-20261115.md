# Flash model page — journey review, 15 November 2026

Local iteration only. Hero retained. No new paid generation, publishing or provider test.

## Decision

Keep the rich hero → Create / Modify / Extend demonstrations → gallery → prompt help and Milo → specifications → price and model choice → FAQ. Motion control remains a small focus inside Create. Restore missing discovery paths without reproducing the old template's repeated callouts, separate comparison grids and multiple prompt panels.

The gallery slot already existed but disappeared when no Flash videos were available. It now has a compact visual entrance to the family gallery, using the otherwise unused “Before the drop” concept frame. It is explicitly identified as a Sunburst concept; the linked gallery names the actual Seedance version for every video. When curated Flash videos are available, the existing real-video gallery replaces this entrance. It does not mix sibling-model videos into Flash proof or emit VideoObject data for stills.

The existing price band now also contains the standard/Flash comparison and three short links to published, active sibling model pages. These derive from registry publication and family order. The gallery decision card was removed from this band, avoiding a duplicated destination. Navigation exposes Gallery and “Price & compare”. The latter anchor now preserves space below the sticky navigation.

## What carries over from other model pages

| Existing value | Treatment in the cinematic page |
| --- | --- |
| Original prompts and inspectable settings | Preserved in server-rendered dialogs; one main video-prompt entry per workflow. |
| Real example gallery and original version identity | Existing curated gallery retained; visible family-gallery entrance while Flash outputs are pending. |
| Choosing a model | Comparison and sibling links next to pricing, instead of adding a separate large comparison section. |
| Prompt education | One visual guide plus Milo inside Create; detailed advice stays expandable. |
| Technical facts and limits | Visible HTML specification table, copy/CSV exports, workflow limits, FAQ and source links retained. |
| Commercial intent | Existing Create/Modify/Extend mode links, Milo, copy prompt, quote-before-generation, and full pricing. |

## Evidence and limits

Live reference pages inspected: https://maxvideoai.com/models/seedance-2-5, https://maxvideoai.com/models/seedance-2-0, https://maxvideoai.com/examples/seedance. Existing pages supply gallery/watch/recreate journeys, a family/version choice, prompt help and technical details. Their full repeated section stack is not carried over.

Search evidence reused from `model-pages-search-evidence-20261114.md`: GSC window 10 October–6 November, collected 8 November, not a fresh 15 November export. `/examples/seedance` had 20 clicks and 579 impressions in that window. An older query-filtered report attributes `seedance 2.5 examples` to the same gallery. The dated Bing review gives separate evidence for retaining comparisons and galleries; citations are not visits or sales. These observations support preserving the destinations, not adding keyword blocks or forecasting a ranking gain.

Google's AI search guidance says the usual SEO requirements apply, with no special AI markup required: https://developers.google.com/search/docs/appearance/ai-features. Preserve accessible text, crawlable links and structured data consistent with visible claims.

## Validation

- 49 focused tests pass across cinematic behavior, exact-locale Examples content, Examples architecture and unused-gallery-pricing contracts. Two initial standalone test commands needed the frontend module resolution path; both passed after that correction.
- TypeScript, targeted ESLint, public exposure lint and diff whitespace checks pass.
- Six localized pilot routes return 200 and retain one H1, canonical, EN/FR/ES/x-default alternates and five JSON-LD blocks. Model sitemap and alias redirects checked.
- Desktop 927 × 998 and mobile 390 × 844: no horizontal overflow; gallery image loads, links remain readable, price anchor is below navigation.
- Copy-prompt motion-focus analytics location corrected to the existing accepted `model_workflow` value. Gallery and related-model actions use accepted event vocabulary.
- Public HTTP: gallery and Seedance 2.5 / 2.0 / 2.0 Fast pages return 200.
- **Release dependency:** the standard/Flash comparison returns 404 on production, but its EN/FR/ES routes return 200 in this candidate. The comparison must be present in the deployed release before publishing this model-page link. No production fix or deployment was made here.
- Local environment has no application database: live gallery data and customer prices are not validated here. Actual Flash videos and completed generation remain later media/integration work.

Screenshots: `model-page-integration/flash-journey-20261115/desktop-gallery.jpg`, `desktop-choice.jpg`, `mobile-choice.jpg` in the shared visualization directory. No performance improvement is claimed; the added image is lazy, responsive and retains fixed geometry.
