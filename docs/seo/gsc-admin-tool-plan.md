# MaxVideoAI Admin GSC SEO Tool Audit and Plan

## Current Architecture

- Admin pages live in `frontend/app/(core)/admin`.
- Admin route protection is centralized in `frontend/app/(core)/admin/layout.tsx`, which calls `requireAdmin()` from `frontend/src/server/admin.ts`.
- Admin API routes independently call `requireAdmin(req)` and convert auth failures with `adminErrorToResponse`.
- The admin UI shell and reusable surfaces live in `frontend/components/admin` and `frontend/components/admin-system`.
- Existing SEO utilities live in `frontend/lib/seo`, `frontend/lib/sitemapData.ts`, `frontend/server/sitemaps`, `scripts/seo-guard.mjs`, and `scripts/internal-link-guard.mjs`.

## Recommended Route and Files

- Admin page: `frontend/app/(core)/admin/seo/gsc/page.tsx`
- Refresh API: `frontend/app/api/admin/seo/gsc/refresh/route.ts`
- Server-only GSC client/cache: `frontend/server/seo/gsc.ts`
- Pure analysis utilities: `frontend/lib/seo/gsc-analysis.ts`
- Client refresh control: `frontend/components/admin/GscRefreshButton.tsx`
- Tests: `tests/gsc-analysis.test.ts`

## Auth and Security

- Keep the page under the existing admin layout.
- Keep refresh behind `requireAdmin(req)`.
- Keep Google service account or OAuth refresh-token credentials in server-only modules and server-only env vars.
- Do not pass credentials, raw token responses, or private keys to React props.
- Keep admin routes noindexed through the existing admin layout metadata and middleware protections.

## Google API Setup

- Enable the Google Search Console API in the Google Cloud project.
- Create a service account.
- Add the service account email as a user on the Search Console property.
- Configure one of:
  - `GSC_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL` plus `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- If Search Console refuses to add the service account, use the OAuth user fallback instead:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REFRESH_TOKEN`
- Configure `GSC_SITE_URL` as the exact Search Console property, for example `https://maxvideoai.com/` or `sc-domain:maxvideoai.com`. For MaxVideoAI domain-property access, use `sc-domain:maxvideoai.com`.

### OAuth User Fallback Setup

Use this only when the service account path is blocked. The refresh token must belong to a Google user that can already read the MaxVideoAI Search Console property.

1. In Google Cloud Console, enable the Google Search Console API for the project.
2. Configure the OAuth consent screen. For local/internal use, add the Google account that owns or can read the Search Console property as a test user if the app is still in testing mode.
3. Create an OAuth 2.0 client ID. A Web application client works well with OAuth Playground. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
4. Open OAuth 2.0 Playground, open settings, enable "Use your own OAuth credentials", and paste the client ID and client secret.
5. Authorize this scope only: `https://www.googleapis.com/auth/webmasters.readonly`.
6. Approve with the Google user that has access to `sc-domain:maxvideoai.com`.
7. Exchange the authorization code for tokens and copy the returned refresh token.
8. Store only server-side env vars:
   - `GSC_SITE_URL=sc-domain:maxvideoai.com`
   - `GOOGLE_OAUTH_CLIENT_ID=...`
   - `GOOGLE_OAUTH_CLIENT_SECRET=...`
   - `GOOGLE_OAUTH_REFRESH_TOKEN=...`
9. Restart the local Next.js server and use the admin-only "Refresh GSC data" button.

Do not expose OAuth client secrets or refresh tokens through `NEXT_PUBLIC_*` variables. If Google does not return a refresh token, revoke the app grant for that Google user and repeat consent with offline access via OAuth Playground. For longer-lived local use, move the OAuth app out of testing mode when appropriate; testing-mode refresh tokens can be short-lived depending on Google's OAuth policies.

Official endpoints used or planned:

- Search Analytics `query` for clicks, impressions, CTR, position, dimensions, search type, and fresh-data metadata.
- URL Inspection `index.inspect` for curated URL index status in Phase 3.
- Sitemaps `list` for submitted sitemap status in Phase 4.

## Data Model

Phase 1 uses:

- In-memory cache for fast repeat loads.
- Production-safe database cache in `app_settings` when `DATABASE_URL` is configured.
- Optional file cache at `.cache/seo/gsc-search-analytics.json` for local development.
- Derived in-process aggregates for summary, trend, top queries, top pages, opportunities, and family clusters.

Recommended later storage:

- Dedicated Postgres table for historical snapshots, keyed by `source`, `site_url`, `range`, `fetched_at`, and `payload jsonb`.
- Postgres table or JSON exports for Codex-readable output.
- Keep generated exports out of git if they include private query data.

## UI Component Plan

- Reuse `AdminPageHeader`, `AdminSection`, `AdminMetricGrid`, `AdminDataTable`, `AdminNotice`, and `AdminEmptyState`.
- Match the current admin hub style: compact cards, dense but readable sections, restrained colors, and clear prioritization.
- Reuse the hub-page mental model from `/admin`, `/admin/insights`, `/models`, and `/ai-video-engines`: overview first, then clusters, opportunities, and explorer tables.

## Phased Implementation

### Phase 1: Search Analytics MVP

- Fetch Search Analytics for current and previous periods.
- Show clicks, impressions, CTR, average position, deltas, trend bars, top queries, top pages, family clusters, and detected opportunities.
- Add manual refresh and cache.

### Phase 2: Opportunity Scoring and Codex Exports

- Persist prioritized opportunities.
- Generate:
  - `data/seo/gsc-raw.json`
  - `data/seo/gsc-opportunities.json`
  - `data/seo/gsc-clusters.json`
  - `data/seo/gsc-summary.md`
- Add “copy task for Codex” for each opportunity.

### Phase 3: URL Inspection API

- Add curated URL list only.
- Respect quotas with a small batch size and per-URL timestamps.
- Inspect homepage, `/models`, `/examples`, `/ai-video-engines`, `/tools/*`, model/example/engine detail pages, and `/fr`/`/es` localized pages.
- Store index verdict, coverage state, Google/user canonical, robots/indexing state, last crawl, sitemap presence, rich result data, and inspection link.

### Phase 4: Sitemap and Status Monitoring

- Fetch GSC sitemap list.
- Display submitted URL, last submitted, last downloaded, discovered URLs, errors, and warnings.
- Compare with local sitemap generation.

### Phase 5: Richer Visualization and Trend Analysis

- Add page/query explorers with filters.
- Add search-type breakdowns for web, image, and video.
- Add country/device/search appearance tabs.
- Add historical deltas from persisted snapshots.
