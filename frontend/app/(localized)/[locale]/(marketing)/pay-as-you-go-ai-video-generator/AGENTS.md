# Pay-as-you-go Route Guide

- `_content/{en,fr,es}.ts` is the only owner of authored localized copy for this route.
- `getPayAsYouGoContent(locale)` is exact-locale and must never fall back or merge overlays.
- `payg-page-data.ts` is the only owner of pricing-hub projection, row selection, price fallback formatting, hero quote preparation, supported-model runtime links, and example-cost resolution.
- Computed pricing values and formulas never belong in `_content`; existing authored price prose remains content.
- `page.tsx` only selects content, builds route data, loads showcase videos, assembles canonical/JSON-LD, and renders the view.
- JSON-LD and showcase helpers accept authored copy explicitly and must not add locale maps.
- Section components render `PayAsYouGoPageData`; they do not receive locale selectors or import pricing builders.
- Preserve public paths, metadata, canonical, hreflang, JSON-LD, section order, classes, links, prices, and showcase behavior during structural work.
- Run the five permanent Pay-as-you-go tests plus `pnpm test:validate`, frontend TypeScript/lint, exposure lint, architecture audit, build, and EN/FR/ES route smokes after changes.
