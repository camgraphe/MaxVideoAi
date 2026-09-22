# Admin Route Architecture

This guide defines the preferred split for admin pages in MaxVideoAI.

## Target Shape

Admin route files should stay small and server/client boundaries should be obvious.

For server admin routes:

```tsx
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminFeaturePage(props: PageProps) {
  const params = await props.params;
  const data = await fetchAdminFeatureData(params);

  return <AdminFeatureView data={data} />;
}
```

For client admin routes:

```tsx
'use client';

export default function AdminFeaturePage() {
  const controller = useAdminFeatureController();

  return <AdminFeatureView {...controller} />;
}
```

## Route-Local Modules

Prefer route-local folders for admin feature code that is not shared:

```txt
frontend/app/(core)/admin/example/
  page.tsx
  _components/
    AdminExampleView.tsx
    AdminExampleTable.tsx
    AdminExampleInspector.tsx
  _hooks/
    useAdminExampleController.ts
  _lib/
    admin-example-data.ts
    admin-example-format.ts
    admin-example-metrics.ts
```

Use shared admin-system components for shell and surfaces:

- `AdminPageHeader`
- `AdminSection`
- `AdminSectionMeta`
- `AdminInspectorPanel`
- `AdminMetricGrid`
- `AdminDataTable`
- `AdminStatTable`
- `AdminNotice`
- `AdminEmptyState`
- `AdminPricingChangePreviewDialog`
- `AdminPricingHistory`

## Commercial Pricing Domains

Commercial services retain three domain owners; their UI exposure differs:

- `/admin/pricing` authorizes then redirects to `/admin/settings`; canonical pricing services and authenticated APIs remain intact. `/admin/engines` shows read-only model activity. Removing either editor must not change persisted overrides, resolution precedence, caches or quotes;
- `/admin/membership` owns read-only historical membership thresholds, discounts, and audit events;
- `/admin/billing-products` owns fixed products referenced by live billing consumers.

Do not add membership or product controls back to `/admin/pricing`. Do not add direct-save commercial routes. Pricing and billing products use authorized inventory/history reads and a server-owned `preview → explicit confirmation → immediate apply` mutation protocol. Confirmation recomputes the preview fingerprint inside the transaction boundary before persistence. Membership is retired for mutation: inventory/history remain readable and preview, confirmation, and rollback fail with `410 membership_retired`.

The server rejects a stale preview fingerprint without persistence or cache invalidation. Every successful mutation and its immutable event commit in one transaction. Rollback is a new mutation: callbacks send only `targetId` and `eventId`, historical state is resolved server-side, and restoration enters the same fresh preview and confirmation flow. History is never updated or deleted.

Pricing proposals exclude settlement routing. `vendorAccountId` may appear only as read-only operational context; policy updates preserve its stored value and creates cannot set it. When the database is unavailable, public quote resolution may use versioned fallback policy, but commercial admin inventory must show the outage and every mutation must fail explicitly.

The retained commercial views share `AdminPricingHistory`; the membership view locks rollback controls. The pricing cockpit modules remain dormant for service/history compatibility, not exposed from navigation. The old `/api/admin/membership-tiers` and `/api/admin/pricing/rules` endpoints are intentionally absent and must not be recreated as compatibility shims. The detailed operating procedure and verification commands live in `docs/engineering/pricing-engine.md` under **Safe price-change runbook**.

## What Belongs Where

Keep in `page.tsx`:

- route params
- auth/redirect/notFound gates
- server data fetch orchestration
- dynamic/runtime exports
- rendering the route view

Move out of `page.tsx`:

- metric builders
- table rendering
- status badges
- detail panels
- formatters
- filter normalization
- href builders
- support/action rails
- SWR or URL state hooks

## Detail Pages

For pages such as `admin/users/[userId]`, prefer these sections:

- identity/access section
- usage/spend section
- wallet/ledger section
- support actions inspector
- route-local format and metric helpers

Do not type detail components with `Awaited<ReturnType<typeof fetcher>>[...]` when the server module already exports named DTO types. Import named types with `import type`.

## Contract Tests

Every refactored admin route should have an architecture test that checks:

- route file line cap
- route imports its view/controller
- route still owns data fetch orchestration when server-rendered
- tables and badges are not in `page.tsx`
- helpers are exported from `_lib`
- major sections are exported from `_components`

Use existing tests as templates:

```txt
tests/admin-users-architecture.test.ts
tests/admin-user-detail-architecture.test.ts
tests/admin-video-seo-architecture.test.ts
tests/admin-seo-gsc-architecture.test.ts
```

