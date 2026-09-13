# App visual feedback qualification

Scope: the four annotated workspace comments in the [spec](../specs/2026-09-07-app-visual-feedback.md). Product source qualified at `a8b82c543` on the isolated `codex/app-catalogue-validation` branch, starting from `52a234cd6`.

## Result

- Recent-media filters share a compact segmented control and an accessible 44px refresh action. Image, video and audio reuse behavior remains available.
- The workspace reader uses one media-and-controls frame. Original URLs, full-media visibility, aspect ratio, initial geometry and playback lifecycle are preserved.
- The duplicate Library heading action is removed; the main Media navigation remains available.
- Settings, Options, quantity and Generate share a row when their actual widths fit. Narrow layouts wrap without clipping the price or reducing touch targets.
- New app, public, tool, agent/MCP and admin-preview quotes use standard pricing. Active membership promotions and editing are retired. Historical snapshots, receipts, refunds, frozen audit fixtures and the historical pricing kernel remain intact.

## Verification

- Full repository suite: **4,443/4,443 passed**, 88.049 seconds, using the secret-free validation launcher.
- Production build: **passed**, 861/861 static pages. Registry/media prebuild gates and sitemap postbuild passed.
- Frontend TypeScript, lint, public exposure and diff checks passed.
- Independent task reviews and the final complete-increment review passed with no remaining Critical, Important or Minor findings.
- Actual browser checks covered 320, 390, 1139 and 1440px as applicable, light/dark themes, video/image creation, audio media filters, loading/refresh, Options and complete visible prices. A final 1280px check also confirmed all seven Seedance controls on one 44px row.
- A matching Seedance 2.5 example (6s, 480p, 16:9, generated audio) displayed $1.55. Independent read-only public and billing adapters both returned 155 cents and zero membership discount for stale Plus input.
- French pricing rendered at `/fr/tarifs`, with the expected canonical and EN/FR/ES/x-default alternate links. EN/FR/ES membership copy and historical itemization were also checked through focused tests and source review.

## Compatibility decision

Pre-retirement first-party web tabs must refresh before a new untrusted charge. They send a current pricing revision; old or missing revisions return an actionable `PRICING_REFRESH_REQUIRED` response. This also covers historical custom Member discounts that a Plus/Pro-only check would miss. Documented public bound-quote APIs and trusted already-paid continuations retain their existing contracts. A previously undocumented unversioned client of an internal web endpoint would need to update its request.

## Qualification boundaries

No paid generation, payment, production data migration, push, merge or deployment was performed. Connected checks used the existing expiring disposable preview database. Browser dimensions do not establish device-specific Safari or touch performance, and no new Core Web Vitals improvement is claimed. The installed runtime was Node 23.9; the repository recommends Node 22.x and emitted that warning while checks passed.

The historical audit and live admin preview now have explicit entry points. Earlier pricing-shadow failures were fixed without rewriting frozen fixtures. A later sitemap test observed a partial Next development manifest; it passed unchanged after the production build supplied the complete manifest. The complete passing suite ran before restarting the development preview.

Detailed local screenshots, logs and review records are kept under `.superpowers/artifacts/2026-09-07-app-visual-feedback/` and are not product source.
