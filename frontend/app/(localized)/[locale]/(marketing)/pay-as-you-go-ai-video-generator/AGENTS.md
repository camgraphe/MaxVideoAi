# Pay-as-you-go Route Guide

- `_content/{en,fr,es}.ts` is the only owner of authored localized copy for this route.
- `getPayAsYouGoContent(locale)` is exact-locale and must never fall back or merge overlays.
- `payg-page-data.ts` is the only owner of pricing-hub projection, row selection, price fallback formatting, hero quote preparation, supported-model runtime links, and example-cost resolution.
- Computed pricing values and formulas never belong in `_content`; existing authored price prose remains content.
- `page.tsx` only selects content, builds route data, loads showcase videos, assembles canonical/JSON-LD, and renders the view.
- JSON-LD and showcase helpers accept authored copy explicitly and must not add locale maps.
- Section components render `PayAsYouGoPageData`; they do not receive locale selectors or import pricing builders.
- The opening also accepts `PayAsYouGoHeroData`, projected only from editorial content and the pricing link. Never call the fallback pricing builder to fabricate a pending quote card.
- `PayAsYouGoStreamingView` emits the hero before current prices and showcase reads settle. One observed request-local page-data promise supplies the quote card and all later sections; keep the current video-only quote queue and pricing policy unchanged.
- `PayAsYouGoHeroQuoteCard` shares the card chrome with a nonnumeric pending state. Both retain the four-row space (258px from `sm`, 338px on narrow mobile to accommodate wrapped model names) and a context slot of 32px on desktop / 48px on narrow mobile, including missing rows/context. Rows keep natural heights within that shared minimum; names wrap without truncation. The amount uses the localized live-quote label as an invisible sizing label. This deliberately adds modest whitespace to short settled cards to keep the centered desktop title still; never clip longer text. Verify before/after desktop and mobile layout and loading measurements.
- `PayAsYouGoAnchorRestore.client.tsx` restores only pending anchors owned by this page, preserving history and yielding to later user input or navigation. Keep its client scope bounded to the route shell.
- Preserve public paths, metadata, canonical, hreflang, JSON-LD, section order, classes, links, prices, and showcase behavior during structural work.
- Showcase cards retain server-rendered copy and watch links. `PayAsYouGoPreview.client.tsx` owns viewport eligibility and responsive lazy covers; `useExampleCardPlayback` owns playback. Only visible desktop previews mount video. Keep mobile poster-only navigation and do not prioritize this below-fold strip over the hero.
- Run the eight permanent Pay-as-you-go tests plus `pnpm test:validate`, frontend TypeScript/lint, exposure lint, architecture audit, build, and EN/FR/ES route smokes after changes.