## MCP Acquisition Measurements

`/admin/mcp` loads operational audit metrics and account/generation outcomes independently.
`frontend/server/admin-mcp-outcomes.ts` and `admin-mcp-outcomes-queries.ts` own the latter;
the route-local `McpGenerationOverview` leads with eight cards: completed videos, completed
images, tool calls, active tool users, MCP accounts, MCP signups and the two creator counts.
Tool-call totals include status polling calls and are separate from generation counts; the
lower activity sections retain the detailed tool, success and failure breakdowns.

- MCP accounts are distinct authenticated accounts observed in the audit or quote ledger
  before the reporting end. This is cumulative usage, not installation or signup attribution.
- New signups using MCP match those accounts to synchronized `profiles.created_at` within
  the UTC window. A bounded server-only Auth lookup fills missing/unsynchronized profiles
  in memory; unresolved dates make this measure unavailable. It does
  not prove MCP caused the signup, and signups that never use MCP are outside this cohort.
- Video outcome totals are scoped by `app_jobs.created_at` in UTC `[from, to)`, joined to a
  canonical MCP quote on both job and user ownership, and restricted to `surface = 'video'`.
  Current completed status counts as a generated video job; failed/cancelled and pending jobs
  are shown separately. Image outcome totals use the same contract with `surface = 'image'`.
  Quote retries are deduplicated by job, while polling, quote-only rows and unrelated website
  jobs do not count.
- `McpGenerationOverview` also renders a bounded recent generation feed (maximum 30 jobs) from
  both surfaces. Each row exposes only job ID, image/video surface, public engine ID/label,
  current status, UTC creation time and coarse application attribution; its job link targets
  `/admin/jobs?jobId=...`. Prompts, signed/private media URLs and payment details stay out of
  this DTO. The feed uses the same UTC half-open window and quote/job ownership join, and
  deduplicates quote retries by job before attribution.
- Global users are deduplicated across applications. Application rows may overlap for users,
  while each deduplicated video or image job has one application. Account application uses the
  latest observed activity for its user/OAuth-client pair; generation attribution uses evidence
  at submission time.
- Migration 41 and the audit bootstrap add nullable `client_family`; migration 42 widens its
  database constraint for the complete ecosystem. Successful MCP initialization stores only
  a normalized family from self-reported
  `clientInfo.name`; raw metadata is discarded. The admin application breakdown covers the
  nine integration-registry families, the separate Glama MCP-client family, and
  `Other / unidentified`. Glama is an analytics label for a client identifying itself
  as Glama, not a first-party host integration or proof that a directory listing
  sent the user. Ambiguous names stay unidentified. This field must never authorize access.
  Recorded connection-link attribution is the fallback for the same user/OAuth-client pair.
  A bounded server-only lookup of current registered OAuth client names supplies an
  indicative historical fallback when event-time evidence is missing.
  Null client IDs and missing evidence remain unidentified; later observations never relabel
  an earlier generation through event-time evidence; the current OAuth registry fallback is
  explicitly labeled as indicative. Old schemas continue to serve outcomes using the
  available attribution.
- Migration 48 admits `glama` in the Neon audit constraint without rewriting historical
  rows. Apply it before deploying runtime code that records this family; old `other`
  entries are not force-reclassified.
- The separate acquisition-source split remains limited to acquisition-enabled landing-page
  clients. Direct, preview, hidden, and unidentified hosts remain in its `Other / unidentified`
  row until their acquisition gate is deliberately enabled; this does not prevent their
  self-reported family from appearing in the application breakdown.

The commercial funnel capability flags must not be flipped merely because tables exist.
Paid preparation/acceptance/completion funnel events are not yet fully produced, so the
legacy conversion, receipt-attribution and provider-cost panels retain their unavailable
states. The public `trial` flag controls a separate free-trial rollout, not analytics; this
change does not enable that offer. The new outcomes read the existing quote/job producers
and work while the commercial funnel is disabled.

Validation: `tests/admin-mcp-metrics-postgres.test.ts` exercises real PostgreSQL outcomes,
window boundaries, multiple clients, ownership, missing profiles and legacy schemas;
`tests/admin-mcp-outcomes.test.ts` covers failure handling and client-family normalization.

