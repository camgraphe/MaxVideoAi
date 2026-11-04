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
- The hero renders the curated California cursor film poster and public watch link synchronously. Its model, duration, poster and original identity come from `frontend/config/california-cursor-film.ts`, shared with the homepage. Prioritize this one poster. Scope the film’s data-nosnippet wrapper to its figure so the commercial introduction and prices stay eligible for search snippets. The separate generation quote describes its own model and settings.
- `PayAsYouGoHeroQuoteCard` shares the amount and context geometry with an inert, nonnumeric pending state. Supplementary model prices and the example prompt live in a closed native disclosure. Reserve the localized unavailable-price label and let long model names wrap.
- The credit workflow follows the hero. Its responsive screenshot selects the localized, signed-in Milo workspace capture for the viewport. Its Wan 3 Prime retro game-show scene and workspace link are separate from the California hero. Keep private account details and activity out of marketing captures. The film programme checks exact model identity and eligible public records, retaining the admin playlist as additional films. Show model contact sheets only for their validated film and supported model. The interactive receipt reads the same prepared cells as the public price table. Both model directories render their text and links on the server inside native disclosures.
- `PayAsYouGoAnchorRestore.client.tsx` restores only pending anchors owned by this page, preserving history and yielding to later user input or navigation. Keep its client scope bounded to the route shell.
- Preserve public paths, metadata, canonical, hreflang, JSON-LD, section order, classes, links, prices, and showcase behavior during structural work.
- Showcase cards retain server-rendered copy and watch links. `PayAsYouGoPreview.client.tsx` owns viewport eligibility and responsive lazy covers; `useExampleCardPlayback` owns playback. Only visible desktop previews with pointer or keyboard intent mount video. Keep mobile poster-only navigation and do not prioritize this below-fold strip over the hero.
- Run the eight permanent Pay-as-you-go tests plus `pnpm test:validate`, frontend TypeScript/lint, exposure lint, architecture audit, build, and EN/FR/ES route smokes after changes.
