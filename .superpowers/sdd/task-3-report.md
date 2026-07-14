# Task 3 report: MCP acquisition and integration routes

## Status

DONE

## Implementation summary

- Added the localized `/mcp`, `/integrations/claude`, and `/integrations/codex` route owners plus the default-English wrappers required by the repository's route shape. Spanish integration URLs use `/es/integraciones/...` through the shared locale routing authority.
- Kept the three page files as thin server orchestrators. Copy, compatibility evidence, JSON-LD builders, page sections, client actions, and the single proof-media client boundary are colocated by responsibility.
- Used the existing marketing shell, tokens, typography, surface treatment, and dark-mode conventions. The new surfaces contain no gradients or parallel theme system.
- Added exact approved English acquisition copy and complete native French and Spanish copy. The primary prospect flow is budget first: describe the result, compare current eligible routes, then approve the final price in the connected host.
- Rendered Claude and Codex as equal neutral actions with the existing verified official/repository-vetted marks and localized factual setup-guide links.
- Reused the canonical Task 3A budget builder. Current checked-in publication gates make the list empty; a deliberately live test fixture renders the canonical included-trial, lowest-paid, and capability-upgrade slots.
- Reused the fail-closed Task 2 proof owner. `getMcpProof()` currently returns `null`, so no demo, proof badge, ownership, engine, price, or evidence caption renders. Any future proof now also requires a locale-specific timed-caption asset and renders it through a native captions track.
- Added factual host compatibility data sourced from `docs/operations/mcp-host-compatibility-matrix.md`, with the visible verification date recorded as `2026-07-12` and host versions kept in a machine-readable config.
- Added factual Claude and Codex connection guides covering connection, below-fold OAuth, example workflow, files/references, troubleshooting, revocation, and disconnect. Their visible state explicitly remains unavailable/limited while publication prerequisites are false.
- Added reciprocal localized canonicals and hreflang metadata. Robots fail closed. `WebApplication` JSON-LD is emitted only when the page is indexable; breadcrumb schema is server-rendered only for a renderable page. No `Offer`, `AggregateRating`, `FAQPage`, or `HowTo` schema was added.
- Did not modify any MCP feature or publication flag. The production runtime currently returns a not-found response with `noindex` for these routes.

## TDD RED evidence

The architecture, copy, visual, route, metadata, schema, proof, and localization contracts were written before the route implementation.

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-marketing-copy.test.ts \
  tests/mcp-marketing-visual-contract.test.ts \
  tests/marketing-locale-routing.test.ts
```

Initial result: exit 1; 25 tests, 7 existing locale tests passed and all 18 new Task 3 tests failed on the intentionally absent pages, components, routing entries, copy owners, compatibility source, and JSON-LD contracts.

Two self-review gaps were then closed with smaller RED/GREEN cycles:

- Verified proof badge: the targeted copy contract failed because the future non-null proof branch did not render `proof.badge`; the badge was added and the targeted test passed.
- Timed captions: the targeted proof-media contract failed because the video had a visible figcaption but no native captions track; `captionsSrc` and `captionsLocale` became required proof fields and the component now renders `<track kind="captions">`. The targeted test then passed.

## Final verification

All commands below were run after the final production edit unless explicitly identified as the completed production-build boundary.

1. Task 3 page gate

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
     tests/mcp-marketing-route-architecture.test.ts \
     tests/mcp-marketing-copy.test.ts \
     tests/mcp-marketing-visual-contract.test.ts \
     tests/marketing-locale-routing.test.ts
   ```

   Result: exit 0; 25 passed, 0 failed.