Auth metadata fallbacks use the existing Supabase admin client in
`frontend/server/admin-mcp-auth-metadata.ts`: at most 100 requested identities per page,
four concurrent reads, only missing dates and unidentified applications. No synchronization
writes occur; raw names, account records and credentials never enter the page DTO.
The outcome query returns bounded internal ID arrays solely for this server-side lookup.
See the [Auth account lookup](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid)
and [OAuth client lookup](https://supabase.com/docs/reference/javascript/oauth-admin-getclient) contracts.

## Admin navigation and overview (2026-09-22)

`frontend/lib/admin/navigation.ts` owns five work areas: Overview, Users, Transactions,
Generations and Content, plus Settings and two external links. The command palette
uses this same inventory. Legacy direct URLs remain; theme and membership are absent
from daily navigation. Search Console reporting is an external link. Existing backend
jobs and public SEO consumers are not removed by this interface change.

The light palette is scoped to `.admin-workspace`. Shared sections use separators and
compact tables. The mobile sidebar traps keyboard focus while open and restores it on
Escape. Removed navigation badges no longer trigger server health reads or polling;
health reporting remains available from its existing API and operational views.

Overview authorizes before `fetchAdminOverview`. Reporting windows use Europe/Madrid,
with calendar Today (including DST) separate from rolling 24 hours. Auth and wallet
sources have independent five-second deadlines. Auth scanning is bounded to 100 pages
of 1000 accounts and stops after a late response; partial scans are unavailable, never
presented as full counts. This is a read path, without schema creation. Wallet top-ups
include manual credits and must not be labelled cash revenue. Transactions search and
filters explicitly apply to the latest 100 loaded ledger entries; deep receipt links
open the inspector and handle PostgreSQL bigint IDs serialized as strings.

Playlist order is an explicit draft. Movement is available by drag or keyboard buttons;
Cancel restores the last confirmed snapshot. Loading another destination commits its ID
and items together after a successful fetch. Async actions remain locked until completion.
Maintenance is disabled with a dirty order. After a successful PUT, the local snapshot is
confirmed before a refresh, so a failed refresh cannot resurrect the old order. Backend
replacement is transactional. Multi-admin optimistic conflict detection and automatic
placement/exclusion modes remain separate future work; current public readers are intact.

Contracts: admin-dashboard-architecture, admin-navigation, admin-reporting-window,
admin-overview-read, admin-playlist-selection and admin-playlist-order-postgres tests.


The operational workspaces follow-up keeps Users directory and Generations audit controllers intact while simplifying their views. Collapsed job filters stay mounted and open for active advanced parameters. Moderation accepts an initial read error separately from an empty successful collection. The editorial inventory joins the exact version/digest publication record and separately reports the latest verified published version; neither approval nor an older publication establishes publication of a new draft. Trends renders one focus series and retains the existing comparison query semantics. Regression coverage includes `admin-job-filters-render`, `admin-moderation-read-state`, `admin-editorial-status` and `editorial-admin-inventory-postgres`.

## Opt-in public curation

Migration `52_playlist_curations.sql` adds separate per-destination state and performs no data migration. Apply it through the normal Neon migration process before enabling the new editor. Missing schema preserves legacy public readers; the editor reports setup unavailable. Homepage and starter destinations keep their existing workflows.

`server/playlists/curation-service.ts` owns eligibility, preview fingerprints and transactional saves. `curation-store.ts` owns revision snapshots and the advisory lock shared with legacy playlist mutations. Existing feeds are unchanged until an operator previews and saves Manual or Featured + Automatic. Automatic order uses creation date descending and job ID because publication timestamps are not reliable. Public candidates must be completed video jobs, explicitly public/indexable, have a playable source, match canonical destination aliases and have no matching deleted output/asset. Exclusions precede ordering and limits. Every public read rechecks eligibility. Configured empty results are authoritative, including model fallback routes.

`server/videos-playlists.ts` preserves the legacy SQL and delegates configured destinations to the same resolver as preview. Media normalization, originals, preview URLs, output dimensions and public playback hooks retain their owners. A concurrent revision or changed preview is rejected without persistence. No pricing or production data is migrated by this feature.

### Full transaction history

The transaction workspace reads through `server/admin-transactions/history.ts`.
Search, type/review and Madrid Today/24h/all-time filters apply before the page
limit. A cursor preserves the initial time window and the exact PostgreSQL
microsecond timestamp plus receipt ID; it is bound to the selected filters.
Receipt deep links resolve independently of the visible page. Filter state is
in the URL and navigation uses a pending Next router transition, without a
second client-side copy of the query results. The table never sorts a page again.

Email lookup remains in Users (Supabase Auth owns that data); each user detail
links to their all-time transaction history. The ledger searches receipt/account
IDs, generation IDs, description, model and status. These reads perform no schema
bootstrap. The existing anomaly scan and refund command retain their owners.
