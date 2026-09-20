# llms.txt discovery

`frontend/app/llms.txt/route.ts` serves a static build-time projection from
`frontend/lib/seo/llms-text.ts`. Do not add `frontend/public/llms.txt`, which would
conflict with the route. Production requires a deployment to publish changes.

The builder describes the web product first, then includes the MCP sources only
when the shared MCP publication state is indexable. Host eligibility stays owned
by the linked integration documentation.

Featured model links combine an editorial selection (`FEATURED_MODEL_IDS`) with
the existing launch-readiness candidates. This is not the complete catalog.
Canonical IDs, slugs, labels, lifecycle and model publication come from the
registry's runtime projection; the catalog provides a fallback marketing label.
Only current, published, indexable models can appear as featured links. Never add
model-page links directly to the static text: that bypasses publication checks.
Sora is intentionally absent from this editorial selection. Its registry lifecycle
is now `legacy`, so current-only MCP recommendations also exclude it. This does
not retire its execution or historical pages elsewhere in the product.

Selected comparisons are filtered through comparison publication and public
model-page eligibility. A legacy opponent can remain for an upgrade comparison.
Selection alone does not authorize a new comparison publication.

The September 2026 GSC review retains Omni/Veo and established Seedance/Veo
comparisons that already attract search/AI impressions. New models do not justify
dropping useful older comparison pages from discovery.

Model and locale sitemaps use a one-hour shared-cache lifetime plus at most one
day of stale-while-revalidate, aligned with llms.txt. They are build-time outputs,
so catalog changes still require deployment. Inspect live index/child `lastmod`
and cache age after release: an older cached child is not evidence of missing
source content. Do not fabricate a new modification date on every request.

For a launch, review the editorial candidates and selected comparison list as
well as the registry. For a rename, retirement or publication change, update only
the registry and regenerate its projections using the model registry guide.

Every frontend build runs `pnpm seo:machine:check` from the root before compiling.
This read-only gate checks the real llms projection, publication/identity fixtures,
JSON-LD product/organization invariants and the served discovery route. It does
not use the older `seo:check` URL fixer, which may mutate unrelated source files.

Validate with the llms guard (also included in `frontend`'s `seo:check`) and
`tests/p1-llms-discovery.test.ts`, including publication/retirement fixtures,
canonical renames and duplicate-link checks. The MCP remediation test also checks
the route response and publication gating.