2. MCP, publication, proof, canonical pricing, SEO, schema, sitemap, and locale regressions

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
     tests/mcp-publication.test.ts tests/mcp-config.test.ts \
     tests/mcp-demo-assets.test.ts tests/mcp-budget-options.test.ts \
     tests/pricing-public-authority.test.ts tests/pricing-public-projection.test.ts \
     tests/marketing-jsonld-schema-audit.test.ts tests/schema-sitemap-architecture.test.ts \
     tests/localized-fallback-seo.test.ts tests/hreflang-variants.test.ts \
     tests/marketing-language-switch.test.ts tests/premerge-seo-routes.test.ts
   ```

   Result: exit 0; 66 passed, 0 failed.

3. TypeScript, lint, exposure, and localization parity

   ```bash
   ./frontend/node_modules/.bin/tsc --project frontend/tsconfig.json --noEmit
   npm --prefix frontend run lint
   npm run lint:exposure
   npm --prefix frontend run i18n:check
   ```

   Result: all exit 0. Public exposure passed; FR parity is 4,153 keys and ES parity is 4,147 keys.

4. Production build

   ```bash
   npm --prefix frontend run build
   ```

   Result: exit 0. Model-registry checks, Next.js compilation, static route generation, and the postbuild sitemap step all passed. The new physical route owners appeared in the generated route manifest with no collision.

5. Production-server smoke and exact route resolution

   A completed production build was started on port 3127 and queried with Node fetch. `/mcp`, `/fr/mcp`, `/es/mcp`, `/integrations/claude`, `/fr/integrations/codex`, and `/es/integraciones/claude` all returned 404 and a `noindex` robots meta under the current fail-closed publication state. The server was stopped cleanly. A separate middleware resolution check accepted the exact EN/FR/ES route forms without redirects or route collisions.

6. Source and diff audit

   ```bash
   git diff --check
   ```

   Result: exit 0. A scoped source scan also confirmed no trailing whitespace, gradient classes, second theme provider, autoplay proof media, unsupported structured-data types, or fabricated proof assets in the new route implementation.

## Architecture and claim decisions

- The route owners call `getMcpPublicationState(FEATURES.mcp)` directly. Rendering follows `renderPublicPage`; robots and `WebApplication` schema follow the stronger `indexable` state.
- Trial, paid-generation, and reference claims use their independent publication-state gates. Preview copy describes the planned/limited state instead of implying a live capability.
- The host can help formulate a request and plan file/reference use; the copy does not claim that the host itself creates the media or that every selected model supports every reference input.
- Compatibility versions and verification date come from a checked-in evidence config linked to the operations matrix, not from authored page copy.
- `page.tsx` files remain under 80 lines. The larger localized text maps are pure typed copy modules rather than route/UI owners.
- Default-English wrappers were required because this application does not get unprefixed route ownership from the localized route tree automatically.

## Changed surface

- `frontend/app/(localized)/[locale]/(marketing)/mcp/`
- `frontend/app/(localized)/[locale]/(marketing)/integrations/`
- `frontend/app/mcp/page.tsx`
- `frontend/app/integrations/claude/page.tsx`
- `frontend/app/integrations/codex/page.tsx`
- `frontend/config/mcp-compatibility.json`
- `frontend/config/localized-slugs.json`
- `frontend/i18n/routing.ts`
- `docs/operations/mcp-host-compatibility-matrix.md`
- `tests/mcp-marketing-route-architecture.test.ts`
- `tests/mcp-marketing-copy.test.ts`
- `tests/mcp-marketing-visual-contract.test.ts`

## Remaining concerns

- No publishable MCP demonstration proof exists. This is intentional and remains fail closed; future proof needs real job/audit/source evidence plus committed poster, video, and locale-specific caption assets.
- Browser screenshots of the populated acquisition design were not taken because the required production publication gates are false and were not weakened for visual QA. The isolated server-render/no-JavaScript contracts, source-level light/dark visual contract, full production build, and gated runtime smoke all pass.
- Publication, OAuth, transport, discovery, paid generation, trial, references, and indexation remain outside this task and disabled. The pages are ready behind those existing gates, not publicly launched.

No push, pull request, merge, deployment, external message, database change, feature-flag change, or other external mutation was performed.

## Review remediation: 2026-07-14

The post-implementation review identified seven important findings and four minor findings. They were addressed as one test-driven remediation without changing feature flags, deploying, or contacting external systems.

### Remediation outcomes

- Official OpenAI marks now remain visible in both themes. Their invariant white fill is paired with a neutral dark tile in dark mode, and the visual contract reads the pinned SVG fill while rejecting an invariant white tile.
- Visible connection availability now follows a dedicated capability gate (`publicMarketing && transport && oauth && discovery`) instead of SEO indexation. A renderable noindex preview can therefore describe a live connection truthfully while live `WebApplication` schema remains suppressed.
- Budget options expose an exact T2V audio state: `enabled`, `optional`, or `silent`. The state is derived from mode-applicable input fields and their defaults. Seedance Mini's default-enabled audio, Wan's optional `audio_url`, and Pika's silent route are locked by mutation tests.
- The included-trial claim now renders its eligibility, verification, Seedance Mini, 5-second, 480p, promotional, and wallet-balance conditions only while the trial gate is enabled.
- Claude Desktop 1.20186.1 and Claude Code 2.1.207 now have separate evidence records, compatibility statuses, and localized setup guides. Claude Code includes the required `/mcp` authorization trigger and explicitly keeps its hosted tool smoke pending; the Claude Desktop hosted read-only pass is no longer attributed to Claude Code.
- `WebApplication` schema no longer invents an operating-system value, and MCP breadcrumbs use the localized EN/FR/ES home URL.
- Route views no longer nest a second `<main>` inside the marketing layout's landmark. A server-rendered structure contract locks the single-owner boundary.
- Native proof media is now a server component; the unnecessary client boundary was removed without changing controls, captions, poster, or playback behavior.
- EN/FR/ES metadata uses natural AI-video-generator search language. French and Spanish acquisition copy also replaces internal publication/pricing vocabulary with prospect-facing terms; Spanish integration copy uses `cliente`/`agente` instead of the English internal word `host`.
- Route tests now exercise the real middleware for exact EN/FR/ES MCP and integration URLs, and visual tests inspect official mark fills and theme tile classes instead of relying only on file presence.

### Remediation RED evidence

The remediation contracts were added before the production fixes:

1. Visual and route-structure contracts: 14 tests ran; 9 passed and 5 failed on the white-on-white dark tile, client-only proof component, and nested route landmarks.
2. Publication, copy, schema, and host contracts: 22 tests ran; 11 passed and 11 failed on the missing capability gate, trial disclosure, localized breadcrumb, native metadata/copy, and split Claude evidence.
3. Exact audio presentation: all 3 targeted tests failed while the builder still exposed the coarse `audioIncluded` boolean.

The failures matched the reviewed production behavior and became green only after the corresponding implementation changes.

### Remediation final verification

1. Complete MCP suite:

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-*.test.ts
   ```

   Result: exit 0; 123 passed, 0 failed.

2. TypeScript, lint, exposure, localization, and diff hygiene:

   ```bash
   ./frontend/node_modules/.bin/tsc --project frontend/tsconfig.json --noEmit --pretty false
   npm --prefix frontend run lint
   npm run lint:exposure
   npm --prefix frontend run i18n:check
   git diff --check
   ```

   Result: all exit 0. Public exposure passed; FR parity is 4,153 keys and ES parity is 4,147 keys.

3. Production build:

   ```bash
   npm --prefix frontend run build
   ```

   Result: exit 0. Registry/catalog checks, Next.js compilation and type validation, generation of 727 static pages, route manifest generation, and the postbuild sitemap step passed.

4. Gated production-server smoke:

   The completed build was started on port 3127. `/mcp`, `/fr/mcp`, `/es/mcp`, `/integrations/claude`, `/fr/integrations/codex`, and `/es/integraciones/claude` each returned 404 with `noindex`, no redirect, and no feature-flag weakening. The server was then stopped cleanly. The runtime middleware contract separately confirms that all six exact public route forms resolve without a not-found rewrite before the route-level publication gate runs.

No push, pull request, merge, deployment, external message, database change, feature-flag change, or other external mutation was performed during remediation.
