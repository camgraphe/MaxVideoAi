# Model and examples price streaming

> Implementation plan for the authorized follow-up to PR #431. Use separate model and examples tasks, with shared integration and performance verification.

**Goal:** let the existing critical posters render while canonical price calculations finish, preserving exact prices, media selection, geometry, public URLs and localized SEO.

**Baseline:** merged production commit `3cf8aae2f4ab0260c8c74a423fc2ccb0d3103b11`. Its tree equals the previously verified `d5dc2bfc9` production build. Prices remain request-local canonical quotes; no amount cache or authored-price fallback is introduced.

## Tasks

1. Verify the Git-backed deployment for #431 on both production domains, smoke home/PAYG and inspect errors. Dispatch the existing Lighthouse workflow after READY.
2. Examples: prepare the existing gallery without waiting for current prices; stream only price labels through server Suspense slots. Preserve the four-card opening inside the 24-card gallery, first-poster priority, reader behavior, pagination and family routes.
3. Models: separate critical gallery/spec inputs from the exact pricing projection. For video decision templates, render the same selected hero immediately, then reveal complete exact details and their corresponding JSON-LD together. Image and legacy pages retain their awaited render. Preserve localized labels and failure semantics.
4. For each change, first reproduce the blocked initial response with a held canonical-price dependency. Verify early poster output, eventual exact prices, unavailable prices, and EN/FR/ES parity. Update architecture contracts to document the final ownership.
5. Run focused tests, lint, exposure checks and a production build. Compare baseline and candidate under identical browser viewport, throttling, cache settings and media; alternate repeated captures and report LCP, TTFB, poster download/render timing, CLS, payload and variance. Separate local lab evidence from field CrUX results.
6. Review the complete patch independently, fix regressions, record measurements and source provenance, then open and attach the follow-up PR with relevant CI.

## Acceptance boundaries

- No temporary numeric prices, stale historical generation cost, new client-side quote request, or duplicate page/gallery replacement.
- Native server JSON-LD remains consistent with visible exact prices after the stream finishes.
- No hero media, priority policy or poster size change used to manufacture a gain.
- Reject reproducible initial-loading regressions; do not claim improvement from inconclusive measurements.
- Production release follows `docs/deployment/github-vercel.md`; the shared Desktop checkout is never uploaded.
